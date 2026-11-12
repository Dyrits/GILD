import { tmpdir } from "node:os";
import type { BillingKind, TokenUsage } from "@iskios/contracts";
import { type Duration, Effect, Layer, Queue } from "effect";
import {
  fieldOf,
  Harness,
  type HarnessAdapter,
  HarnessFailure,
  type ImageAttachment,
  numberFieldOf,
  type PlanLimitReport,
  type PlanLimitsReport,
  readImages,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import { type AccessOptions, accessArgsOf, baseArgsOf, noTimeLimit } from "./claudeArgs.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import { type HarnessConnection, type HarnessProtocol, makeHarnessProcesses } from "./harnessProcesses.ts";
import {
  harnessEnvironmentOf,
  runHarnessCommand,
  type StreamJsonProcess,
  startStreamJsonProcess,
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
  /** How the process was signed in, from the init event; Unknown until it reports (budget-control, Billing kind). */
  billing: BillingKind;
  /** The cost Claude Code last reported for this process, which it adds up across turns (provisional, unprobed). */
  lastTotalCost: number;
  readonly process: StreamJsonProcess;
}

/** The model that wrote a message, or null when none is named; Claude Code's own placeholder `<synthetic>` names none. */
const reportedModelOf = (message: unknown): string | null => {
  const model = textFieldOf(message, "model");
  return model === null || model.startsWith("<") ? null : model;
};

/**
 * How a Claude Code process was billed, from the `apiKeySource` of its init event: `none` is the subscription
 * sign-in, any other source is an API key, and an event without the field says nothing. Unprobed live (backlog,
 * Consumption and cost, build order).
 */
const billingOf = (event: unknown, previous: BillingKind): BillingKind => {
  const source = textFieldOf(event, "apiKeySource");
  return source === null ? previous : source === "none" ? "Subscription" : "ApiKey";
};

/** The plan windows Claude Code reports in a `rate_limit_event`, by name, with their length in minutes. */
const planWindowMinutes = { five_hour: 300, seven_day: 10_080 } as const;

/**
 * The plan limits a `rate_limit_event` carries (probe of 2026-11-12, Claude Code 2.1.322): `unifiedWindows` holds the
 * 5-hour and weekly windows, each with `utilization` (0 to 1) and `resetsAt` (seconds). Null when the event has none.
 */
export const planLimitsOf = (event: unknown, billing: BillingKind): PlanLimitsReport | null => {
  const windows = fieldOf(fieldOf(event, "rate_limit_info"), "unifiedWindows");
  if (typeof windows !== "object" || windows === null) return null;
  const reported = (Object.keys(planWindowMinutes) as Array<keyof typeof planWindowMinutes>).flatMap(
    (name): Array<PlanLimitReport> => {
      const window = fieldOf(windows, name);
      const utilization = fieldOf(window, "utilization");
      const resetsAt = fieldOf(window, "resetsAt");
      return typeof utilization === "number" && typeof resetsAt === "number"
        ? [
            {
              resetsAtSeconds: resetsAt,
              usedPercent: Math.round(utilization * 1000) / 10,
              windowMinutes: planWindowMinutes[name],
            },
          ]
        : [];
    },
  );
  return reported.length === 0 ? null : { billing, windows: reported };
};

/** The turn's own cost from the result's running total; a total that fell means a fresh count. */
const turnCostOf = (connection: ClaudeConnection, total: unknown): number | null => {
  if (typeof total !== "number" || !Number.isFinite(total)) return null;
  const cost = total >= connection.lastTotalCost ? total - connection.lastTotalCost : total;
  connection.lastTotalCost = total;
  return Math.round(cost * 1e6) / 1e6;
};

/** The child's environment, signed in with the turn's account (provider-accounts). */
const childEnvironment = (configDirectory: string | null) =>
  harnessEnvironmentOf({ ...accountEnvironmentOf("claude", configDirectory), MCP_TOOL_TIMEOUT: String(noTimeLimit) });

const usageOf = (usage: unknown): TokenUsage | null =>
  usage === undefined || usage === null
    ? null
    : {
        cacheCreation: numberFieldOf(usage, "cache_creation_input_tokens"),
        cacheRead: numberFieldOf(usage, "cache_read_input_tokens"),
        input: numberFieldOf(usage, "input_tokens"),
        output: numberFieldOf(usage, "output_tokens"),
      };

/** What a model call's prompt and reply held, or null when the call reported no usage. */
const contextOf = (usage: TokenUsage | null) =>
  usage === null ? null : usage.input + usage.cacheRead + usage.cacheCreation + usage.output;

/** A user message's content: the text alone, or the text then one base64 image block per image (message-attachments). */
const contentOf = (text: string, images: ReadonlyArray<ImageAttachment>) =>
  Effect.gen(function* () {
    if (images.length === 0) return text;
    const read = yield* readImages(images);
    return [
      { text, type: "text" },
      ...read.map((image) => ({
        source: { data: image.data, media_type: image.mediaType, type: "base64" },
        type: "image",
      })),
    ];
  });

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
const claudeProtocolOf = (
  options: ClaudeOptions,
  reports: Map<string, PlanLimitsReport>,
): HarnessProtocol<ClaudeConnection> => ({
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
  // restarts the process, resuming its conversation; the journal and lore ride on the turn's message instead.
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
      const content = yield* contentOf(turnMessageOf(request), request.images);
      connection.process.write({ message: { content, role: "user" }, type: "user" });
      let draft = "";
      let reportedError: string | null = null;
      // The latest call's own usage is the context then; the result's usage sums every call of the turn.
      let context: number | null = null;
      for (;;) {
        const item = yield* Queue.take(connection.process.incoming);
        if (item._tag === "Exit") return yield* new HarnessFailure({ reason: item.reason });
        const event = item.message;
        const type = textFieldOf(event, "type");
        if (type === "system" && textFieldOf(event, "subtype") === "init") {
          connection.billing = billingOf(event, connection.billing);
        } else if (type === "rate_limit_event") {
          // Kept for the plan's limits, which then cost no read of their own.
          const report = planLimitsOf(event, connection.billing);
          if (report !== null) reports.set(request.configDirectory ?? "", report);
        } else if (type === "user") {
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
          const callUsage = usageOf(fieldOf(fieldOf(event, "message"), "usage"));
          const call = contextOf(callUsage);
          // A synthetic message reports zeros, which are no measure.
          if (call !== null && call > 0) context = call;
          draft = "";
          // A synthetic assistant message carrying `error` reports a failure, not a reply.
          if (error !== undefined && error !== null) reportedError = text || String(error);
          else if (text.trim() !== "")
            yield* request.onEvent({
              _tag: "Reply",
              model: reportedModelOf(fieldOf(event, "message")),
              text,
              usage: callUsage !== null && call !== null && call > 0 ? callUsage : null,
            });
        } else if (type === "result") {
          // An interrupted turn ends with an error result, which is no failure (probe of 2026-11-06).
          const usage = usageOf(fieldOf(event, "usage"));
          const cost = turnCostOf(connection, fieldOf(event, "total_cost_usd"));
          if (turn.isInterrupting()) return { billing: connection.billing, context, cost, isInterrupted: true, usage };
          if (fieldOf(event, "is_error") === true || reportedError !== null)
            return yield* new HarnessFailure({ reason: failureReasonOf(event, reportedError) });
          return { billing: connection.billing, context, cost, isInterrupted: false, usage };
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
          ...baseArgsOf(request.access.unaskedTools),
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
      return {
        billing: "Unknown",
        close: process.close,
        hasExited: process.hasExited,
        lastTotalCost: 0,
        process,
        sessionId,
      } satisfies ClaudeConnection;
    }),

  // A user message written mid-turn joins it after the current tool call; its uuid comes back in the echo
  // once taken in (probe of 2026-11-06, Claude Code 2.1.302).
  steer: (connection, message) =>
    contentOf(message.text, message.images).pipe(
      Effect.map((content) => {
        connection.process.write({ message: { content, role: "user" }, type: "user", uuid: message.id });
        return true;
      }),
      Effect.catch(() => Effect.succeed(false)),
    ),
});

/** The arguments of the smallest turn that makes Claude Code report the plan's limits: one word to its cheapest model. */
const probeArgs = [
  "-p",
  "ok",
  "--output-format",
  "stream-json",
  "--verbose",
  "--max-turns",
  "1",
  "--model",
  "haiku",
  "--tools",
  "",
  "--no-session-persistence",
  "--setting-sources",
  "",
  "--disable-slash-commands",
  "--strict-mcp-config",
];

/**
 * Asks Claude Code for an account's plan limits with one minimal turn, in an empty folder: the stream's
 * `rate_limit_event` answers. Null when it reports none. No token or credential is read here.
 */
const probeClaudePlanLimits = (options: ClaudeOptions, configDirectory: string | null) =>
  Effect.gen(function* () {
    const run = yield* runHarnessCommand(
      options.command,
      [...(options.prefixArgs ?? []), ...probeArgs],
      accountEnvironmentOf("claude", configDirectory),
      60_000,
      tmpdir(),
    );
    let billing: BillingKind = "Unknown";
    let report: PlanLimitsReport | null = null;
    for (const line of run.stdout.split("\n")) {
      let event: unknown;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (textFieldOf(event, "type") === "system" && textFieldOf(event, "subtype") === "init")
        billing = billingOf(event, billing);
      else if (textFieldOf(event, "type") === "rate_limit_event") report = planLimitsOf(event, billing) ?? report;
    }
    if (report === null && run.code !== 0)
      return yield* new HarnessFailure({ reason: "Claude Code gave no plan limits." });
    return billing === "ApiKey" ? ({ billing, windows: [] } satisfies PlanLimitsReport) : report;
  });

/**
 * The Claude Code adapter, whose processes close with the scope that made it. Its plan limits come from the
 * `rate_limit_event` of the account's latest turn; an account with none yet is probed once per run.
 */
export const makeClaudeHarness = (options: ClaudeOptions) =>
  Effect.gen(function* () {
    const reports = new Map<string, PlanLimitsReport>();
    const probed = new Set<string>();
    const adapter = yield* makeHarnessProcesses(claudeProtocolOf(options, reports), options);
    const readPlanLimits = (_harness: unknown, configDirectory: string | null) => {
      const key = configDirectory ?? "";
      const known = reports.get(key);
      if (known !== undefined) return Effect.succeed<PlanLimitsReport | null>(known);
      if (probed.has(key)) return Effect.succeed<PlanLimitsReport | null>(null);
      probed.add(key);
      return probeClaudePlanLimits(options, configDirectory).pipe(
        Effect.tap((report) => Effect.sync(() => report !== null && reports.set(key, report))),
        // A failed probe is tried again after the caller's wait.
        Effect.tapError(() => Effect.sync(() => probed.delete(key))),
      );
    };
    return { ...adapter, readPlanLimits } satisfies HarnessAdapter;
  });

/** Runs each thread in one long-lived `claude -p` stream-json process (CHG-0027). */
export const claudeHarnessLayer = (options: ClaudeOptions) => Layer.effect(Harness, makeClaudeHarness(options));
