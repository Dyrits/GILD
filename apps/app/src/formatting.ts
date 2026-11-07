import type { EffortChoice, HarnessName, ModelChoice, ModelOption, TokenUsage } from "@openmission/contracts";

export const harnessLabels = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
} as const satisfies Record<HarnessName, string>;

/** A model's label from its harness's list, or its identifier when the list does not name it. */
export const modelLabelOf = (model: ModelChoice, options: ReadonlyArray<ModelOption> = []) =>
  options.find((option) => option.id === model)?.label ??
  (model === "default" ? "Default model" : model.charAt(0).toUpperCase() + model.slice(1));
export const effortLabel = (effort: EffortChoice) => (effort === "default" ? "Default effort" : effort);

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));
export const usageText = (usage: TokenUsage) =>
  `${compact(usage.input + usage.cacheRead + usage.cacheCreation)} in · ${compact(usage.output)} out tokens`;
export const usageDetail = (usage: TokenUsage) =>
  `Input ${usage.input}, cache read ${usage.cacheRead}, cache written ${usage.cacheCreation}, output ${usage.output} tokens`;

export const timeOf = (millis: number) => new Date(millis).toLocaleString();
