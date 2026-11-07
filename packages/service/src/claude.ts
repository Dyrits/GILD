import type { TokenUsage } from "@canopy/contracts";
import { type Duration, Effect, Layer, Queue } from "effect";
import { type AccessOptions, accessArgsOf, baseArgs, noTimeLimit } from "./claudeArgs.ts";
import { Harness, HarnessFailure, turnMessageOf } from "./execution.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import { type HarnessConnection, type HarnessProtocol, makeHarnessProcesses } from "./harnessProcesses.ts";
import {
  countOf,
  fieldOf,
  harnessEnvironmentOf,
  type StreamJsonProcess,
  startStreamJsonProcess,
  textFieldOf,
} from "./lineProcess.ts";

// Claude Code through `claude -p` in stream-json mode (ADR 0008; CHG-0027): one process per thread.

/** How the Claude Code adapter starts its harness. */
export interface ClaudeOptions extends AccessOptions {
  /** The executable; `claude` on the PATH by default. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before Claude Code's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
}

interface ClaudeConnection extends HarnessConnection {
  readonly process: StreamJsonProcess;
}

/** The child's environment, signed in with the turn's account (provider-accounts). */
const childEnvironment = (configDirectory: string | null) =>
  harnessEnvironmentOf({ ...accountEnvironmentOf("claude", configDirectory), MCP_TOOL_TIMEOUT: String(noTimeLimit) });

const usageOf = (usage: unknown): TokenUsage | null =>
  usage === undefined || usage === null
    ? null
    : {
        cacheCreation: countOf(usage, "cache_creation_input_tokens"),
        cacheRead: countOf(usage, "cache_read_input_tokens"),
        input: countOf(usage, "input_tokens"),
        output: countOf(usage, "output_tokens"),
      };

const textOf = (content: unknown) =>
  Array.isArray(content)
    ? content
        .filter((block) => textFieldOf(block, "type") === "text")
        .map((block) => textFieldOf(block, "text") ?? "")
        .join("")
    : "";

/** Why a turn's error result failed it, from the fields Claude Code reports. */
const failureReasonOf = (event: unknown, reportedError: string | null) => {
  const result = textFieldOf(event, "result");
  const errors = fieldOf(event, "errors");
  return (
    reportedError ??
    (result !== null && result !== "" ? result : null) ??
    (Array.isArray(errors) ? errors.join("; ") : null) ??
    `Claude Code reported ${textFieldOf(event, "subtype") ?? "an error"}.`
  );
};

/** Claude Code's protocol: a user message per turn, read until its result. */
const claudeProtocolOf = (options: ClaudeOptions): HarnessProtocol<ClaudeConnection> => ({
  interrupt: (connection) =>
    Effect.sync(() => {
      connection.process.write({
        request: { subtype: "interrupt" },
        request_id: crypto.randomUUID(),
        type: "control_request",
      });
      return true;
    }),

  // A changed level, set of permissions, set of workspace instructions, model, effort, folder, or account
  // restarts the process, resuming its conversation; the journal and intel ride on the turn's message instead.
  restartKeyOf: (request) =>
    JSON.stringify([
      accessArgsOf(request.access, request.context, options),
      request.configDirectory,
      request.cwd,
      request.effort,
      request.model,
    ]),

  runTurn: (connection, request, turn) =>
    Effect.gen(function* () {
      connection.process.write({ message: { content: turnMessageOf(request), role: "user" }, type: "user" });
      let draft = "";
      let reportedError: string | null = null;
      for (;;) {
        const item = yield* Queue.take(connection.process.incoming);
        if (item._tag === "Exit") return yield* new HarnessFailure({ reason: item.reason });
        const event = item.message;
        const type = textFieldOf(event, "type");
        if (type === "user") {
          // Only steered messages are tracked; the turn's own message and tool results are not.
          const uuid = textFieldOf(event, "uuid");
          if (uuid !== null) yield* turn.deliver(uuid);
        } else if (type === "stream_event") {
          const inner = fieldOf(event, "event");
          const innerType = textFieldOf(inner, "type");
          const delta = fieldOf(inner, "delta");
          if (innerType === "message_start") draft = "";
          if (innerType === "content_block_delta" && textFieldOf(delta, "type") === "text_delta") {
            draft += textFieldOf(delta, "text") ?? "";
            yield* request.onEvent({ _tag: "Draft", text: draft });
          }
        } else if (type === "assistant") {
          const text = textOf(fieldOf(fieldOf(event, "message"), "content"));
          const error = fieldOf(event, "error");
          draft = "";
          // A synthetic assistant message carrying `error` reports a failure, not a reply.
          if (error !== undefined && error !== null) reportedError = text || String(error);
          else if (text.trim() !== "") yield* request.onEvent({ _tag: "Reply", text });
        } else if (type === "result") {
          // An interrupted turn ends with an error result, which is no failure (probe of 2026-11-06).
          const usage = usageOf(fieldOf(event, "usage"));
          if (turn.isInterrupting()) return { isInterrupted: true, usage };
          if (fieldOf(event, "is_error") === true || reportedError !== null)
            return yield* new HarnessFailure({ reason: failureReasonOf(event, reportedError) });
          return { isInterrupted: false, usage };
        }
      }
    }),

  start: (request) =>
    Effect.gen(function* () {
      const isResuming = request.sessionId !== null;
      const sessionId = request.sessionId ?? crypto.randomUUID();
      const process = yield* startStreamJsonProcess({
        args: [
          ...(options.prefixArgs ?? []),
          ...baseArgs,
          ...accessArgsOf(request.access, request.context, options),
          ...(isResuming ? ["--resume", sessionId] : ["--session-id", sessionId]),
          ...(request.model === "default" ? [] : ["--model", request.model]),
          ...(request.effort === "default" ? [] : ["--effort", request.effort]),
        ],
        command: options.command,
        cwd: request.cwd,
        env: childEnvironment(request.configDirectory),
        label: "Claude Code",
      });
      return { close: process.close, hasExited: process.hasExited, process, sessionId } satisfies ClaudeConnection;
    }),

  // A user message written mid-turn joins it after the current tool call; its uuid comes back in the echo
  // once taken in (probe of 2026-11-06, Claude Code 2.1.302).
  steer: (connection, message) =>
    Effect.sync(() => {
      connection.process.write({ message: { content: message.text, role: "user" }, type: "user", uuid: message.id });
      return true;
    }),
});

/** The Claude Code adapter, whose processes close with the scope that made it. */
export const makeClaudeHarness = (options: ClaudeOptions) => makeHarnessProcesses(claudeProtocolOf(options), options);

/** Runs each thread in one long-lived `claude -p` stream-json process (CHG-0027). */
export const claudeHarnessLayer = (options: ClaudeOptions) => Layer.effect(Harness, makeClaudeHarness(options));
