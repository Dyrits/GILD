import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { TokenUsage } from "@openmission/contracts";
import { Duration, Effect, Layer, Queue } from "effect";
import { Harness, HarnessFailure, type TurnRequest } from "./execution.ts";

export interface ClaudeOptions {
  /** The executable; `claude` on the PATH by default. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before Claude Code's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
}

/** The fields OpenMission reads from Claude Code's stream-json events. */
interface StreamEvent {
  readonly error?: unknown;
  readonly errors?: unknown;
  readonly event?: { readonly type?: string; readonly delta?: { readonly type?: string; readonly text?: string } };
  readonly is_error?: boolean;
  readonly message?: { readonly content?: unknown };
  readonly result?: unknown;
  readonly subtype?: string;
  readonly type?: string;
  readonly usage?: Record<string, unknown>;
}

type Line = { readonly _tag: "Line"; readonly line: string } | { readonly _tag: "Exit"; readonly reason: string };

interface Session {
  readonly child: ChildProcess;
  hasExited: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
  readonly lines: Queue.Queue<Line>;
  readonly sessionId: string;
}

// Chat only (CHG-0027): no tools, every permission prompt denied, and none of
// the user's MCP servers, skills, or settings, so no action needs approval.
const chatOnlyArgs = [
  "-p",
  "--input-format",
  "stream-json",
  "--output-format",
  "stream-json",
  "--verbose",
  "--include-partial-messages",
  "--tools",
  "",
  "--permission-prompts",
  "none",
  "--strict-mcp-config",
  "--setting-sources",
  "",
  "--disable-slash-commands",
];

/** The child's environment without OpenMission's own variables, such as the owner token. */
const childEnvironment = () =>
  Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("OPENMISSION_")));

const usageOf = (usage: Record<string, unknown> | undefined): TokenUsage | null => {
  if (usage === undefined) return null;
  const count = (key: string) => (typeof usage[key] === "number" ? (usage[key] as number) : 0);
  return {
    cacheCreation: count("cache_creation_input_tokens"),
    cacheRead: count("cache_read_input_tokens"),
    input: count("input_tokens"),
    output: count("output_tokens"),
  };
};

const textOf = (content: unknown) =>
  Array.isArray(content)
    ? content
        .filter((block): block is { type: "text"; text: string } => block?.type === "text")
        .map((block) => block.text)
        .join("")
    : "";

/** Runs each thread in one long-lived `claude -p` stream-json process (CHG-0027). */
export const claudeHarnessLayer = (options: ClaudeOptions) =>
  Layer.effect(
    Harness,
    Effect.gen(function* () {
      const sessions = new Map<string, Session>();
      const idleMillis = Duration.toMillis(Duration.fromInputUnsafe(options.idleTimeout));

      const close = (threadId: string) => {
        const session = sessions.get(threadId);
        if (session === undefined) return;
        sessions.delete(threadId);
        if (session.idleTimer !== null) clearTimeout(session.idleTimer);
        if (!session.hasExited) session.child.kill();
      };
      yield* Effect.addFinalizer(() => Effect.sync(() => [...sessions.keys()].forEach(close)));

      const start = (request: TurnRequest) =>
        Effect.gen(function* () {
          const isResuming = request.sessionId !== null;
          const sessionId = request.sessionId ?? crypto.randomUUID();
          const args = [
            ...(options.prefixArgs ?? []),
            ...chatOnlyArgs,
            ...(isResuming ? ["--resume", sessionId] : ["--session-id", sessionId]),
            ...(request.model === "default" ? [] : ["--model", request.model]),
            ...(request.effort === "default" ? [] : ["--effort", request.effort]),
          ];
          const lines = yield* Queue.unbounded<Line>();
          const child = spawn(options.command, args, {
            cwd: request.cwd,
            env: childEnvironment(),
            stdio: ["pipe", "pipe", "pipe"],
          });
          const session: Session = { child, hasExited: false, idleTimer: null, lines, sessionId };
          let stderr = "";
          child.stderr?.on("data", (chunk: Buffer) => {
            stderr = (stderr + chunk.toString()).slice(-2000);
          });
          if (child.stdout !== null) {
            createInterface({ input: child.stdout }).on("line", (line) =>
              Queue.offerUnsafe(lines, { _tag: "Line", line }),
            );
          }
          child.on("error", (error: NodeJS.ErrnoException) => {
            session.hasExited = true;
            const reason =
              error.code === "ENOENT" ? `Claude Code was not found at "${options.command}".` : error.message;
            Queue.offerUnsafe(lines, { _tag: "Exit", reason });
          });
          child.on("exit", (code, signal) => {
            session.hasExited = true;
            const detail = stderr.trim();
            Queue.offerUnsafe(lines, {
              _tag: "Exit",
              reason: detail || `Claude Code stopped unexpectedly (${signal ?? `exit code ${code}`}).`,
            });
          });
          // A write to a closed stdin is reported by the exit handler instead.
          child.stdin?.on("error", () => void 0);
          sessions.set(request.threadId, session);
          return session;
        });

      const runTurn = (request: TurnRequest) =>
        Effect.gen(function* () {
          const existing = sessions.get(request.threadId);
          const session = existing !== undefined && !existing.hasExited ? existing : yield* start(request);
          if (session.idleTimer !== null) clearTimeout(session.idleTimer);
          session.child.stdin?.write(
            `${JSON.stringify({ message: { content: request.text, role: "user" }, type: "user" })}\n`,
          );

          let draft = "";
          let reportedError: string | null = null;
          for (;;) {
            const item = yield* Queue.take(session.lines);
            if (item._tag === "Exit") {
              close(request.threadId);
              return yield* new HarnessFailure({ reason: item.reason });
            }
            let event: StreamEvent;
            try {
              event = JSON.parse(item.line);
            } catch {
              continue;
            }
            if (event.type === "stream_event") {
              const inner = event.event ?? {};
              if (inner.type === "message_start") draft = "";
              if (inner.type === "content_block_delta" && inner.delta?.type === "text_delta") {
                draft += inner.delta.text ?? "";
                yield* request.onEvent({ _tag: "Draft", text: draft });
              }
            } else if (event.type === "assistant") {
              const text = textOf(event.message?.content);
              draft = "";
              // A synthetic assistant message carrying `error` reports a failure, not a reply.
              if (event.error !== undefined && event.error !== null) reportedError = text || String(event.error);
              else if (text.trim() !== "") yield* request.onEvent({ _tag: "Reply", text });
            } else if (event.type === "result") {
              if (event.is_error === true || reportedError !== null) {
                const reason =
                  reportedError ??
                  (typeof event.result === "string" && event.result !== "" ? event.result : null) ??
                  (Array.isArray(event.errors) ? event.errors.join("; ") : null) ??
                  `Claude Code reported ${event.subtype ?? "an error"}.`;
                close(request.threadId);
                return yield* new HarnessFailure({ reason });
              }
              session.idleTimer = setTimeout(() => close(request.threadId), idleMillis);
              return { sessionId: session.sessionId, usage: usageOf(event.usage) };
            }
          }
        });

      return { runTurn };
    }),
  );
