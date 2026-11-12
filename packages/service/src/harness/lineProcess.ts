import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Deferred, Effect, Queue } from "effect";
import { fieldOf, HarnessFailure, textFieldOf } from "../core/index.ts";
import { killProcessTree } from "./processTree.ts";

// A harness process spoken to one JSON message per line on its standard streams (ADR 0008), in one of two
// framings: Claude Code's stream-json, and JSON-RPC for Codex's app server and the Agent Client Protocol.

/** How to start a harness process. */
export interface LineProcessOptions {
  readonly args: ReadonlyArray<string>;
  readonly command: string;
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
  /**
   * Whether the process starts in its own process group and session, and closing ends that group and the process's
   * whole tree, children that left the group included (processTree.ts), rather than only the process itself.
   */
  readonly isTreeKilled?: boolean;
  /** The harness's name as the owner reads it, for failures. */
  readonly label: string;
  /**
   * Run once the process has ended, however it ended: ends what it left behind, such as a child that outlived it and
   * so lost its link to the tree (sweepOrphans).
   */
  readonly onEnded?: () => Promise<ReadonlyArray<number>>;
}

/** The environment of a harness's process: Iskios's own variables, such as the owner token, left out. */
export const harnessEnvironmentOf = (extra: Record<string, string>) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("ISKIOS_"))),
  ...extra,
});

/** What a short command of a harness's tool printed. */
export interface CommandRun {
  /** The exit code; null when the tool is missing or timed out. */
  readonly code: number | null;
  /** What the command printed on both streams; Codex prints its login status on standard error. */
  readonly output: string;
  readonly stdout: string;
}

/** Runs a command of a harness's tool, by default a short one; a missing tool or a timeout reads as exit code null. */
export const runHarnessCommand = (
  command: string,
  args: ReadonlyArray<string>,
  env: Record<string, string>,
  timeoutMillis = 20_000,
  cwd?: string,
) =>
  Effect.callback<CommandRun>((resume) => {
    execFile(
      command,
      [...args],
      { cwd, env: harnessEnvironmentOf(env), maxBuffer: 4_000_000, timeout: timeoutMillis },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === "number" ? error.code : null;
        resume(Effect.succeed({ code, output: `${stdout}\n${stderr}`, stdout: String(stdout) }));
      },
    );
  });

/** What the transport hands its framing: each parsed line, then once the reason the process ended. */
interface LineHandlers {
  readonly onExit: (reason: string) => void;
  readonly onMessage: (message: unknown) => void;
}

/** Spawns the process; a line that is not JSON is skipped, and a missing executable reads as its exit. */
const spawnLineProcess = (options: LineProcessOptions, handlers: LineHandlers) => {
  let hasExited = false;
  let stderr = "";
  const isTreeKilled = options.isTreeKilled === true;
  const child = spawn(options.command, [...options.args], {
    cwd: options.cwd,
    // Its own group, so the group can be ended as a whole; its standard streams still tie it to the service.
    detached: isTreeKilled,
    env: options.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const reportLeft = (left: ReadonlyArray<number>) => {
    if (left.length > 0) console.error(`${options.label}: processes still running after close: ${left.join(", ")}`);
  };
  const end = (reason: string) => {
    if (hasExited) return;
    hasExited = true;
    handlers.onExit(reason);
    if (options.onEnded !== undefined) void options.onEnded().then(reportLeft);
  };
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });
  if (child.stdout !== null) {
    createInterface({ input: child.stdout }).on("line", (text) => {
      let message: unknown;
      try {
        message = JSON.parse(text);
      } catch {
        return;
      }
      handlers.onMessage(message);
    });
  }
  child.on("error", (error: NodeJS.ErrnoException) =>
    end(error.code === "ENOENT" ? `${options.label} was not found at "${options.command}".` : error.message),
  );
  child.on("exit", (code, signal) =>
    end(stderr.trim() || `${options.label} stopped unexpectedly (${signal ?? `exit code ${code}`}).`),
  );
  // A write to a closed stdin is reported by the exit handler instead.
  child.stdin?.on("error", () => void 0);
  return {
    close: () => {
      // A process that already ended is left alone: its id may belong to another process by now.
      if (hasExited) return;
      // Read the tree before the root ends, then check that nothing it started is left running.
      if (isTreeKilled && child.pid !== undefined) void killProcessTree(child.pid, 2000, true).then(reportLeft);
      else child.kill();
    },
    hasExited: () => hasExited,
    pid: child.pid ?? null,
    write: (message: object) => {
      if (!hasExited) child.stdin?.write(`${JSON.stringify(message)}\n`);
    },
  };
};

/** What a stream-json process sends: one parsed message, or its end. */
export type StreamItem =
  | { readonly _tag: "Message"; readonly message: unknown }
  | { readonly _tag: "Exit"; readonly reason: string };

/** One running harness process in Claude Code's stream-json framing. */
export interface StreamJsonProcess {
  readonly close: () => void;
  readonly hasExited: () => boolean;
  readonly incoming: Queue.Queue<StreamItem>;
  readonly write: (message: object) => void;
}

/** Starts a stream-json process. It lives until `close`, or until it exits on its own. */
export const startStreamJsonProcess = (options: LineProcessOptions) =>
  Effect.gen(function* () {
    const incoming = yield* Queue.unbounded<StreamItem>();
    const child = spawnLineProcess(options, {
      onExit: (reason) => Queue.offerUnsafe(incoming, { _tag: "Exit", reason }),
      onMessage: (message) => Queue.offerUnsafe(incoming, { _tag: "Message", message }),
    });
    return { ...child, incoming } satisfies StreamJsonProcess;
  });

/** What a JSON-RPC process sends that is not an answer to one of ours: a notification, a request, or its end. */
export type Incoming =
  | { readonly _tag: "Notification"; readonly method: string; readonly params: unknown }
  | { readonly _tag: "Request"; readonly id: number | string; readonly method: string; readonly params: unknown }
  | { readonly _tag: "Exit"; readonly reason: string };

/** How to start a harness that speaks JSON-RPC over its standard streams. */
export interface RpcOptions extends LineProcessOptions {
  /** Whether messages carry `"jsonrpc": "2.0"`, which ACP requires and Codex's app server leaves out. */
  readonly isJsonRpc2: boolean;
}

/** One running harness process and its JSON-RPC exchange. */
export interface RpcProcess {
  /** Ends the process; its pending requests fail. */
  readonly close: () => void;
  readonly hasExited: () => boolean;
  readonly incoming: Queue.Queue<Incoming>;
  readonly notify: (method: string, params: unknown) => void;
  /** The process's id, or null when it did not start: the root of the tree whose containment is checked. */
  readonly pid: number | null;
  /** Sends a request and waits for its result; an error answer or the process's end fails it. */
  readonly request: (method: string, params: unknown) => Effect.Effect<unknown, HarnessFailure>;
  readonly respond: (id: number | string, result: unknown) => void;
  readonly respondError: (id: number | string, message: string) => void;
}

/** Starts a JSON-RPC process. It lives until `close`, or until it exits on its own. */
export const startRpcProcess = (options: RpcOptions) =>
  Effect.gen(function* () {
    const incoming = yield* Queue.unbounded<Incoming>();
    const pending = new Map<number | string, Deferred.Deferred<unknown, HarnessFailure>>();
    let nextId = 1;

    const answer = (id: number | string, message: unknown) => {
      const deferred = pending.get(id);
      pending.delete(id);
      if (deferred === undefined) return;
      const error = fieldOf(message, "error");
      Deferred.doneUnsafe(
        deferred,
        error === undefined
          ? Effect.succeed(fieldOf(message, "result") ?? null)
          : Effect.fail(
              new HarnessFailure({ reason: textFieldOf(error, "message") ?? `${options.label} refused a request.` }),
            ),
      );
    };
    const child = spawnLineProcess(options, {
      onExit: (reason) => {
        for (const deferred of pending.values())
          Deferred.doneUnsafe(deferred, Effect.fail(new HarnessFailure({ reason })));
        pending.clear();
        Queue.offerUnsafe(incoming, { _tag: "Exit", reason });
      },
      onMessage: (message) => {
        const id = fieldOf(message, "id");
        const method = textFieldOf(message, "method");
        const params = fieldOf(message, "params");
        const isId = typeof id === "number" || typeof id === "string";
        if (method !== null && isId) Queue.offerUnsafe(incoming, { _tag: "Request", id, method, params });
        else if (method !== null) Queue.offerUnsafe(incoming, { _tag: "Notification", method, params });
        else if (isId) answer(id, message);
      },
    });
    const write = (message: object) => child.write(options.isJsonRpc2 ? { jsonrpc: "2.0", ...message } : message);

    const request = (method: string, params: unknown) =>
      Effect.gen(function* () {
        if (child.hasExited()) return yield* new HarnessFailure({ reason: `${options.label} is not running.` });
        const id = nextId++;
        const deferred = yield* Deferred.make<unknown, HarnessFailure>();
        pending.set(id, deferred);
        write({ id, method, params });
        return yield* Deferred.await(deferred);
      });

    return {
      close: child.close,
      hasExited: child.hasExited,
      incoming,
      notify: (method, params) => write({ method, params }),
      pid: child.pid,
      request,
      respond: (id, result) => write({ id, result }),
      respondError: (id, message) => write({ error: { code: -32601, message }, id }),
    } satisfies RpcProcess;
  });
