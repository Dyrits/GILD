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
  invalid,
  numberFieldOf,
  type PlanLimitReport,
  type PlanLimitsReport,
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
import { makeOpenCodeLauncher } from "./openCodeLaunch.ts";
import { editedPathsOf, firstOutsideOf, isUnaskedEdit, promptOf, refusalOf } from "./openCodePrompts.ts";
import { type OpenCodeSandbox, ownerMarkerOf } from "./openCodeSandbox.ts";
import { sweepOrphans } from "./processTree.ts";
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
      // An edit naming no file is judged as leaving the folder: its title is no path to trust.
      const isPathless = textFieldOf(toolCall, "kind") === "edit" && editedPathsOf(toolCall).length === 0;
      const prompt = {
        ...promptOf(toolCall, yield* firstOutsideOf(request, toolCall)),
        ...(isUnconfirmed || isPathless ? { isOutsideSandbox: true } : {}),
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

/** OpenCode's ACP protocol: one ACP session per Iskios thread, one prompt per turn. */
const openCodeProtocolOf = (options: OpenCodeOptions): HarnessProtocol<OpenCodeConnection> => {
  const instructionsFolder = options.instructionsFolder ?? join(tmpdir(), "iskios-opencode");
  const launch = makeOpenCodeLauncher(options);

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
        const { isContainmentUnconfirmed, isSandboxed, isUnsandboxed, rpc } = yield* launch(
          request,
          JSON.stringify(configOf(request.access, instructionsPath)),
        );
        const { handoverNotes, sessionId } = yield* openSession(rpc, request, isSandboxed).pipe(
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
        return {
          close: rpc.close,
          handoverNotes,
          hasExited: rpc.hasExited,
          isContainmentUnconfirmed,
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
