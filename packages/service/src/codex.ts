import type { EffortChoice, TokenUsage } from "@openmission/contracts";
import { Duration, Effect, Queue } from "effect";
import { harnessEnvironmentOf } from "./claude.ts";
import {
  callThreadTool,
  type HarnessAdapter,
  type HarnessEvent,
  HarnessFailure,
  type SteeredMessage,
  type ThreadAccess,
  type TurnRequest,
} from "./execution.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import { approvalInstructionsOf } from "./instructions.ts";
import { toolServerName } from "./mcp.ts";
import { countOf, fieldOf, isPromptAllowed, type RpcProcess, startRpcProcess, textFieldOf } from "./rpcProcess.ts";

// Codex through its app server (ADR 0008; protocol of codex-cli 0.160.1, probed 2026-11-07): one
// `codex app-server` process per thread, one Codex thread per OpenMission thread.

export interface CodexOptions {
  /** The executable; `codex` on the PATH by default. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before the app server's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
}

/** The turn a session is running: where its events go, and the steered messages not yet taken in. */
interface RunningTurn {
  readonly codexTurnId: string;
  interruptTimer: ReturnType<typeof setTimeout> | null;
  isInterrupting: boolean;
  readonly onEvent: (event: HarnessEvent) => Effect.Effect<void>;
  readonly untaken: Set<string>;
}

interface Session {
  readonly codexThreadId: string;
  idleTimer: ReturnType<typeof setTimeout> | null;
  readonly rpc: RpcProcess;
  /** The settings the process started with; a change restarts it on the next turn. */
  readonly signature: string;
  turn: RunningTurn | null;
}

/** How long Codex has to end an interrupted turn before its process is closed, as for Claude Code (CHG-0039). */
const interruptGraceMillis = 10_000;

/** The longest wait Codex accepts for a thread tool, in seconds: a question waits with no time limit. */
const noTimeLimitSeconds = 2_147_483;

/** Codex's own effort names; OpenMission's match them, and default leaves the model's own. */
const effortOf = (effort: EffortChoice) => (effort === "default" ? null : effort);

/**
 * How Codex asks, by approval level (CHG-0031, CHG-0035). At the default level commands run in Codex's
 * workspace sandbox and ask only to leave it, which OpenMission answers as Claude Code's prompts: unasked
 * unless sensitive. At "Also commands and edits" every command it does not trust asks.
 */
const policyOf = (access: ThreadAccess) => ({
  approvalPolicy: access.approvalLevel === "RiskyOnly" ? "on-request" : "untrusted",
  sandbox: "workspace-write",
});

/** The thread's settings: its tools at its own endpoint, no native subagents, and OpenMission's context. */
const threadSettingsOf = (request: TurnRequest) => ({
  ...policyOf(request.access),
  config: {
    // One thread is one Codex conversation; threads open threads with open_thread instead (ADR 0007).
    "features.multi_agent": false,
    [`mcp_servers.${toolServerName}.tool_timeout_sec`]: noTimeLimitSeconds,
    [`mcp_servers.${toolServerName}.url`]: request.access.mcpUrl,
    // The starting context already holds the folder's own instructions (workspaces.ts).
    project_doc_max_bytes: 0,
  },
  cwd: request.cwd,
  developerInstructions: `${request.context}\n\n${approvalInstructionsOf(request.access, false, "codex")}`,
  ...(request.model === "default" ? {} : { model: request.model }),
});

/** A turn's usage from Codex's per-call counts, whose input includes the cached part. */
const usageOf = (calls: ReadonlyArray<unknown>): TokenUsage | null => {
  if (calls.length === 0) return null;
  const sum = (key: string) => calls.reduce<number>((total, call) => total + countOf(call, key), 0);
  return {
    cacheCreation: sum("cacheWriteInputTokens"),
    cacheRead: sum("cachedInputTokens"),
    input: Math.max(0, sum("inputTokens") - sum("cachedInputTokens") - sum("cacheWriteInputTokens")),
    output: sum("outputTokens"),
  };
};

/** The files of a file change item, for its approval question. */
const changedPathsOf = (item: unknown) => {
  const changes = fieldOf(item, "changes");
  return Array.isArray(changes) ? changes.flatMap((change) => textFieldOf(change, "path") ?? []) : [];
};

/** Runs each thread in one long-lived `codex app-server` process. */
export const makeCodexHarness = (options: CodexOptions) =>
  Effect.gen(function* () {
    const sessions = new Map<string, Session>();
    const idleMillis = Duration.toMillis(Duration.fromInputUnsafe(options.idleTimeout));

    const close = (threadId: string) => {
      const session = sessions.get(threadId);
      if (session === undefined) return;
      sessions.delete(threadId);
      if (session.idleTimer !== null) clearTimeout(session.idleTimer);
      if (session.turn?.interruptTimer != null) clearTimeout(session.turn.interruptTimer);
      session.rpc.close();
    };
    yield* Effect.addFinalizer(() => Effect.sync(() => [...sessions.keys()].forEach(close)));

    const start = (request: TurnRequest, signature: string) =>
      Effect.gen(function* () {
        const rpc = yield* startRpcProcess({
          args: [...(options.prefixArgs ?? []), "app-server"],
          command: options.command,
          cwd: request.cwd,
          env: harnessEnvironmentOf(accountEnvironmentOf("codex", request.configDirectory)),
          isJsonRpc2: false,
          label: "Codex",
        });
        const started = yield* Effect.gen(function* () {
          yield* rpc.request("initialize", {
            capabilities: { experimentalApi: true, requestAttestation: false },
            clientInfo: { name: "openmission", title: "OpenMission", version: "0.0.0" },
          });
          rpc.notify("initialized", {});
          const settings = threadSettingsOf(request);
          return request.sessionId === null
            ? yield* rpc.request("thread/start", settings)
            : yield* rpc.request("thread/resume", { ...settings, threadId: request.sessionId });
        }).pipe(Effect.tapError(() => Effect.sync(() => rpc.close())));
        const codexThreadId = textFieldOf(fieldOf(started, "thread"), "id");
        if (codexThreadId === null) {
          rpc.close();
          return yield* new HarnessFailure({ reason: "Codex started no thread." });
        }
        const session: Session = { codexThreadId, idleTimer: null, rpc, signature, turn: null };
        sessions.set(request.threadId, session);
        return session;
      });

    /** Answers one of Codex's own requests, which may wait on the owner without a time limit. */
    const answerRequest = (
      session: Session,
      request: TurnRequest,
      incoming: { readonly id: number | string; readonly method: string; readonly params: unknown },
      fileChanges: Map<string, ReadonlyArray<string>>,
    ) =>
      Effect.gen(function* () {
        const { id, method, params } = incoming;
        const ask = (toolName: string, input: object) =>
          callThreadTool(request.access.mcpUrl, "answer_prompt", { input, tool_name: toolName }).pipe(
            Effect.map(isPromptAllowed),
          );
        if (method === "item/commandExecution/requestApproval") {
          const isAllowed = yield* ask("Bash", {
            command: textFieldOf(params, "command") ?? "",
            description: textFieldOf(params, "reason") ?? "",
          });
          return session.rpc.respond(id, { decision: isAllowed ? "accept" : "decline" });
        }
        if (method === "item/fileChange/requestApproval") {
          const paths = fileChanges.get(textFieldOf(params, "itemId") ?? "") ?? [];
          const isAllowed = yield* ask("Edit", {
            description: textFieldOf(params, "reason") ?? "",
            file_path: paths.join(", ") || (textFieldOf(params, "grantRoot") ?? "a file"),
          });
          return session.rpc.respond(id, { decision: isAllowed ? "accept" : "decline" });
        }
        if (method === "item/permissions/requestApproval") {
          const isAllowed = yield* ask("Permissions", {
            description: textFieldOf(params, "reason") ?? "Widen the sandbox",
            query: JSON.stringify(fieldOf(params, "permissions") ?? {}),
          });
          return session.rpc.respond(id, {
            permissions: isAllowed ? (fieldOf(params, "permissions") ?? {}) : {},
            scope: "turn",
          });
        }
        // OpenMission's own tools need no confirmation; another server's question is declined.
        if (method === "mcpServer/elicitation/request") {
          const isOwn = textFieldOf(params, "serverName") === toolServerName;
          return session.rpc.respond(id, { _meta: null, action: isOwn ? "accept" : "decline", content: null });
        }
        if (method === "item/tool/requestUserInput") return session.rpc.respond(id, { answers: {} });
        return session.rpc.respondError(id, `OpenMission does not answer ${method}.`);
      });

    const runTurn = (request: TurnRequest) =>
      Effect.gen(function* () {
        const signature = JSON.stringify([threadSettingsOf(request), request.configDirectory]);
        const existing = sessions.get(request.threadId);
        // A changed level, set of permissions, or context restarts the process, resuming its thread.
        if (existing !== undefined && (existing.signature !== signature || existing.rpc.hasExited()))
          close(request.threadId);
        const session = sessions.get(request.threadId) ?? (yield* start(request, signature));
        if (session.idleTimer !== null) clearTimeout(session.idleTimer);
        const content = request.note === null ? request.text : `${request.note}\n\n${request.text}`;
        const effort = effortOf(request.effort);
        const started = yield* session.rpc
          .request("turn/start", {
            input: [{ text: content, text_elements: [], type: "text" }],
            threadId: session.codexThreadId,
            ...(effort === null ? {} : { effort }),
            ...(request.model === "default" ? {} : { model: request.model }),
          })
          .pipe(Effect.tapError(() => Effect.sync(() => close(request.threadId))));
        const codexTurnId = textFieldOf(fieldOf(started, "turn"), "id") ?? "";
        const turn: RunningTurn = {
          codexTurnId,
          interruptTimer: null,
          isInterrupting: false,
          onEvent: request.onEvent,
          untaken: new Set(),
        };
        session.turn = turn;

        /**
         * The turn's end. A steered message not yet taken in may still sit in Codex's queue for a turn nothing
         * reads: the process closes instead, and the message, still undelivered, starts the next turn.
         */
        const end = (isInterrupted: boolean) => {
          session.turn = null;
          if (turn.interruptTimer !== null) clearTimeout(turn.interruptTimer);
          if (turn.untaken.size > 0) close(request.threadId);
          else session.idleTimer = setTimeout(() => close(request.threadId), idleMillis);
          return { cost: null, isInterrupted, sessionId: session.codexThreadId, usage: usageOf(calls) };
        };

        const calls: Array<unknown> = [];
        const fileChanges = new Map<string, ReadonlyArray<string>>();
        let draft = "";
        for (;;) {
          const incoming = yield* Queue.take(session.rpc.incoming);
          if (incoming._tag === "Exit") {
            close(request.threadId);
            if (turn.isInterrupting)
              return { cost: null, isInterrupted: true, sessionId: session.codexThreadId, usage: null };
            return yield* new HarnessFailure({ reason: incoming.reason });
          }
          if (incoming._tag === "Timer") {
            if (!turn.isInterrupting) continue;
            close(request.threadId);
            return { cost: null, isInterrupted: true, sessionId: session.codexThreadId, usage: usageOf(calls) };
          }
          if (incoming._tag === "Request") {
            // Answered beside the turn: a question may wait on the owner while events keep coming.
            yield* Effect.forkChild(answerRequest(session, request, incoming, fileChanges));
            continue;
          }
          const { method, params } = incoming;
          if (textFieldOf(params, "threadId") !== session.codexThreadId) continue;
          const item = fieldOf(params, "item");
          const itemType = textFieldOf(item, "type");
          if (method === "item/started" && itemType === "userMessage") {
            const clientId = textFieldOf(item, "clientId");
            if (clientId !== null && turn.untaken.delete(clientId))
              yield* request.onEvent({ _tag: "Delivered", messageId: clientId });
          } else if (method === "item/started" && itemType === "agentMessage") {
            draft = "";
          } else if (method === "item/started" && itemType === "fileChange") {
            fileChanges.set(textFieldOf(item, "id") ?? "", changedPathsOf(item));
          } else if (method === "item/agentMessage/delta") {
            draft += textFieldOf(params, "delta") ?? "";
            yield* request.onEvent({ _tag: "Draft", text: draft });
          } else if (method === "item/completed" && itemType === "agentMessage") {
            const text = textFieldOf(item, "text") ?? "";
            draft = "";
            if (text.trim() !== "") yield* request.onEvent({ _tag: "Reply", text });
          } else if (method === "thread/tokenUsage/updated") {
            calls.push(fieldOf(fieldOf(params, "tokenUsage"), "last"));
          } else if (method === "turn/completed") {
            const completed = fieldOf(params, "turn");
            if (textFieldOf(completed, "id") !== codexTurnId) continue;
            const status = textFieldOf(completed, "status");
            if (status === "interrupted" || turn.isInterrupting) return end(true);
            if (status === "failed") {
              close(request.threadId);
              return yield* new HarnessFailure({
                reason: textFieldOf(fieldOf(completed, "error"), "message") ?? "Codex reported a failed turn.",
              });
            }
            return end(false);
          }
        }
      }).pipe(Effect.onInterrupt(() => Effect.sync(() => close(request.threadId))));

    /** The session whose turn is running for the thread, if any. */
    const runningSessionOf = (threadId: string) => {
      const session = sessions.get(threadId);
      return session === undefined || session.rpc.hasExited() || session.turn === null ? null : session;
    };

    // A message steered mid-turn joins Codex's active turn; its userMessage item, carrying our id as
    // clientId, says it was taken in.
    const steer = (threadId: string, message: SteeredMessage) =>
      Effect.gen(function* () {
        const session = runningSessionOf(threadId);
        const turn = session?.turn ?? null;
        if (session === null || turn === null || turn.isInterrupting) return false;
        turn.untaken.add(message.id);
        const isTaken = yield* session.rpc
          .request("turn/steer", {
            clientUserMessageId: message.id,
            expectedTurnId: turn.codexTurnId,
            input: [{ text: message.text, text_elements: [], type: "text" }],
            threadId: session.codexThreadId,
          })
          .pipe(
            Effect.as(true),
            Effect.catch(() => Effect.succeed(false)),
          );
        if (!isTaken) turn.untaken.delete(message.id);
        return isTaken;
      });

    const interrupt = (threadId: string) =>
      Effect.gen(function* () {
        const session = runningSessionOf(threadId);
        const turn = session?.turn ?? null;
        if (session === null || turn === null) return false;
        if (turn.isInterrupting) return true;
        turn.isInterrupting = true;
        // The turn's own completion, as interrupted, ends it; the answer to this request is not awaited.
        yield* Effect.forkDetach(
          session.rpc
            .request("turn/interrupt", { threadId: session.codexThreadId, turnId: turn.codexTurnId })
            .pipe(Effect.ignore),
        );
        turn.interruptTimer = setTimeout(
          () => Queue.offerUnsafe(session.rpc.incoming, { _tag: "Timer", name: "interrupt" }),
          interruptGraceMillis,
        );
        return true;
      });

    return { interrupt, runTurn, steer } satisfies HarnessAdapter;
  });
