import type { EffortChoice, MissionState, ModelChoice, ThreadState, TokenUsage } from "@openmission/contracts";

export const stateColors: Record<ThreadState | MissionState, string> = {
  Archived: "#6b7280",
  Attention: "#b45309",
  Done: "#15803d",
  Failed: "#b91c1c",
  Idle: "#4b5563",
  Running: "#1d4ed8",
  Stopped: "#374151",
  Waiting: "#7c3aed",
};

export const modelLabels: Record<ModelChoice, string> = {
  default: "Claude Code default",
  fable: "Fable",
  haiku: "Haiku",
  opus: "Opus",
  sonnet: "Sonnet",
};
export const effortLabel = (effort: EffortChoice) => (effort === "default" ? "Default effort" : effort);

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));
export const usageText = (usage: TokenUsage) =>
  `${compact(usage.input + usage.cacheRead + usage.cacheCreation)} in · ${compact(usage.output)} out tokens`;
export const usageDetail = (usage: TokenUsage) =>
  `Input ${usage.input}, cache read ${usage.cacheRead}, cache written ${usage.cacheCreation}, output ${usage.output} tokens`;

export const timeOf = (millis: number) => new Date(millis).toLocaleString();
