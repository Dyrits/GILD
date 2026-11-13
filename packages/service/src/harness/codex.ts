import { tmpdir } from "node:os";
import type { BillingKind, EffortChoice, HarnessName, TokenUsage } from "@iskios/contracts";
import { type Duration, Effect, Queue } from "effect";
import {
  type Containment,
  fieldOf,
  HarnessFailure,
  type ImageAttachment,
  numberFieldOf,
  type PlanLimitsReport,
  type ThreadAccess,
  type TurnRequest,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import {
  type HarnessConnection,
  type HarnessProtocol,
  makeHarnessProcesses,
  type PooledTurn,
} from "./harnessProcesses.ts";
import { approvalInstructionsOf } from "./instructions.ts";
import { harnessEnvironmentOf, type Incoming, type RpcProcess, startRpcProcess } from "./lineProcess.ts";
import { resolvedFolderOf, startFolderOf } from "./threadFolder.ts";
import { toolServerName } from "./toolNames.ts";

// Codex through its app server (ADR 0008; protocol of codex-cli 0.160.1, probed 2026-11-07): one
// `codex app-server` process per thread, one Codex thread per Iskios thread.

/** How the Codex adapter starts its harness. */
export interface CodexOptions {
  /** The executable; `codex` on the PATH by default. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before the app server's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
}

interface CodexConnection extends HarnessConnection {
  /** How the account is billed, from Codex's own `account/read` at start; Unknown when it did not say. */
  readonly billing: BillingKind;
  readonly rpc: RpcProcess;
  /** Codex's id of the running turn, once Codex started it; null between turns. */
  turnId: string | null;
}

/** The longest wait Codex accepts for a thread tool, in seconds: a question waits with no time limit. */
const noTimeLimitSeconds = 2_147_483;

/** Codex's own effort names; Iskios's match them, and default leaves the model's own. */
const effortOf = (effort: EffortChoice) => (effort === "default" ? null : effort);

/**
 * How Codex asks, by approval level (CHG-0031, CHG-0208). Commands always run in Codex's own workspace sandbox, never
 * its full-access mode. At the default level they ask only to leave it, and every such request asks the owner with
 * the exact command. At "Also commands and edits" every command it does not trust asks.
 */
const policyOf = (access: ThreadAccess) => ({
  approvalPolicy: access.approvalLevel === "RiskyOnly" ? "on-request" : "untrusted",
  sandbox: "workspace-write",
});

/** The thread's settings: its tools at its own endpoint, no native subagents, and Iskios's context. */
/** A turn's input: the text, then one `localImage` item per image, by the stored path (message-attachments). */
const inputOf = (text: string, images: ReadonlyArray<ImageAttachment>) => [
  { text, text_elements: [], type: "text" },
  ...images.map((image) => ({ path: image.path, type: "localImage" })),
];

const threadSettingsOf = (request: TurnRequest, cwd: string) => ({
  ...policyOf(request.access),
  config: {
    // One thread is one Codex conversation; threads open threads with open_thread instead (ADR 0007).
    "features.multi_agent": false,
    [`mcp_servers.${toolServerName}.tool_timeout_sec`]: noTimeLimitSeconds,
    [`mcp_servers.${toolServerName}.url`]: request.access.mcpUrl,
    // The starting context already holds the folder's own instructions (workspaces.ts).
    project_doc_max_bytes: 0,
    // The sandbox contains file and process damage, not data: its network is open, so a command can reach any host
    // (verified with command/exec on Codex 0.167.2, 2026-11-12).
    "sandbox_workspace_write.network_access": true,
  },
  cwd,
  developerInstructions: `${request.context}\n\n${approvalInstructionsOf(request.access, false, "codex")}`,
  ...(request.model === "default" ? {} : { model: request.model }),
});

/** A turn's usage from Codex's per-call counts, whose input includes the cached part. */
const usageOf = (calls: ReadonlyArray<unknown>): TokenUsage | null => {
  if (calls.length === 0) return null;
  const sum = (key: string) => calls.reduce<number>((total, call) => total + numberFieldOf(call, key), 0);
  return {
    cacheCreation: sum("cacheWriteInputTokens"),
    cacheRead: sum("cachedInputTokens"),
    input: Math.max(0, sum("inputTokens") - sum("cachedInputTokens") - sum("cacheWriteInputTokens")),
    output: sum("outputTokens"),
  };
};

/** What the thread's context held after the latest call, whose input includes the cached part. */
const contextOf = (calls: ReadonlyArray<unknown>): number | null => {
  const last = calls.at(-1);
  return last === undefined ? null : numberFieldOf(last, "inputTokens") + numberFieldOf(last, "outputTokens");
};

/**
 * How Codex's account is billed, from its own `account/read`: a ChatGPT sign-in is a subscription and an API key is
 * an API key. A server that does not answer in a few seconds, or answers otherwise, says Unknown (probe of 2026-11-11, Codex 0.167).
 */
const billingOf = (rpc: RpcProcess): Effect.Effect<BillingKind> =>
  rpc.request("account/read", { refreshToken: false }).pipe(
    Effect.timeout("5 seconds"),
    Effect.map((result): BillingKind => {
      const type = textFieldOf(fieldOf(result, "account"), "type");
      return type === "chatgpt" ? "Subscription" : type === "apiKey" ? "ApiKey" : "Unknown";
    }),
    Effect.catch(() => Effect.succeed<BillingKind>("Unknown")),
  );

/** A window of Codex's rate limits as reported, or none when it carries no use. */
const windowOf = (window: unknown) =>
  typeof fieldOf(window, "usedPercent") === "number" && typeof fieldOf(window, "windowDurationMins") === "number"
    ? [
        {
          resetsAtSeconds: numberFieldOf(window, "resetsAt"),
          usedPercent: numberFieldOf(window, "usedPercent"),
          windowMinutes: numberFieldOf(window, "windowDurationMins"),
        },
      ]
    : [];

/**
 * The limits of the plan behind an account, asked of a short `codex app-server` run in the account's own folder:
 * `account/rateLimits/read` answers with the plan's windows (probe of 2026-11-11). An API key has no plan limits. Null
 * when Codex cannot answer. The server's own sign-in is used; no token is read here.
 */
const readCodexPlanLimits = (options: CodexOptions, configDirectory: string | null) =>
  Effect.gen(function* () {
    const rpc = yield* startRpcProcess({
      args: [...(options.prefixArgs ?? []), "app-server"],
      command: options.command,
      cwd: tmpdir(),
      env: harnessEnvironmentOf(accountEnvironmentOf("codex", configDirectory)),
      isJsonRpc2: false,
      label: "Codex",
    });
    return yield* Effect.gen(function* () {
      yield* rpc.request("initialize", {
        capabilities: { experimentalApi: true, requestAttestation: false },
        clientInfo: { name: "iskios", title: "Iskios", version: "0.0.0" },
      });
      rpc.notify("initialized", {});
      const billing = yield* billingOf(rpc);
      if (billing === "ApiKey") return { billing, windows: [] } satisfies PlanLimitsReport;
      const limits = fieldOf(yield* rpc.request("account/rateLimits/read", {}), "rateLimits");
      return {
        billing,
        windows: [...windowOf(fieldOf(limits, "primary")), ...windowOf(fieldOf(limits, "secondary"))],
      } satisfies PlanLimitsReport;
    }).pipe(
      Effect.timeout("15 seconds"),
      Effect.mapError((error) => new HarnessFailure({ reason: `Codex gave no plan limits: ${String(error)}` })),
      Effect.ensuring(Effect.sync(() => rpc.close())),
    );
  });

/** The files of a file change item, for its approval question. */
const changedPathsOf = (item: unknown) => {
  const changes = fieldOf(item, "changes");
  return Array.isArray(changes) ? changes.flatMap((change) => textFieldOf(change, "path") ?? []) : [];
};

/** Answers one of Codex's own requests, which may wait on the owner without a time limit. */
const answerRequest = (
  connection: CodexConnection,
  request: TurnRequest,
  incoming: Extract<Incoming, { _tag: "Request" }>,
  fileChanges: Map<string, ReadonlyArray<string>>,
) =>
  Effect.gen(function* () {
    const { id, method, params } = incoming;
    const { rpc } = connection;
    // At the default level Codex asks only to go beyond its sandbox, so each of its requests is an escape. At "Also
    // commands and edits" it asks before commands it does not trust, which run inside the sandbox once allowed.
    const isEscape = request.access.approvalLevel === "RiskyOnly";
    const ask = (toolName: string, input: object) =>
      request
        .askOwner({ input, ...(isEscape ? { isOutsideSandbox: true } : {}), toolName })
        .pipe(Effect.map((answer) => answer.isAllowed));
    if (method === "item/commandExecution/requestApproval") {
      const isAllowed = yield* ask("Bash", {
        command: textFieldOf(params, "command") ?? "",
        description: textFieldOf(params, "reason") ?? "",
      });
      return rpc.respond(id, { decision: isAllowed ? "accept" : "decline" });
    }
    if (method === "item/fileChange/requestApproval") {
      const paths = fileChanges.get(textFieldOf(params, "itemId") ?? "") ?? [];
      const isAllowed = yield* ask("Edit", {
        description: textFieldOf(params, "reason") ?? "",
        file_path: paths.join(", ") || (textFieldOf(params, "grantRoot") ?? "a file"),
      });
      return rpc.respond(id, { decision: isAllowed ? "accept" : "decline" });
    }
    if (method === "item/permissions/requestApproval") {
      const isAllowed = yield* ask("Permissions", {
        description: textFieldOf(params, "reason") ?? "Widen the sandbox",
        query: JSON.stringify(fieldOf(params, "permissions") ?? {}),
      });
      return rpc.respond(id, { permissions: isAllowed ? (fieldOf(params, "permissions") ?? {}) : {}, scope: "turn" });
    }
    // Iskios's own tools need no confirmation; another server's question is declined.
    if (method === "mcpServer/elicitation/request") {
      const isOwn = textFieldOf(params, "serverName") === toolServerName;
      return rpc.respond(id, { _meta: null, action: isOwn ? "accept" : "decline", content: null });
    }
    if (method === "item/tool/requestUserInput") return rpc.respond(id, { answers: {} });
    return rpc.respondError(id, `Iskios does not answer ${method}.`);
  });

/** Reads Codex's notifications for one turn until its completion. */
const readTurn = (connection: CodexConnection, request: TurnRequest, turn: PooledTurn, codexTurnId: string) =>
  Effect.gen(function* () {
    const calls: Array<unknown> = [];
    const fileChanges = new Map<string, ReadonlyArray<string>>();
    let draft = "";
    for (;;) {
      const incoming = yield* Queue.take(connection.rpc.incoming);
      if (incoming._tag === "Exit") return yield* new HarnessFailure({ reason: incoming.reason });
      if (incoming._tag === "Request") {
        // Answered beside the turn: a question may wait on the owner while events keep coming.
        yield* turn.fork(answerRequest(connection, request, incoming, fileChanges));
        continue;
      }
      const { method, params } = incoming;
      if (textFieldOf(params, "threadId") !== connection.sessionId) continue;
      const item = fieldOf(params, "item");
      const itemType = textFieldOf(item, "type");
      if (method === "item/started" && itemType === "userMessage") {
        const clientId = textFieldOf(item, "clientId");
        if (clientId !== null) yield* turn.deliver(clientId);
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
        turn.reportUsage(usageOf(calls));
      } else if (method === "turn/completed") {
        const completed = fieldOf(params, "turn");
        if (textFieldOf(completed, "id") !== codexTurnId) continue;
        const status = textFieldOf(completed, "status");
        if (status === "interrupted" || turn.isInterrupting())
          return { billing: connection.billing, context: contextOf(calls), isInterrupted: true, usage: usageOf(calls) };
        if (status === "failed") {
          return yield* new HarnessFailure({
            reason: textFieldOf(fieldOf(completed, "error"), "message") ?? "Codex reported a failed turn.",
          });
        }
        return { billing: connection.billing, context: contextOf(calls), isInterrupted: false, usage: usageOf(calls) };
      }
    }
  });

/** Asks Codex to end its turn; the turn's own completion, as interrupted, ends it, so the answer is not awaited. */
const askToInterrupt = (connection: CodexConnection, turnId: string) =>
  Effect.forkDetach(
    connection.rpc.request("turn/interrupt", { threadId: connection.sessionId, turnId }).pipe(Effect.ignore),
  );

/** Codex's app-server protocol: one Codex thread per Iskios thread, one Codex turn per turn. */
const codexProtocolOf = (options: CodexOptions): HarnessProtocol<CodexConnection> => ({
  interrupt: (connection) =>
    Effect.gen(function* () {
      // Before Codex answers `turn/start` there is no turn id to name: the turn, which the pool already counts as
      // interrupting, asks for the interrupt as soon as it has the id.
      if (connection.turnId !== null) yield* askToInterrupt(connection, connection.turnId);
      return true;
    }),

  // A changed level, set of permissions, context, model, folder, or account restarts the process, resuming
  // its thread; the effort goes with each turn.
  // Where the folder really points too: a link pointed elsewhere restarts the process, whose start checks it again.
  restartKeyOf: (request) =>
    JSON.stringify([threadSettingsOf(request, request.cwd), request.configDirectory, resolvedFolderOf(request.cwd)]),

  runTurn: (connection, request, turn) =>
    Effect.gen(function* () {
      const effort = effortOf(request.effort);
      connection.turnId = null;
      const started = yield* connection.rpc.request("turn/start", {
        input: inputOf(turnMessageOf(request), request.images),
        threadId: connection.sessionId,
        ...(effort === null ? {} : { effort }),
        ...(request.model === "default" ? {} : { model: request.model }),
      });
      const codexTurnId = textFieldOf(fieldOf(started, "turn"), "id") ?? "";
      connection.turnId = codexTurnId;
      if (turn.isInterrupting()) yield* askToInterrupt(connection, codexTurnId);
      return yield* readTurn(connection, request, turn, codexTurnId).pipe(
        Effect.ensuring(Effect.sync(() => (connection.turnId = null))),
      );
    }),

  start: (request) =>
    Effect.gen(function* () {
      // A thread folder that is a link asks the owner; allowed, Codex starts where it really points, as its process
      // folder and its thread's, so its workspace sandbox writes there (threadFolder.ts). Codex 0.167.2 refuses a
      // writable root holding a link, and treats its process folder, resolved by the system, as writable (CHG-0208).
      const cwd = yield* startFolderOf(request, "Codex");
      const rpc = yield* startRpcProcess({
        args: [...(options.prefixArgs ?? []), "app-server"],
        command: options.command,
        cwd,
        env: harnessEnvironmentOf({ ...accountEnvironmentOf("codex", request.configDirectory), PWD: cwd }),
        isJsonRpc2: false,
        label: "Codex",
      });
      let billing: BillingKind = "Unknown";
      const started = yield* Effect.gen(function* () {
        yield* rpc.request("initialize", {
          capabilities: { experimentalApi: true, requestAttestation: false },
          clientInfo: { name: "iskios", title: "Iskios", version: "0.0.0" },
        });
        rpc.notify("initialized", {});
        const settings = threadSettingsOf(request, cwd);
        billing = yield* billingOf(rpc);
        return request.sessionId === null
          ? yield* rpc.request("thread/start", settings)
          : yield* rpc.request("thread/resume", { ...settings, threadId: request.sessionId });
      }).pipe(Effect.tapError(() => Effect.sync(() => rpc.close())));
      const codexThreadId = textFieldOf(fieldOf(started, "thread"), "id");
      if (codexThreadId === null) {
        rpc.close();
        return yield* new HarnessFailure({ reason: "Codex started no thread." });
      }
      return {
        billing,
        close: rpc.close,
        hasExited: rpc.hasExited,
        rpc,
        sessionId: codexThreadId,
        turnId: null,
      } satisfies CodexConnection;
    }),

  // A message steered mid-turn joins Codex's active turn; its userMessage item, carrying our id as
  // clientId, says it was taken in.
  steer: (connection, message) =>
    Effect.gen(function* () {
      if (connection.turnId === null) return false;
      return yield* connection.rpc
        .request("turn/steer", {
          clientUserMessageId: message.id,
          expectedTurnId: connection.turnId,
          input: inputOf(message.text, message.images),
          threadId: connection.sessionId,
        })
        .pipe(
          Effect.as(true),
          Effect.catch(() => Effect.succeed(false)),
        );
    }),
});

/** Runs each thread in one long-lived `codex app-server` process, closed with the scope that made it. */
export const makeCodexHarness = (options: CodexOptions) =>
  makeHarnessProcesses(codexProtocolOf(options), options).pipe(
    Effect.map((adapter) => ({
      ...adapter,
      // Codex enforces its own workspace sandbox wherever it runs.
      containmentOf: (): Containment => "Sandboxed",
      readPlanLimits: (_harness: HarnessName, configDirectory: string | null) =>
        readCodexPlanLimits(options, configDirectory),
    })),
  );
