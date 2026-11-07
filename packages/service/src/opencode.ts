import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TokenUsage } from "@openmission/contracts";
import { Duration, Effect, Fiber, Queue, type Result } from "effect";
import { harnessEnvironmentOf } from "./claude.ts";
import {
  callThreadTool,
  type HarnessAdapter,
  type HarnessEvent,
  HarnessFailure,
  type ThreadAccess,
  type TurnRequest,
} from "./execution.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import { approvalInstructionsOf } from "./instructions.ts";
import { toolServerName } from "./mcp.ts";
import { countOf, fieldOf, isPromptAllowed, type RpcProcess, startRpcProcess, textFieldOf } from "./rpcProcess.ts";

// OpenCode through the Agent Client Protocol (ADR 0008; `opencode acp` of OpenCode 2.2.0, probed 2026-11-07):
// one process per thread, one ACP session per OpenMission thread.

export interface OpenCodeOptions {
  /** The executable; `opencode` on the PATH by default. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Where each thread's starting context is written for OpenCode to read as instructions; the system's temporary folder by default. */
  readonly instructionsFolder?: string;
  /** Arguments placed before `acp`, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
}

interface RunningTurn {
  interruptTimer: ReturnType<typeof setTimeout> | null;
  isInterrupting: boolean;
}

interface Session {
  readonly acpSessionId: string;
  idleTimer: ReturnType<typeof setTimeout> | null;
  readonly rpc: RpcProcess;
  /** The settings the process started with; a change restarts it on the next turn. */
  readonly signature: string;
  turn: RunningTurn | null;
}

/** How long OpenCode has to end a cancelled turn before its process is closed, as for Claude Code (CHG-0039). */
const interruptGraceMillis = 10_000;

/** The longest timer Node allows, in milliseconds: a question waits with no time limit. */
const noTimeLimit = 2147483647;

/**
 * OpenCode's permissions, by approval level (CHG-0031, CHG-0035). OpenCode has no sandbox here, so every
 * command asks OpenMission, which lets it run unasked unless it is sensitive; at "Also commands and edits"
 * edits ask too. Its own subagents stay off: threads open threads with open_thread (ADR 0007).
 */
const permissionsOf = (access: ThreadAccess) => [
  { action: "shell", effect: "ask", resource: "*" },
  { action: "edit", effect: access.approvalLevel === "RiskyOnly" ? "allow" : "ask", resource: "*" },
  { action: "subagent", effect: "deny", resource: "*" },
];

/** The configuration OpenCode adds to the owner's own: OpenMission's tools, permissions, and starting context. */
const configOf = (access: ThreadAccess, instructionsPath: string) => ({
  instructions: [instructionsPath],
  mcp: {
    servers: {
      [toolServerName]: {
        timeout: { catalog: 30_000, execution: noTimeLimit, startup: 30_000 },
        type: "remote",
        url: access.mcpUrl,
      },
    },
  },
  permissions: permissionsOf(access),
});

/** A turn's usage from the prompt's answer, whose input excludes the cached part. */
const usageOf = (usage: unknown): TokenUsage | null =>
  usage === undefined || usage === null
    ? null
    : {
        cacheCreation: countOf(usage, "cachedWriteTokens"),
        cacheRead: countOf(usage, "cachedReadTokens"),
        input: countOf(usage, "inputTokens"),
        output: countOf(usage, "outputTokens") + countOf(usage, "thoughtTokens"),
      };

/** The harness tool and input `answer_prompt` judges for one of OpenCode's permission requests. */
const promptOf = (toolCall: unknown) => {
  const kind = textFieldOf(toolCall, "kind");
  const title = textFieldOf(toolCall, "title") ?? "a tool";
  const input = fieldOf(toolCall, "rawInput");
  if (kind === "execute") return { input: { command: textFieldOf(input, "command") ?? title }, toolName: "Bash" };
  if (kind === "edit") {
    const locations = fieldOf(toolCall, "locations");
    const path =
      textFieldOf(input, "filePath") ?? (Array.isArray(locations) ? textFieldOf(locations[0], "path") : null) ?? title;
    return { input: { file_path: path }, toolName: "Edit" };
  }
  return { input: input ?? { query: title }, toolName: textFieldOf(toolCall, "name") ?? title };
};

/** Runs each thread in one long-lived `opencode acp` process. */
export const makeOpenCodeHarness = (options: OpenCodeOptions) =>
  Effect.gen(function* () {
    const sessions = new Map<string, Session>();
    const idleMillis = Duration.toMillis(Duration.fromInputUnsafe(options.idleTimeout));
    const instructionsFolder = options.instructionsFolder ?? join(tmpdir(), "openmission-opencode");

    const close = (threadId: string) => {
      const session = sessions.get(threadId);
      if (session === undefined) return;
      sessions.delete(threadId);
      if (session.idleTimer !== null) clearTimeout(session.idleTimer);
      if (session.turn?.interruptTimer != null) clearTimeout(session.turn.interruptTimer);
      session.rpc.close();
    };
    yield* Effect.addFinalizer(() => Effect.sync(() => [...sessions.keys()].forEach(close)));

    /** The starting context and approval rules, as the file OpenCode reads them from. */
    const writeInstructions = (request: TurnRequest) =>
      Effect.sync(() => {
        mkdirSync(instructionsFolder, { recursive: true });
        const path = join(instructionsFolder, `${request.threadId}.md`);
        writeFileSync(path, `${request.context}\n\n${approvalInstructionsOf(request.access, false, "opencode")}\n`);
        return path;
      });

    const start = (request: TurnRequest, signature: string) =>
      Effect.gen(function* () {
        const instructionsPath = yield* writeInstructions(request);
        const rpc = yield* startRpcProcess({
          args: [...(options.prefixArgs ?? []), "acp"],
          command: options.command,
          cwd: request.cwd,
          env: harnessEnvironmentOf({
            ...accountEnvironmentOf("opencode", request.configDirectory),
            OPENCODE_CONFIG_CONTENT: JSON.stringify(configOf(request.access, instructionsPath)),
          }),
          isJsonRpc2: true,
          label: "OpenCode",
        });
        const acpSessionId = yield* Effect.gen(function* () {
          yield* rpc.request("initialize", {
            clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
            protocolVersion: 1,
          });
          if (request.sessionId !== null) {
            // Loading replays the conversation as updates, which are not this turn's: they are dropped.
            yield* rpc.request("session/load", { cwd: request.cwd, mcpServers: [], sessionId: request.sessionId });
            yield* Queue.clear(rpc.incoming);
            return request.sessionId;
          }
          const created = yield* rpc.request("session/new", { cwd: request.cwd, mcpServers: [] });
          return textFieldOf(created, "sessionId");
        }).pipe(Effect.tapError(() => Effect.sync(() => rpc.close())));
        if (acpSessionId === null) {
          rpc.close();
          return yield* new HarnessFailure({ reason: "OpenCode started no session." });
        }
        if (request.model !== "default") {
          yield* rpc
            .request("session/set_config_option", { configId: "model", sessionId: acpSessionId, value: request.model })
            .pipe(
              Effect.tapError(() => Effect.sync(() => rpc.close())),
              Effect.mapError(
                (failure) =>
                  new HarnessFailure({ reason: `OpenCode refused the model ${request.model}: ${failure.reason}` }),
              ),
            );
        }
        const session: Session = { acpSessionId, idleTimer: null, rpc, signature, turn: null };
        sessions.set(request.threadId, session);
        return session;
      });

    /** Answers one of OpenCode's permission requests through OpenMission's prompt tool; it may wait on the owner. */
    const answerRequest = (
      session: Session,
      request: TurnRequest,
      incoming: { readonly id: number | string; readonly method: string; readonly params: unknown },
    ) =>
      Effect.gen(function* () {
        if (incoming.method !== "session/request_permission")
          return session.rpc.respondError(incoming.id, `OpenMission does not answer ${incoming.method}.`);
        const { input, toolName } = promptOf(fieldOf(incoming.params, "toolCall"));
        const answer = yield* callThreadTool(request.access.mcpUrl, "answer_prompt", { input, tool_name: toolName });
        const wanted = isPromptAllowed(answer) ? "allow_once" : "reject_once";
        const offered = fieldOf(incoming.params, "options");
        const option = Array.isArray(offered)
          ? offered.find((candidate) => textFieldOf(candidate, "kind") === wanted)
          : undefined;
        const optionId = textFieldOf(option, "optionId");
        session.rpc.respond(
          incoming.id,
          optionId === null ? { outcome: { outcome: "cancelled" } } : { outcome: { optionId, outcome: "selected" } },
        );
      });

    const runTurn = (request: TurnRequest) =>
      Effect.gen(function* () {
        const signature = JSON.stringify([
          request.context,
          request.access,
          request.configDirectory,
          request.model,
          request.cwd,
        ]);
        const existing = sessions.get(request.threadId);
        // A changed level, set of permissions, context, or model restarts the process, loading its session.
        if (existing !== undefined && (existing.signature !== signature || existing.rpc.hasExited()))
          close(request.threadId);
        const session = sessions.get(request.threadId) ?? (yield* start(request, signature));
        if (session.idleTimer !== null) clearTimeout(session.idleTimer);
        const turn: RunningTurn = { interruptTimer: null, isInterrupting: false };
        session.turn = turn;
        const content = request.note === null ? request.text : `${request.note}\n\n${request.text}`;

        // The prompt's answer arrives when the turn ends; meanwhile its updates are read below.
        const answer: { result: Result.Result<unknown, HarnessFailure> | null } = { result: null };
        const prompted = yield* Effect.forkChild(
          session.rpc
            .request("session/prompt", { prompt: [{ text: content, type: "text" }], sessionId: session.acpSessionId })
            .pipe(
              Effect.result,
              Effect.tap((result) =>
                Effect.sync(() => {
                  answer.result = result;
                  Queue.offerUnsafe(session.rpc.incoming, { _tag: "Timer", name: "prompted" });
                }),
              ),
            ),
        );

        const end = (isInterrupted: boolean, usage: TokenUsage | null) => {
          session.turn = null;
          if (turn.interruptTimer !== null) clearTimeout(turn.interruptTimer);
          session.idleTimer = setTimeout(() => close(request.threadId), idleMillis);
          return { cost: null, isInterrupted, sessionId: session.acpSessionId, usage };
        };

        let draft = "";
        /** A reply is complete once OpenCode moves on from writing it, such as to a tool call. */
        const finishDraft = (onEvent: (event: HarnessEvent) => Effect.Effect<void>) =>
          Effect.gen(function* () {
            const text = draft;
            draft = "";
            if (text.trim() !== "") yield* onEvent({ _tag: "Reply", text });
          });

        for (;;) {
          const incoming = yield* Queue.take(session.rpc.incoming);
          if (incoming._tag === "Exit") {
            yield* Fiber.interrupt(prompted);
            close(request.threadId);
            if (turn.isInterrupting)
              return { cost: null, isInterrupted: true, sessionId: session.acpSessionId, usage: null };
            return yield* new HarnessFailure({ reason: incoming.reason });
          }
          if (incoming._tag === "Timer" && incoming.name === "interrupt") {
            if (!turn.isInterrupting) continue;
            yield* Fiber.interrupt(prompted);
            close(request.threadId);
            return { cost: null, isInterrupted: true, sessionId: session.acpSessionId, usage: null };
          }
          if (incoming._tag === "Timer") {
            yield* finishDraft(request.onEvent);
            const result = answer.result;
            if (result === null) continue;
            if (result._tag === "Failure") {
              close(request.threadId);
              if (turn.isInterrupting)
                return { cost: null, isInterrupted: true, sessionId: session.acpSessionId, usage: null };
              return yield* result.failure;
            }
            const stopReason = textFieldOf(result.success, "stopReason");
            return end(stopReason === "cancelled" || turn.isInterrupting, usageOf(fieldOf(result.success, "usage")));
          }
          if (incoming._tag === "Request") {
            yield* Effect.forkChild(answerRequest(session, request, incoming));
            continue;
          }
          if (incoming.method !== "session/update") continue;
          if (textFieldOf(incoming.params, "sessionId") !== session.acpSessionId) continue;
          const update = fieldOf(incoming.params, "update");
          const kind = textFieldOf(update, "sessionUpdate");
          if (kind === "agent_message_chunk") {
            draft += textFieldOf(fieldOf(update, "content"), "text") ?? "";
            yield* request.onEvent({ _tag: "Draft", text: draft });
          } else if (kind === "tool_call") {
            yield* finishDraft(request.onEvent);
          }
        }
      }).pipe(Effect.onInterrupt(() => Effect.sync(() => close(request.threadId))));

    /** ACP takes no message into a running prompt: a steered message waits for the next turn. */
    const steer = () => Effect.succeed(false);

    const interrupt = (threadId: string) =>
      Effect.sync(() => {
        const session = sessions.get(threadId);
        const turn = session?.turn ?? null;
        if (session === undefined || turn === null || session.rpc.hasExited()) return false;
        if (turn.isInterrupting) return true;
        turn.isInterrupting = true;
        session.rpc.notify("session/cancel", { sessionId: session.acpSessionId });
        turn.interruptTimer = setTimeout(
          () => Queue.offerUnsafe(session.rpc.incoming, { _tag: "Timer", name: "interrupt" }),
          interruptGraceMillis,
        );
        return true;
      });

    return { interrupt, runTurn, steer } satisfies HarnessAdapter;
  });
