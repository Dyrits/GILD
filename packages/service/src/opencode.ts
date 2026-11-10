import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TokenUsage } from "@gild/contracts";
import { Deferred, type Duration, Effect, Option, Queue, Result } from "effect";
import {
  HarnessFailure,
  type HarnessPrompt,
  type PromptAnswer,
  readImages,
  type ThreadAccess,
  type TurnRequest,
  turnMessageOf,
} from "./execution.ts";
import { isInsideFolder } from "./folders.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import {
  type HarnessConnection,
  type HarnessProtocol,
  makeHarnessProcesses,
  type PooledTurn,
} from "./harnessProcesses.ts";
import { approvalInstructionsOf } from "./instructions.ts";
import {
  countOf,
  fieldOf,
  harnessEnvironmentOf,
  type Incoming,
  type RpcProcess,
  startRpcProcess,
  textFieldOf,
} from "./lineProcess.ts";
import { toolServerName } from "./mcp.ts";

// OpenCode through the Agent Client Protocol (ADR 0008; `opencode acp` of OpenCode 2.2.0, probed 2026-11-07):
// one process per thread, one ACP session per Gild thread.

/** How the OpenCode adapter starts its harness. */
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

interface OpenCodeConnection extends HarnessConnection {
  readonly rpc: RpcProcess;
}

/** The longest timer Node allows, in milliseconds: a question waits with no time limit. */
const noTimeLimit = 2147483647;

/**
 * OpenCode's permissions (CHG-0031, CHG-0035). OpenCode has no sandbox here, so every command and edit asks
 * Gild: a command runs unasked unless it is sensitive, and an edit unless it leaves the thread's folder or
 * the level is "Also commands and edits" (`isUnaskedEdit`). Its own subagents stay off: threads open threads
 * with open_thread (ADR 0007).
 */
const permissions = [
  { action: "shell", effect: "ask", resource: "*" },
  { action: "edit", effect: "ask", resource: "*" },
  { action: "subagent", effect: "deny", resource: "*" },
];

/** The configuration OpenCode adds to the owner's own: Gild's tools, permissions, and starting context. */
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
  permissions,
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

/** The harness tool and input the owner is asked about for one of OpenCode's permission requests. */
const promptOf = (toolCall: unknown) => {
  const kind = textFieldOf(toolCall, "kind");
  const title = textFieldOf(toolCall, "title") ?? "a tool";
  const input = fieldOf(toolCall, "rawInput");
  if (kind === "execute") return { input: { command: textFieldOf(input, "command") ?? title }, toolName: "Bash" };
  // The owner sees the first file in full: OpenCode resolves the locations, while its input keeps the
  // model's own, possibly relative, path.
  if (kind === "edit") return { input: { file_path: editedPathsOf(toolCall)[0] ?? title }, toolName: "Edit" };
  return { input: input ?? { query: title }, toolName: textFieldOf(toolCall, "name") ?? title };
};

/** The paths listed under a field holding an array of objects with a `path`, such as `locations` or `content`. */
const listedPathsOf = (toolCall: unknown, key: string) => {
  const items = fieldOf(toolCall, key);
  return Array.isArray(items) ? items.map((item) => textFieldOf(item, "path")) : [];
};

/**
 * Every file an edit names. OpenCode 2.2.0, probed live on 2026-11-08, sends `locations` and `content` diffs
 * with absolute paths and `rawInput.path` as the model wrote it; `filePath` is kept for older versions.
 */
const editedPathsOf = (toolCall: unknown) => {
  const input = fieldOf(toolCall, "rawInput");
  return [
    ...listedPathsOf(toolCall, "locations"),
    ...listedPathsOf(toolCall, "content"),
    textFieldOf(input, "path"),
    textFieldOf(input, "filePath"),
  ].filter((path) => path !== null);
};

/**
 * Whether an edit runs without asking: at the default level, editing inside the thread's folder does, as Claude
 * Code and Codex allow it in their sandbox; editing outside it asks (workspace-attachment). An edit naming no file
 * asks.
 */
const isUnaskedEdit = (request: TurnRequest, toolCall: unknown) =>
  Effect.gen(function* () {
    if (request.access.approvalLevel !== "RiskyOnly" || textFieldOf(toolCall, "kind") !== "edit") return false;
    const paths = editedPathsOf(toolCall);
    if (paths.length === 0) return false;
    for (const path of paths) if (!(yield* isInsideFolder(request.cwd, path))) return false;
    return true;
  });

/** The refused action, named for the model: the command, the file, or the tool. */
const refusedActionOf = (prompt: HarnessPrompt) => {
  const command = textFieldOf(prompt.input, "command");
  if (prompt.toolName === "Bash" && command !== null) return `the command \`${command}\``;
  const path = textFieldOf(prompt.input, "file_path");
  if (prompt.toolName === "Edit" && path !== null) return `the change to \`${path}\``;
  return `the tool ${prompt.toolName}`;
};

/** What the next prompt tells OpenCode about one refused action: what was refused and the owner's answer. */
const refusalOf = (prompt: HarnessPrompt, answer: PromptAnswer) =>
  `Gild refused ${refusedActionOf(prompt)}. ${answer.text}`;

/** What a prompt's input, cached input, and output held, or null when it reported no usage. */
const contextOf = (usage: TokenUsage | null) =>
  usage === null ? null : usage.input + usage.cacheRead + usage.cacheCreation + usage.output;

/** Sums the usage of the prompts of one turn; unknown when none reported any. */
const addUsage = (total: TokenUsage | null, usage: TokenUsage | null): TokenUsage | null =>
  total === null || usage === null
    ? (total ?? usage)
    : {
        cacheCreation: total.cacheCreation + usage.cacheCreation,
        cacheRead: total.cacheRead + usage.cacheRead,
        input: total.input + usage.input,
        output: total.output + usage.output,
      };

/**
 * Answers one of OpenCode's permission requests, asking the owner unless it may run; it may wait without a time
 * limit. A refusal is added to `refusals` before OpenCode hears it.
 */
const answerRequest = (
  connection: OpenCodeConnection,
  request: TurnRequest,
  incoming: Extract<Incoming, { _tag: "Request" }>,
  refusals: Array<string>,
) =>
  Effect.gen(function* () {
    if (incoming.method !== "session/request_permission")
      return connection.rpc.respondError(incoming.id, `Gild does not answer ${incoming.method}.`);
    const toolCall = fieldOf(incoming.params, "toolCall");
    let isAllowed = yield* isUnaskedEdit(request, toolCall);
    if (!isAllowed) {
      const prompt = promptOf(toolCall);
      const answer = yield* request.askOwner(prompt);
      isAllowed = answer.isAllowed;
      if (!isAllowed) refusals.push(refusalOf(prompt, answer));
    }
    const wanted = isAllowed ? "allow_once" : "reject_once";
    const offered = fieldOf(incoming.params, "options");
    const option = Array.isArray(offered)
      ? offered.find((candidate) => textFieldOf(candidate, "kind") === wanted)
      : undefined;
    const optionId = textFieldOf(option, "optionId");
    connection.rpc.respond(
      incoming.id,
      optionId === null ? { outcome: { outcome: "cancelled" } } : { outcome: { optionId, outcome: "selected" } },
    );
  });

/**
 * Runs one turn as OpenCode prompts. OpenCode 2.2.0 cancels its whole prompt when a permission is rejected, and
 * ACP carries no message with a rejection (probed 2026-11-08; its `continue_loop_on_deny` setting is gone): the
 * refusals then start another prompt, so the thread carries on without the action as on the other harnesses
 * (action-approval, Asking). An interrupt ends the turn instead.
 */
const runPrompts = (connection: OpenCodeConnection, request: TurnRequest, turn: PooledTurn) =>
  Effect.gen(function* () {
    const refusals: Array<string> = [];
    let text = turnMessageOf(request);
    let usage: TokenUsage | null = null;
    for (;;) {
      const end = yield* readPrompt(connection, request, turn, text, refusals);
      usage = addUsage(usage, end.usage);
      turn.reportUsage(usage);
      if (!end.isCancelled || refusals.length === 0 || turn.isInterrupting())
        // The latest prompt's own usage stands for the context: the sum covers every prompt of the turn.
        return { context: contextOf(end.usage), isInterrupted: end.isCancelled, usage };
      text = refusals.splice(0).join("\n");
    }
  });

/** Reads one prompt's updates until its answer, saying whether OpenCode cancelled it. */
const readPrompt = (
  connection: OpenCodeConnection,
  request: TurnRequest,
  turn: PooledTurn,
  text: string,
  refusals: Array<string>,
) =>
  Effect.gen(function* () {
    const answer = yield* Deferred.make<Result.Result<unknown, HarnessFailure>>();
    // The turn's images go with its first prompt only: a later prompt carries the refusals as text.
    const images = text === turnMessageOf(request) ? yield* readImages(request.images) : [];
    yield* Effect.forkChild(
      connection.rpc
        .request("session/prompt", {
          prompt: [
            { text, type: "text" },
            ...images.map((image) => ({ data: image.data, mimeType: image.mediaType, type: "image" })),
          ],
          sessionId: connection.sessionId,
        })
        .pipe(
          Effect.result,
          Effect.flatMap((result) => Deferred.succeed(answer, result)),
        ),
    );

    let draft = "";
    /** A reply is complete once OpenCode moves on from writing it, such as to a tool call. */
    const finishDraft = Effect.suspend(() => {
      const text = draft;
      draft = "";
      return text.trim() === "" ? Effect.void : request.onEvent({ _tag: "Reply", text });
    });
    const read = (incoming: Incoming) =>
      Effect.gen(function* () {
        if (incoming._tag === "Exit") return yield* new HarnessFailure({ reason: incoming.reason });
        if (incoming._tag === "Request")
          return yield* turn.fork(answerRequest(connection, request, incoming, refusals));
        if (incoming.method !== "session/update") return;
        if (textFieldOf(incoming.params, "sessionId") !== connection.sessionId) return;
        const update = fieldOf(incoming.params, "update");
        const kind = textFieldOf(update, "sessionUpdate");
        if (kind === "agent_message_chunk") {
          draft += textFieldOf(fieldOf(update, "content"), "text") ?? "";
          yield* request.onEvent({ _tag: "Draft", text: draft });
        } else if (kind === "tool_call") {
          yield* finishDraft;
        }
      });

    for (;;) {
      const next = yield* Effect.raceFirst(
        Queue.take(connection.rpc.incoming).pipe(Effect.map(Option.some)),
        Deferred.await(answer).pipe(Effect.as(Option.none<Incoming>())),
      );
      if (Option.isSome(next)) {
        yield* read(next.value);
        continue;
      }
      // The answer arrives after the updates sent before it, which are read first.
      for (const incoming of yield* Queue.clear(connection.rpc.incoming)) yield* read(incoming);
      yield* finishDraft;
      const result = yield* Deferred.await(answer);
      if (Result.isFailure(result)) return yield* result.failure;
      const stopReason = textFieldOf(result.success, "stopReason");
      return { isCancelled: stopReason === "cancelled", usage: usageOf(fieldOf(result.success, "usage")) };
    }
  });

/** OpenCode's ACP protocol: one ACP session per Gild thread, one prompt per turn. */
const openCodeProtocolOf = (options: OpenCodeOptions): HarnessProtocol<OpenCodeConnection> => {
  const instructionsFolder = options.instructionsFolder ?? join(tmpdir(), "gild-opencode");

  /** The starting context and approval rules, as the file OpenCode reads them from. */
  const writeInstructions = (request: TurnRequest) =>
    Effect.sync(() => {
      mkdirSync(instructionsFolder, { recursive: true });
      const path = join(instructionsFolder, `${request.threadId}.md`);
      writeFileSync(path, `${request.context}\n\n${approvalInstructionsOf(request.access, false, "opencode")}\n`);
      return path;
    });

  /** Opens the thread's ACP session, or loads it again, on a started process. */
  const openSession = (rpc: RpcProcess, request: TurnRequest) =>
    Effect.gen(function* () {
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
    });

  return {
    interrupt: (connection) =>
      Effect.sync(() => {
        connection.rpc.notify("session/cancel", { sessionId: connection.sessionId });
        return true;
      }),

    // A changed level, set of permissions, context, model, folder, or account restarts the process, loading
    // its session; OpenCode takes no effort.
    restartKeyOf: (request) =>
      JSON.stringify([request.context, request.access, request.configDirectory, request.model, request.cwd]),

    runTurn: runPrompts,

    start: (request) =>
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
        const sessionId = yield* openSession(rpc, request).pipe(Effect.tapError(() => Effect.sync(() => rpc.close())));
        if (sessionId === null) {
          rpc.close();
          return yield* new HarnessFailure({ reason: "OpenCode started no session." });
        }
        if (request.model !== "default") {
          yield* rpc.request("session/set_config_option", { configId: "model", sessionId, value: request.model }).pipe(
            Effect.tapError(() => Effect.sync(() => rpc.close())),
            Effect.mapError(
              (failure) =>
                new HarnessFailure({ reason: `OpenCode refused the model ${request.model}: ${failure.reason}` }),
            ),
          );
        }
        return { close: rpc.close, hasExited: rpc.hasExited, rpc, sessionId } satisfies OpenCodeConnection;
      }),

    /** ACP takes no message into a running prompt: a steered message waits for the next turn. */
    steer: () => Effect.succeed(false),
  };
};

/** Runs each thread in one long-lived `opencode acp` process, closed with the scope that made it. */
export const makeOpenCodeHarness = (options: OpenCodeOptions) =>
  makeHarnessProcesses(openCodeProtocolOf(options), options);
