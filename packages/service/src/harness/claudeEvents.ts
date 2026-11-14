import type { BillingKind, TokenUsage } from "@iskios/contracts";
import { Option, Schema } from "effect";
import { fieldOf, numberFieldOf, textFieldOf } from "../core/index.ts";

const decodeContent = Schema.decodeUnknownOption(Schema.Array(Schema.Unknown));
const decodeToolUse = Schema.decodeUnknownOption(
  Schema.Struct({
    id: Schema.String,
    input: Schema.optional(Schema.Unknown),
    name: Schema.String,
    type: Schema.Literal("tool_use"),
  }),
);

/** The model that wrote a message, or null when none is named; Claude Code's own placeholder `<synthetic>` names none. */
export const reportedModelOf = (message: unknown): string | null => {
  const model = textFieldOf(message, "model");
  return model === null || model.startsWith("<") ? null : model;
};

/**
 * How a Claude Code process was billed, from the `apiKeySource` of its init event: `none` is the subscription
 * sign-in, any other source is an API key, and an event without the field says nothing. Unprobed live (backlog,
 * Consumption and cost, build order).
 */
export const billingOf = (event: unknown, previous: BillingKind): BillingKind => {
  const source = textFieldOf(event, "apiKeySource");
  return source === null ? previous : source === "none" ? "Subscription" : "ApiKey";
};

/** Token usage decoded from a Claude Code stream event or message, or null when absent. */
export const usageOf = (usage: unknown): TokenUsage | null =>
  usage === undefined || usage === null
    ? null
    : {
        cacheCreation: numberFieldOf(usage, "cache_creation_input_tokens"),
        cacheRead: numberFieldOf(usage, "cache_read_input_tokens"),
        input: numberFieldOf(usage, "input_tokens"),
        output: numberFieldOf(usage, "output_tokens"),
      };

/** What a model call's prompt and reply held, or null when the call reported no usage. */
export const contextOf = (usage: TokenUsage | null) =>
  usage === null ? null : usage.input + usage.cacheRead + usage.cacheCreation + usage.output;

/** Plain text blocks joined from a Claude Code assistant message's content. */
export const textOf = (content: unknown) =>
  Array.isArray(content)
    ? content
        .filter((block) => textFieldOf(block, "type") === "text")
        .map((block) => textFieldOf(block, "text") ?? "")
        .join("")
    : "";

/** The valid tool calls in complete Claude assistant content; unrelated and malformed blocks are ignored. */
export const toolCallsOf = (content: unknown) =>
  Option.getOrElse(decodeContent(content), () => []).flatMap((block) =>
    Option.match(decodeToolUse(block), {
      onNone: () => [],
      onSome: ({ id, input, name }) => [{ id, input, toolName: name }],
    }),
  );

/** Why a turn's error result failed it, from the fields Claude Code reports. */
export const failureReasonOf = (event: unknown, reportedError: string | null) => {
  const result = textFieldOf(event, "result");
  const errors = fieldOf(event, "errors");
  return (
    reportedError ??
    (result !== null && result !== "" ? result : null) ??
    (Array.isArray(errors) ? errors.join("; ") : null) ??
    `Claude Code reported ${textFieldOf(event, "subtype") ?? "an error"}.`
  );
};
