import { Effect } from "effect";
import { HarnessFailure, type TurnRequest } from "../core/index.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import { harnessEnvironmentOf, type RpcProcess, startRpcProcess } from "./lineProcess.ts";
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

// The sandboxed launch of one thread's `opencode acp`. The order is what makes the sandbox safe, so it is written
// once, here: ask about a folder that would widen the sandbox, sweep what an earlier run left, copy the sign-in and
// settings into the sandbox, wrap the command, start it, and keep watching that its executor stays inside the wrap.
// The caller keeps the protocol (sessions, models, prompts) and learns only what the launch reports.

/** What the launch needs from the harness's options. */
export interface OpenCodeLaunchOptions {
  readonly command: string;
  readonly prefixArgs?: ReadonlyArray<string>;
  /** The host's sandbox, or null when none can run here: then every action asks the owner. */
  readonly sandbox?: OpenCodeSandbox | null;
}

/** A started OpenCode process and the facts about how it is contained, which Containment judges (policy/containment.ts). */
export interface LaunchedOpenCode {
  /** Whether a wrapped OpenCode's executor is NOT confirmed to descend from the wrapped process; read at each request. */
  readonly isContainmentUnconfirmed: () => boolean;
  /** Whether the process is wrapped in the sandbox. */
  readonly isSandboxed: boolean;
  /** Whether the thread runs without the sandbox it otherwise runs in, as the owner allowed for a folder that points out. */
  readonly isUnsandboxed: boolean;
  readonly rpc: RpcProcess;
}

/** The question asked before running OpenCode without its sandbox for a folder that points elsewhere. */
const escapeQuestionOf = (found: FolderEscape, request: TurnRequest) =>
  `${folderProblemOf(found, request)}. Sandboxed there, OpenCode could write outside the workspace, so it was not started. ` +
  "Allow runs this thread's OpenCode without a sandbox, asking you before each command and file change; Deny stops " +
  "this turn";

/** Why the turn failed when the owner did not allow OpenCode to run without its sandbox. */
const escapeRefusalOf = (found: FolderEscape) =>
  `OpenCode did not start: the folder ${found.folder} points to ${found.pointsTo}, so its sandbox could write ` +
  "outside the workspace, and running it without a sandbox was not allowed. Fix the folder, or allow it, then retry.";

/**
 * Makes the launch for one harness. Starts prepare the sandbox's shared folders one at a time, so two never copy into
 * the same folder at once. `config` is the text of the OpenCode configuration the thread's access calls for.
 */
export const makeOpenCodeLauncher = (options: OpenCodeLaunchOptions) => {
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <A>(work: () => Promise<A>) => {
    const next = queue.then(work, work);
    queue = next.catch(() => void 0);
    return next;
  };

  return (request: TurnRequest, config: string): Effect.Effect<LaunchedOpenCode, HarnessFailure> =>
    Effect.gen(function* () {
      const args = [...(options.prefixArgs ?? []), "acp"];
      // A folder that would widen what the sandbox writes is never sandboxed: the owner decides whether the thread
      // runs there without the sandbox, every action asking, or the turn fails. Without a sandbox tool nothing is
      // widened and every action asks anyway, but the folder still counts as outside its workspace, so even an edit
      // in it asks (the folder check no sandbox skipped).
      const found = yield* Effect.sync(() =>
        folderEscapeOf(request.cwd, request.folderRoot, request.access.isInWorkspace),
      );
      if (found !== null && options.sandbox != null) {
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
        OPENCODE_CONFIG_CONTENT: config,
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
      const rootPid = rpc.pid;
      return {
        isContainmentUnconfirmed: () => sandbox !== null && !(rootPid !== null && hasExecutorBelow(rootPid)),
        isSandboxed: sandbox !== null,
        isUnsandboxed,
        rpc,
      } satisfies LaunchedOpenCode;
    });
};
