import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EffortChoice, TokenUsage } from "@iskios/contracts";
import { Deferred, type Duration, Effect, Option, Queue, Result } from "effect";
import {
  type Containment,
  fieldOf,
  type HarnessAdapter,
  HarnessFailure,
  type HarnessPrompt,
  invalid,
  isInsideFolder,
  numberFieldOf,
  type PlanLimitReport,
  type PlanLimitsReport,
  type PromptAnswer,
  readImages,
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
import {
  type OpenCodeSandbox,
  openCodeEnvironmentOf,
  ownerMarkerOf,
  wrappedCommandOf,
  writableRootsOf,
} from "./openCodeSandbox.ts";
import { prepareOpenCodeSandbox } from "./openCodeSeed.ts";
import { hasExecutorBelow, sweepOrphans } from "./processTree.ts";
import { type FolderEscape, folderEscapeOf, folderProblemOf } from "./threadFolder.ts";
import { toolServerName } from "./toolNames.ts";

// OpenCode through the Agent Client Protocol (ADR 0008; `opencode acp` of OpenCode 2.2.0, probed 2026-11-07):
// one process per thread, one ACP session per Iskios thread.

/**
 * The session option holding the model's effort levels (ACP category `thought_level`, id `effort` in OpenCode 2.2.0),
 * with the levels it offers for the session's current model, without "default"; null when the model has none.
 */
const effortOptionOf = (configOptions: unknown): { id: string; levels: Array<EffortChoice> } | null => {
  if (!Array.isArray(configOptions)) return null;
  const option = configOptions.find((candidate) => textFieldOf(candidate, "category") === "thought_level");
  const id = textFieldOf(option, "id");
  const values = fieldOf(option, "options");
  if (id === null || !Array.isArray(values)) return null;
  return {
    id,
    levels: values.flatMap((value): Array<EffortChoice> => {
      const level = textFieldOf(value, "value");
      return level === null || level === "default" ? [] : [level];
    }),
  };
};

/**
 * The effort levels OpenCode offers for one model: it says them only for a session's current model, so a short-lived
 * ACP session is opened, given the model, and asked, once more when that fails. Empty when OpenCode says the model has
 * none; a failure, which is not an empty answer, when OpenCode could not be asked (timeout, no session).
 */
export const listOpenCodeEfforts = (
  command: string,
  configDirectory: string | null,
  model: string,
  prefixArgs: ReadonlyArray<string> = [],
) =>
  Effect.gen(function* () {
    const rpc = yield* startRpcProcess({
      args: [...prefixArgs, "acp"],
      command,
      cwd: tmpdir(),
      env: harnessEnvironmentOf(accountEnvironmentOf("opencode", configDirectory)),
      isJsonRpc2: true,
      label: "OpenCode",
    });
    return yield* Effect.gen(function* () {
      yield* rpc.request("initialize", {
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        protocolVersion: 1,
      });
      const created = yield* rpc.request("session/new", { cwd: tmpdir(), mcpServers: [] });
      const sessionId = textFieldOf(created, "sessionId");
      if (sessionId === null) return yield* Effect.fail(invalid("OpenCode opened no session."));
      const chosen =
        model === "default"
          ? created
          : yield* rpc.request("session/set_config_option", { configId: "model", sessionId, value: model });
      return effortOptionOf(fieldOf(chosen, "configOptions"))?.levels ?? [];
    }).pipe(Effect.timeout("30 seconds"), Effect.ensuring(Effect.sync(() => rpc.close())));
  }).pipe(
    Effect.retry({ times: 1 }),
    Effect.catch(() => Effect.fail(invalid("OpenCode did not give this model's effort levels. Try again."))),
  );

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
  /**
   * The host's sandbox each thread's `opencode acp` runs in (openCodeSandbox.ts), or null when none can run here:
   * then every action OpenCode asks about asks the owner.
   */
  readonly sandbox?: OpenCodeSandbox | null;
}

interface OpenCodeConnection extends HarnessConnection {
  /**
   * The thread's conversation so far, for the first prompt of a session opened in place of one OpenCode could not
   * load, so the new session knows what the thread was doing; null once given, or when there is none.
   */
  handoverNotes: string | null;
  /**
   * Whether a wrapped OpenCode's executor, the process that runs its commands and edits, is NOT confirmed to descend
   * from the wrapped process, read from the process table at each permission request: an `acp` serving from a
   * process outside its tree. The request then asks the owner as for an escape and never runs unasked. Never true
   * for an unwrapped OpenCode, whose requests already ask for every command.
   */
  readonly isContainmentUnconfirmed: () => boolean;
  /**
   * Whether OpenCode runs without the sandbox it would otherwise run in, as the owner allowed for a folder pointing
   * outside its workspace: every command and edit asks the owner.
   */
  readonly isUnsandboxed: boolean;
  readonly rpc: RpcProcess;
}

/** The longest timer Node allows, in milliseconds: a question waits with no time limit. */
const noTimeLimit = 2147483647;

/**
 * OpenCode's permissions (CHG-0031, CHG-0208). Every command and edit asks Iskios. Wrapped in the host's sandbox, a
 * command runs unasked at the default level; with no sandbox, it asks the owner. An edit inside the thread's folder runs
 * unasked unless the level is "Also commands and edits" (`isUnaskedEdit`). Its own subagents stay off: threads open
 * threads with open_thread (ADR 0007).
 */
const permissions = [
  { action: "shell", effect: "ask", resource: "*" },
  { action: "edit", effect: "ask", resource: "*" },
  { action: "subagent", effect: "deny", resource: "*" },
];

/** The configuration OpenCode adds to the owner's own: Iskios's tools, permissions, and starting context. */
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
        cacheCreation: numberFieldOf(usage, "cachedWriteTokens"),
        cacheRead: numberFieldOf(usage, "cachedReadTokens"),
        input: numberFieldOf(usage, "inputTokens"),
        output: numberFieldOf(usage, "outputTokens") + numberFieldOf(usage, "thoughtTokens"),
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
  `Iskios refused ${refusedActionOf(prompt)}. ${answer.text}`;

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
      return connection.rpc.respondError(incoming.id, `Iskios does not answer ${incoming.method}.`);
    const toolCall = fieldOf(incoming.params, "toolCall");
    // Nothing runs unasked on an assumption: the executor must be seen below the wrapped process, or it asks.
    const isUnconfirmed = connection.isContainmentUnconfirmed();
    let isAllowed = !isUnconfirmed && !connection.isUnsandboxed && (yield* isUnaskedEdit(request, toolCall));
    if (!isAllowed) {
      const prompt = {
        ...promptOf(toolCall),
        ...(isUnconfirmed ? { isOutsideSandbox: true } : {}),
        ...(connection.isUnsandboxed ? { isUnsandboxed: true } : {}),
      };
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
    // A session that replaced one OpenCode could not load is first given the thread's conversation so far.
    const notes = connection.handoverNotes;
    connection.handoverNotes = null;
    let text = notes === null ? turnMessageOf(request) : `${notes}\n\n${turnMessageOf(request)}`;
    let isFirst = true;
    let usage: TokenUsage | null = null;
    for (;;) {
      const end = yield* readPrompt(connection, request, turn, text, isFirst, refusals);
      isFirst = false;
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
  isFirst: boolean,
  refusals: Array<string>,
) =>
  Effect.gen(function* () {
    const answer = yield* Deferred.make<Result.Result<unknown, HarnessFailure>>();
    // The turn's images go with its first prompt only: a later prompt carries the refusals as text.
    const images = isFirst ? yield* readImages(request.images) : [];
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

/** The line a thread shows when OpenCode, now in its sandbox, could not pick up the thread's earlier session. */
const lostSessionNote =
  "OpenCode could not pick up this thread's earlier conversation: it was saved in OpenCode's own folder, which " +
  "OpenCode cannot read now that it runs in Iskios's sandbox. The thread carries on in a new OpenCode conversation, " +
  "which was given the thread's handover notes: its conversation so far, as when a thread changes harness.";

/** The question asked before running OpenCode without its sandbox for a folder that points elsewhere. */
const escapeQuestionOf = (found: FolderEscape, request: TurnRequest) =>
  `${folderProblemOf(found, request)}. Sandboxed there, OpenCode could write outside the workspace, so it was not started. ` +
  "Allow runs this thread's OpenCode without a sandbox, asking you before each command and file change; Deny stops " +
  "this turn";

/** Why the turn failed when the owner did not allow OpenCode to run without its sandbox. */
const escapeRefusalOf = (found: FolderEscape) =>
  `OpenCode did not start: the folder ${found.folder} points to ${found.pointsTo}, so its sandbox could write ` +
  "outside the workspace, and running it without a sandbox was not allowed. Fix the folder, or allow it, then retry.";

/** OpenCode's ACP protocol: one ACP session per Iskios thread, one prompt per turn. */
const openCodeProtocolOf = (options: OpenCodeOptions): HarnessProtocol<OpenCodeConnection> => {
  const instructionsFolder = options.instructionsFolder ?? join(tmpdir(), "iskios-opencode");
  // Starts prepare the sandbox's shared folders one at a time, so two never copy into the same folder at once.
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <A>(work: () => Promise<A>) => {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  };

  /** The starting context and approval rules, as the file OpenCode reads them from. */
  const writeInstructions = (request: TurnRequest) =>
    Effect.sync(() => {
      mkdirSync(instructionsFolder, { recursive: true });
      const path = join(instructionsFolder, `${request.threadId}.md`);
      writeFileSync(path, `${request.context}\n\n${approvalInstructionsOf(request.access, false, "opencode")}\n`);
      return path;
    });

  /**
   * Opens the thread's ACP session, or loads it again, on a started process. Sandboxed, OpenCode reads the sandbox's
   * copy of its data, which holds no session made before the sandbox, in the real data folder: one it cannot load is
   * replaced by a new session, saying so in the thread, rather than failing the thread for good (CHG-0208); the
   * new session is given the thread's conversation so far with its first prompt, as after a handover. Unsandboxed, a
   * session that cannot load fails the turn as before.
   */
  const openSession = (rpc: RpcProcess, request: TurnRequest, isSandboxed: boolean) =>
    Effect.gen(function* () {
      yield* rpc.request("initialize", {
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        protocolVersion: 1,
      });
      if (request.sessionId !== null) {
        const loaded = yield* rpc
          .request("session/load", { cwd: request.cwd, mcpServers: [], sessionId: request.sessionId })
          .pipe(Effect.result);
        // Loading replays the conversation as updates, which are not this turn's: they are dropped.
        yield* Queue.clear(rpc.incoming);
        if (Result.isSuccess(loaded)) return { handoverNotes: null, sessionId: request.sessionId };
        if (!isSandboxed || rpc.hasExited()) return yield* loaded.failure;
        const created = yield* rpc.request("session/new", { cwd: request.cwd, mcpServers: [] });
        const sessionId = textFieldOf(created, "sessionId");
        if (sessionId === null) return { handoverNotes: null, sessionId };
        yield* request.onEvent({ _tag: "Notice", text: lostSessionNote });
        return { handoverNotes: yield* request.conversationSoFar, sessionId };
      }
      const created = yield* rpc.request("session/new", { cwd: request.cwd, mcpServers: [] });
      return { handoverNotes: null, sessionId: textFieldOf(created, "sessionId") };
    });

  return {
    interrupt: (connection) =>
      Effect.sync(() => {
        connection.rpc.notify("session/cancel", { sessionId: connection.sessionId });
        return true;
      }),

    // A changed level, set of permissions, context, model, effort, folder, or account restarts the process,
    // loading its session.
    restartKeyOf: (request) =>
      JSON.stringify([
        request.context,
        request.access,
        request.configDirectory,
        request.model,
        request.effort,
        request.cwd,
      ]),

    runTurn: runPrompts,

    start: (request) =>
      Effect.gen(function* () {
        const instructionsPath = yield* writeInstructions(request);
        const args = [...(options.prefixArgs ?? []), "acp"];
        // A folder that would widen what the sandbox writes is never sandboxed: the owner decides whether the thread
        // runs there without the sandbox, every action asking, or the turn fails.
        const found =
          options.sandbox == null
            ? null
            : yield* Effect.sync(() => folderEscapeOf(request.cwd, request.folderRoot, request.access.isInWorkspace));
        if (found !== null) {
          // A one-time question: it offers no standing permission, and none answers it.
          const answer = yield* request.askOwner({
            folderCheck: { pointsTo: found.pointsTo, startsIn: null },
            input: { description: escapeQuestionOf(found, request), file_path: found.folder },
            toolName: "OpenCode",
          });
          if (!answer.isAllowed) return yield* new HarnessFailure({ reason: escapeRefusalOf(found) });
        }
        const isUnsandboxed = found !== null;
        const sandbox = isUnsandboxed ? null : (options.sandbox ?? null);
        const marker = sandbox === null ? null : ownerMarkerOf(sandbox);
        // Every sandboxed process carries the service's marker and its thread, so one it loses is found again.
        const marks = marker === null ? {} : { [marker.name]: marker.value, ISKIOS_SANDBOX_THREAD: request.threadId };
        if (sandbox !== null && marker !== null) {
          yield* Effect.promise(() => sweepOrphans(marker));
          yield* Effect.tryPromise({
            catch: (error) =>
              new HarnessFailure({
                reason: `OpenCode's sign-in or settings could not be copied into its sandbox. ${error instanceof Error ? error.message : String(error)}`,
              }),
            try: () =>
              exclusive(() =>
                prepareOpenCodeSandbox({
                  accountDataHome: request.configDirectory,
                  command: options.command,
                  environment: marks,
                  prefixArgs: options.prefixArgs ?? [],
                  sandbox,
                }),
              ),
          });
        }
        const env = {
          ...accountEnvironmentOf("opencode", request.configDirectory),
          ...(sandbox === null ? {} : openCodeEnvironmentOf(sandbox, request.configDirectory)),
          ...marks,
          OPENCODE_CONFIG_CONTENT: JSON.stringify(configOf(request.access, instructionsPath)),
        };
        // Wrapped, OpenCode and every process it starts write only where the sandbox lets them; never attached to a
        // running OpenCode server, so no process outside the sandbox serves the thread.
        const started =
          sandbox === null
            ? { args, command: options.command }
            : wrappedCommandOf(
                sandbox,
                yield* Effect.sync(() => writableRootsOf(sandbox, request.cwd, request.configDirectory)),
                options.command,
                args,
              );
        const rpc = yield* startRpcProcess({
          args: started.args,
          command: started.command,
          cwd: request.cwd,
          env: harnessEnvironmentOf(env),
          isJsonRpc2: true,
          // `acp` starts its own `serve`, whose children leave its process group: closing ends the group and the whole
          // tree, and once `acp` has ended, however it ended, any marked OpenCode process it left is ended too.
          isTreeKilled: true,
          label: "OpenCode",
          ...(marker === null ? {} : { onEnded: () => sweepOrphans(marker) }),
        });
        const { handoverNotes, sessionId } = yield* openSession(rpc, request, sandbox !== null).pipe(
          Effect.tapError(() => Effect.sync(() => rpc.close())),
        );
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
        // The effort is an option of the session's model, chosen after it (its variant).
        if (request.effort !== "default") {
          yield* rpc
            .request("session/set_config_option", { configId: "effort", sessionId, value: request.effort })
            .pipe(
              Effect.tapError(() => Effect.sync(() => rpc.close())),
              Effect.mapError(
                (failure) =>
                  new HarnessFailure({ reason: `OpenCode refused the effort ${request.effort}: ${failure.reason}` }),
              ),
            );
        }
        const rootPid = rpc.pid;
        return {
          close: rpc.close,
          handoverNotes,
          hasExited: rpc.hasExited,
          isContainmentUnconfirmed: () => sandbox !== null && !(rootPid !== null && hasExecutorBelow(rootPid)),
          isUnsandboxed,
          rpc,
          sessionId,
        } satisfies OpenCodeConnection;
      }),

    /** ACP takes no message into a running prompt: a steered message waits for the next turn. */
    steer: () => Effect.succeed(false),
  };
};

/** OpenCode Go's three windows in the order its usage report names them, with their length in minutes. */
const goWindows = [
  { minutes: 300, name: "rolling" },
  { minutes: 10080, name: "weekly" },
  { minutes: 43200, name: "monthly" },
] as const;

/**
 * The plan limits in OpenCode's `usage.limits` answer (probe of 2026-11-12, OpenCode 2.2.0): `data.go` holds the
 * OpenCode Go allowance as a 5-hour `rolling`, a `weekly`, and a `monthly` window, each with `percent` used and `resetsAt`
 * in milliseconds. Null when the sign-in has no Go plan, or OpenCode is not signed in to its Console (`data` is null).
 */
export const openCodePlanLimitsOf = (body: unknown): PlanLimitsReport | null => {
  const go = fieldOf(fieldOf(body, "data"), "go");
  const windows = goWindows.flatMap(({ minutes, name }): Array<PlanLimitReport> => {
    const window = fieldOf(go, name);
    return typeof fieldOf(window, "percent") === "number"
      ? [
          {
            resetsAtSeconds: numberFieldOf(window, "resetsAt") / 1000,
            usedPercent: numberFieldOf(window, "percent"),
            windowMinutes: minutes,
          },
        ]
      : [];
  });
  return windows.length === 0 ? null : { billing: "Subscription", windows };
};

/**
 * Asks OpenCode for the limits of the Go plan behind an account: a short `opencode serve` on a free local port, in the
 * account's own data folder and behind a password made for this one run, answers its `usage/limits` route with the
 * Console workspace OpenCode itself is signed in to, and is closed again. Iskios reads no token (requirements, Comply
 * with provider terms). Null when OpenCode reports no Go plan; a failure when it could not answer.
 */
const readOpenCodePlanLimits = (options: OpenCodeOptions, configDirectory: string | null) =>
  Effect.tryPromise({
    catch: (error) => new HarnessFailure({ reason: `OpenCode gave no plan limits: ${String(error)}` }),
    try: async () => {
      const password = randomUUID();
      const child = spawn(
        options.command,
        [...(options.prefixArgs ?? []), "serve", "--hostname", "127.0.0.1", "--port", "0"],
        {
          cwd: tmpdir(),
          env: harnessEnvironmentOf({
            ...accountEnvironmentOf("opencode", configDirectory),
            OPENCODE_SERVER_PASSWORD: password,
          }),
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
      try {
        const address = await new Promise<string>((resolve, reject) => {
          let printed = "";
          const timer = setTimeout(() => reject(new Error("it did not start in time")), 15_000);
          child.on("error", (error) => reject(error));
          child.on("exit", () => reject(new Error("it stopped before it was ready")));
          child.stdout.on("data", (chunk: Buffer) => {
            printed += chunk.toString();
            const found = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(printed);
            if (found?.[1] === undefined) return;
            clearTimeout(timer);
            resolve(found[1]);
          });
        });
        const answer = await fetch(`${address}/api/experimental/usage/limits`, {
          headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` },
          signal: AbortSignal.timeout(20_000),
        });
        if (!answer.ok) throw new Error(`it answered ${answer.status}`);
        return openCodePlanLimitsOf(await answer.json());
      } finally {
        child.kill();
      }
    },
  });

/**
 * Runs each thread in one long-lived `opencode acp` process, closed with the scope that made it. Wrapped, it first ends
 * the sandboxed OpenCode processes an earlier run of the service lost (processTree.ts sweepOrphans).
 */
export const makeOpenCodeHarness = (options: OpenCodeOptions) =>
  Effect.map(
    Effect.andThen(
      Effect.promise(async () => {
        const sandbox = options.sandbox ?? null;
        if (sandbox === null) return;
        const left = await sweepOrphans(ownerMarkerOf(sandbox));
        if (left.length > 0) console.error(`OpenCode: lost processes still running: ${left.join(", ")}`);
      }),
      makeHarnessProcesses(openCodeProtocolOf(options), options),
    ),
    (adapter) =>
      ({
        ...adapter,
        containmentOf: (): Containment => ((options.sandbox ?? null) === null ? "Unprotected" : "Sandboxed"),
        readPlanLimits: (_harness, configDirectory) => readOpenCodePlanLimits(options, configDirectory),
      }) satisfies HarnessAdapter,
  );
