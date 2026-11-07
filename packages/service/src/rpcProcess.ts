import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Deferred, Effect, Predicate, Queue } from "effect";
import { HarnessFailure } from "./execution.ts";

// A harness process spoken to in JSON-RPC, one message per line on its standard streams: Codex's app server
// and the Agent Client Protocol (ADR 0008).

/** What the process sends that is not an answer to one of ours: a notification, or a request of its own. */
export type Incoming =
  | { readonly _tag: "Notification"; readonly method: string; readonly params: unknown }
  | { readonly _tag: "Request"; readonly id: number | string; readonly method: string; readonly params: unknown }
  | { readonly _tag: "Exit"; readonly reason: string }
  /** Raised by the adapter itself, such as an interrupt the harness did not confirm in time. */
  | { readonly _tag: "Timer"; readonly name: string };

export interface RpcOptions {
  readonly args: ReadonlyArray<string>;
  readonly command: string;
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
  /** Whether messages carry `"jsonrpc": "2.0"`, which ACP requires and Codex's app server leaves out. */
  readonly isJsonRpc2: boolean;
  /** The harness's name as the owner reads it, for failures. */
  readonly label: string;
}

/** One running harness process and its JSON-RPC exchange. */
export interface RpcProcess {
  /** Ends the process; its pending requests fail. */
  readonly close: () => void;
  readonly hasExited: () => boolean;
  readonly incoming: Queue.Queue<Incoming>;
  readonly notify: (method: string, params: unknown) => void;
  /** Sends a request and waits for its result; an error answer or the process's end fails it. */
  readonly request: (method: string, params: unknown) => Effect.Effect<unknown, HarnessFailure>;
  readonly respond: (id: number | string, result: unknown) => void;
  readonly respondError: (id: number | string, message: string) => void;
}

interface RpcLine {
  readonly error?: { readonly message?: string };
  readonly id?: number | string;
  readonly method?: string;
  readonly params?: unknown;
  readonly result?: unknown;
}

/** Starts the process. It lives until `close`, or until it exits on its own. */
export const startRpcProcess = (options: RpcOptions) =>
  Effect.gen(function* () {
    const incoming = yield* Queue.unbounded<Incoming>();
    const pending = new Map<number | string, Deferred.Deferred<unknown, HarnessFailure>>();
    let nextId = 1;
    let hasExited = false;
    let stderr = "";
    const child = spawn(options.command, [...options.args], {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const end = (reason: string) => {
      if (hasExited) return;
      hasExited = true;
      for (const deferred of pending.values())
        Deferred.doneUnsafe(deferred, Effect.fail(new HarnessFailure({ reason })));
      pending.clear();
      Queue.offerUnsafe(incoming, { _tag: "Exit", reason });
    };
    const write = (message: object) => {
      if (hasExited) return;
      child.stdin?.write(`${JSON.stringify(options.isJsonRpc2 ? { jsonrpc: "2.0", ...message } : message)}\n`);
    };

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    if (child.stdout !== null) {
      createInterface({ input: child.stdout }).on("line", (text) => {
        let line: RpcLine;
        try {
          line = JSON.parse(text);
        } catch {
          return;
        }
        if (line.method !== undefined && line.id !== undefined) {
          Queue.offerUnsafe(incoming, { _tag: "Request", id: line.id, method: line.method, params: line.params });
        } else if (line.method !== undefined) {
          Queue.offerUnsafe(incoming, { _tag: "Notification", method: line.method, params: line.params });
        } else if (line.id !== undefined) {
          const deferred = pending.get(line.id);
          pending.delete(line.id);
          if (deferred === undefined) return;
          Deferred.doneUnsafe(
            deferred,
            line.error === undefined
              ? Effect.succeed(line.result ?? null)
              : Effect.fail(
                  new HarnessFailure({ reason: line.error.message ?? `${options.label} refused a request.` }),
                ),
          );
        }
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

    const request = (method: string, params: unknown) =>
      Effect.gen(function* () {
        if (hasExited) return yield* new HarnessFailure({ reason: `${options.label} is not running.` });
        const id = nextId++;
        const deferred = yield* Deferred.make<unknown, HarnessFailure>();
        pending.set(id, deferred);
        write({ id, method, params });
        return yield* Deferred.await(deferred);
      });

    return {
      close: () => {
        if (!hasExited) child.kill();
      },
      hasExited: () => hasExited,
      incoming,
      notify: (method, params) => write({ method, params }),
      request,
      respond: (id, result) => write({ id, result }),
      respondError: (id, message) => write({ error: { code: -32601, message }, id }),
    } satisfies RpcProcess;
  });

/** A field of an unknown record, or undefined. */
export const fieldOf = (value: unknown, key: string): unknown =>
  Predicate.isObject(value) && Predicate.hasProperty(value, key) ? value[key] : void 0;

/** A string field of an unknown record, or null. */
export const textFieldOf = (value: unknown, key: string) => {
  const field = fieldOf(value, key);
  return typeof field === "string" ? field : null;
};

/** A number field of an unknown record, or 0. */
export const countOf = (value: unknown, key: string) => {
  const field = fieldOf(value, key);
  return typeof field === "number" ? field : 0;
};

/** Whether an answer of OpenMission's permission prompt tool (`answer_prompt`) allows the action. */
export const isPromptAllowed = (answer: string) => {
  try {
    return fieldOf(JSON.parse(answer), "behavior") === "allow";
  } catch {
    return false;
  }
};
