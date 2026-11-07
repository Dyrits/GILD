import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { TokenUsage } from "@canopy/contracts";
import { Duration, Effect, Exit, Layer, Queue, Schema } from "effect";
import {
  Harness,
  type HarnessAdapter,
  type HarnessEvent,
  HarnessFailure,
  type SteeredMessage,
  type ThreadAccess,
  type TurnRequest,
} from "./execution.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import { approvalInstructionsOf } from "./instructions.ts";
import { approvalToolName, promptToolName, threadToolNames, toolServerName } from "./mcp.ts";

export interface ClaudeOptions {
  /** The executable; `claude` on the PATH by default. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before Claude Code's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
  /** Why the sandbox cannot run here, or null; without it every harness prompt asks (CHG-0031). */
  readonly sandboxProblem: string | null;
  /** The owner's Claude Code settings file, whose allow and deny rules apply at "Also commands and edits". */
  readonly userSettingsPath?: string;
}

/** The fields Canopy reads from Claude Code's stream-json events. */
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
  readonly uuid?: string;
}

type Line =
  | { readonly _tag: "Line"; readonly line: string }
  | { readonly _tag: "Exit"; readonly reason: string }
  /** An interrupt Claude Code did not confirm in time. */
  | { readonly _tag: "Unconfirmed" };

/** The turn a session is running: where its events go, and the steered messages not yet taken in. */
interface RunningTurn {
  interruptTimer: ReturnType<typeof setTimeout> | null;
  isInterrupting: boolean;
  readonly onEvent: (event: HarnessEvent) => Effect.Effect<void>;
  readonly untaken: Set<string>;
}

interface Session {
  readonly child: ChildProcess;
  hasExited: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
  readonly lines: Queue.Queue<Line>;
  readonly sessionId: string;
  /** The access arguments the process started with; a change restarts it on the next turn. */
  readonly signature: string;
  /** The turn being read, or null between turns. */
  turn: RunningTurn | null;
}

// Tools behind approval (CHG-0031): built-in tools only, none of the owner's MCP
// servers, skills, or settings; every permission prompt goes to Canopy.
const baseArgs = [
  "-p",
  "--input-format",
  "stream-json",
  "--output-format",
  "stream-json",
  "--verbose",
  "--include-partial-messages",
  // Echoes each user message, with its uuid, when the turn takes it in: how steering knows a
  // message was delivered (CHG-0039).
  "--replay-user-messages",
  "--tools",
  "default",
  // One thread is one Claude Code conversation; native subagents stay off, and threads open
  // threads with open_thread instead (ADR 0007).
  "--disallowedTools",
  "Agent",
  "Task",
  "--strict-mcp-config",
  "--setting-sources",
  "",
  "--disable-slash-commands",
  "--permission-prompts",
  "host",
  "--permission-prompt-tool",
  promptToolName,
  "--allowedTools",
  approvalToolName,
  ...threadToolNames,
];

const PermissionRules = Schema.Struct({
  permissions: Schema.optional(
    Schema.Struct({
      allow: Schema.optional(Schema.Array(Schema.String)),
      deny: Schema.optional(Schema.Array(Schema.String)),
    }),
  ),
});
const decodeRules = Schema.decodeUnknownExit(Schema.fromJsonString(PermissionRules));

/** The owner's own allow and deny rules from their Claude Code settings, or none when unreadable. */
const ownerRulesOf = (path: string) => {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const decoded = decodeRules(text);
  if (Exit.isFailure(decoded)) return {};
  const { allow, deny } = decoded.value.permissions ?? {};
  return { ...(allow === undefined ? {} : { allow }), ...(deny === undefined ? {} : { deny }) };
};

/** How long Claude Code has to end an interrupted turn before its process is closed (CHG-0039, provisional). */
const interruptGraceMillis = 10_000;

/** The longest timer Node allows, in milliseconds: about 24.8 days. */
const noTimeLimit = 2147483647;

/**
 * What a sandboxed thread in a workspace may also do unasked, so it can install the project's
 * dependencies and run its checks (CHG-0034; probe of 2026-11-06 with Bun 1.4.3 and Electron 45):
 * reach the package registry and GitHub's release downloads, write Bun's and Electron's caches,
 * listen on loopback for test servers, and send Node's own downloads through the sandbox proxy.
 */
const workspaceSandbox = {
  env: { NODE_USE_ENV_PROXY: "1" },
  sandbox: {
    filesystem: { allowWrite: ["~/.bun/install/cache", "~/Library/Caches/electron", "~/.cache/electron"] },
    network: {
      allowedDomains: [
        "registry.npmjs.org",
        "github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com",
      ],
      allowLocalBinding: true,
    },
  },
};

/** Claude Code's sandbox settings: always on and unasked inside it, widened for a workspace thread. */
const sandboxSettingsOf = (access: ThreadAccess) => {
  const base = { autoAllowBashIfSandboxed: true, enabled: true };
  return access.isInWorkspace
    ? { env: workspaceSandbox.env, sandbox: { ...base, ...workspaceSandbox.sandbox } }
    : { sandbox: base };
};

/** The arguments that depend on the thread's access: its endpoint, instructions, and approval level. */
const accessArgsOf = (access: ThreadAccess, context: string, options: ClaudeOptions) => {
  // A question waits with no time limit (action-approval, Waiting); without its own
  // timeout, Claude Code aborts a call silent for 300 seconds (verified 2026-11-05).
  const mcpConfig = { mcpServers: { [toolServerName]: { timeout: noTimeLimit, type: "http", url: access.mcpUrl } } };
  const isSandboxed = access.approvalLevel === "RiskyOnly" && options.sandboxProblem === null;
  const levelArgs = isSandboxed
    ? ["--permission-mode", "acceptEdits", "--settings", JSON.stringify(sandboxSettingsOf(access))]
    : [
        "--permission-mode",
        "default",
        "--settings",
        JSON.stringify({
          permissions: ownerRulesOf(options.userSettingsPath ?? join(homedir(), ".claude", "settings.json")),
        }),
      ];
  return [
    "--mcp-config",
    JSON.stringify(mcpConfig),
    "--append-system-prompt",
    // Claude Code runs without setting sources, so it reads no CLAUDE.md itself (workspaces.ts).
    `${context}\n\n${approvalInstructionsOf(access, isSandboxed, "claude")}`,
    ...levelArgs,
  ];
};

/** The environment of a harness's process: Canopy's own variables, such as the owner token, left out. */
export const harnessEnvironmentOf = (extra: Record<string, string>) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("CANOPY_"))),
  ...extra,
});

/** The child's environment, signed in with the turn's account (provider-accounts). */
const childEnvironment = (configDirectory: string | null) =>
  harnessEnvironmentOf({ ...accountEnvironmentOf("claude", configDirectory), MCP_TOOL_TIMEOUT: String(noTimeLimit) });

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
export const claudeHarnessLayer = (options: ClaudeOptions) => Layer.effect(Harness, makeClaudeHarness(options));

/** The Claude Code adapter, whose processes close with the scope that made it. */
export const makeClaudeHarness = (options: ClaudeOptions) =>
  Effect.gen(function* () {
    const sessions = new Map<string, Session>();
    const idleMillis = Duration.toMillis(Duration.fromInputUnsafe(options.idleTimeout));

    const close = (threadId: string) => {
      const session = sessions.get(threadId);
      if (session === undefined) return;
      sessions.delete(threadId);
      if (session.idleTimer !== null) clearTimeout(session.idleTimer);
      if (session.turn?.interruptTimer != null) clearTimeout(session.turn.interruptTimer);
      if (!session.hasExited) session.child.kill();
    };

    const write = (session: Session, input: object) => session.child.stdin?.write(`${JSON.stringify(input)}\n`);
    yield* Effect.addFinalizer(() => Effect.sync(() => [...sessions.keys()].forEach(close)));

    const start = (request: TurnRequest, signature: string, accessArgs: ReadonlyArray<string>) =>
      Effect.gen(function* () {
        const isResuming = request.sessionId !== null;
        const sessionId = request.sessionId ?? crypto.randomUUID();
        const args = [
          ...(options.prefixArgs ?? []),
          ...baseArgs,
          ...accessArgs,
          ...(isResuming ? ["--resume", sessionId] : ["--session-id", sessionId]),
          ...(request.model === "default" ? [] : ["--model", request.model]),
          ...(request.effort === "default" ? [] : ["--effort", request.effort]),
        ];
        const lines = yield* Queue.unbounded<Line>();
        const child = spawn(options.command, args, {
          cwd: request.cwd,
          env: childEnvironment(request.configDirectory),
          stdio: ["pipe", "pipe", "pipe"],
        });
        const session: Session = {
          child,
          hasExited: false,
          idleTimer: null,
          lines,
          sessionId,
          signature,
          turn: null,
        };
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
          const reason = error.code === "ENOENT" ? `Claude Code was not found at "${options.command}".` : error.message;
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
        const accessArgs = accessArgsOf(request.access, request.context, options);
        const signature = JSON.stringify([accessArgs, request.configDirectory]);
        const existing = sessions.get(request.threadId);
        // A changed level, set of permissions, or set of workspace instructions restarts the
        // process, resuming its conversation; the journal and intel ride on the turn's message instead.
        if (existing !== undefined && existing.signature !== signature) close(request.threadId);
        const current = sessions.get(request.threadId);
        const session =
          current !== undefined && !current.hasExited ? current : yield* start(request, signature, accessArgs);
        if (session.idleTimer !== null) clearTimeout(session.idleTimer);
        const turn: RunningTurn = {
          interruptTimer: null,
          isInterrupting: false,
          onEvent: request.onEvent,
          untaken: new Set(),
        };
        session.turn = turn;
        // The turn's note (journal, intel, budget) comes first, set off from the messages it precedes.
        const content = request.note === null ? request.text : `${request.note}\n\n---\n\n${request.text}`;
        write(session, { message: { content, role: "user" }, type: "user" });

        /**
         * The turn's end. A steered message not yet taken in would start a turn of its own in this
         * process, which nothing reads: the process closes instead, and the message, still
         * undelivered, starts the next turn (CHG-0039, provisional).
         */
        const end = (usage: TokenUsage | null) => {
          session.turn = null;
          if (turn.interruptTimer !== null) clearTimeout(turn.interruptTimer);
          if (turn.untaken.size > 0) close(request.threadId);
          else session.idleTimer = setTimeout(() => close(request.threadId), idleMillis);
          return { cost: null, isInterrupted: turn.isInterrupting, sessionId: session.sessionId, usage };
        };

        let draft = "";
        let reportedError: string | null = null;
        for (;;) {
          const item = yield* Queue.take(session.lines);
          if (item._tag === "Exit" && turn.isInterrupting) {
            close(request.threadId);
            return { cost: null, isInterrupted: true, sessionId: session.sessionId, usage: null };
          }
          if (item._tag === "Exit") {
            close(request.threadId);
            return yield* new HarnessFailure({ reason: item.reason });
          }
          // A late timer from an earlier turn of this process is ignored.
          if (item._tag === "Unconfirmed") {
            if (!turn.isInterrupting) continue;
            close(request.threadId);
            return { cost: null, isInterrupted: true, sessionId: session.sessionId, usage: null };
          }
          let event: StreamEvent;
          try {
            event = JSON.parse(item.line);
          } catch {
            continue;
          }
          if (event.type === "user") {
            // Only steered messages are tracked; the turn's own message and tool results are not.
            if (event.uuid !== undefined && turn.untaken.delete(event.uuid)) {
              yield* request.onEvent({ _tag: "Delivered", messageId: event.uuid });
            }
          } else if (event.type === "stream_event") {
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
            // An interrupted turn ends with an error result, which is no failure (probe of 2026-11-06).
            if (turn.isInterrupting) return end(usageOf(event.usage));
            if (event.is_error === true || reportedError !== null) {
              const reason =
                reportedError ??
                (typeof event.result === "string" && event.result !== "" ? event.result : null) ??
                (Array.isArray(event.errors) ? event.errors.join("; ") : null) ??
                `Claude Code reported ${event.subtype ?? "an error"}.`;
              close(request.threadId);
              return yield* new HarnessFailure({ reason });
            }
            return end(usageOf(event.usage));
          }
        }
      }).pipe(Effect.onInterrupt(() => Effect.sync(() => close(request.threadId))));

    /** The session whose turn is running for the thread, if any. */
    const runningSessionOf = (threadId: string) => {
      const session = sessions.get(threadId);
      return session === undefined || session.hasExited || session.turn === null ? null : session;
    };

    // A user message written mid-turn joins it after the current tool call; its uuid comes back
    // in the echo once taken in (probe of 2026-11-06, Claude Code 2.1.302).
    const steer = (threadId: string, message: SteeredMessage) =>
      Effect.sync(() => {
        const session = runningSessionOf(threadId);
        if (session === null || session.turn === null || session.turn.isInterrupting) return false;
        session.turn.untaken.add(message.id);
        write(session, { message: { content: message.text, role: "user" }, type: "user", uuid: message.id });
        return true;
      });

    const interrupt = (threadId: string) =>
      Effect.sync(() => {
        const session = runningSessionOf(threadId);
        const turn = session?.turn ?? null;
        if (session === null || turn === null) return false;
        if (turn.isInterrupting) return true;
        turn.isInterrupting = true;
        write(session, {
          request: { subtype: "interrupt" },
          request_id: crypto.randomUUID(),
          type: "control_request",
        });
        turn.interruptTimer = setTimeout(
          () => Queue.offerUnsafe(session.lines, { _tag: "Unconfirmed" }),
          interruptGraceMillis,
        );
        return true;
      });

    return { interrupt, runTurn, steer } satisfies HarnessAdapter;
  });
