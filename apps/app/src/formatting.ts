import type { EffortChoice, HarnessName, ModelChoice, ModelOption, TokenUsage } from "@gild/contracts";

/** Each harness by the name the owner reads. */
export const harnessLabels = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
} as const satisfies Record<HarnessName, string>;

/** A model's label from its harness's list, or its identifier when the list does not name it. */
export const modelLabelOf = (model: ModelChoice, options: ReadonlyArray<ModelOption> = []) =>
  options.find((option) => option.id === model)?.label ??
  (model === "default" ? "Default model" : model.charAt(0).toUpperCase() + model.slice(1));
/** An effort level as the owner reads it. */
export const effortLabel = (effort: EffortChoice) => (effort === "default" ? "Default effort" : effort);

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));
/** A turn's tokens in short, for example "12k in · 800 out tokens". */
export const usageText = (usage: TokenUsage) =>
  `${compact(usage.input + usage.cacheRead + usage.cacheCreation)} in · ${compact(usage.output)} out tokens`;
/** A turn's tokens in full, each kind counted. */
export const usageDetail = (usage: TokenUsage) =>
  `Input ${usage.input}, cache read ${usage.cacheRead}, cache written ${usage.cacheCreation}, output ${usage.output} tokens`;

/** A moment as its date and time, in the owner's locale. */
export const timeOf = (millis: number) => new Date(millis).toLocaleString();

/** A moment as its hours and minutes, in the owner's locale. */
export const clockOf = (millis: number) =>
  new Date(millis).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
