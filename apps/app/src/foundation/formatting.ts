import type { EffortChoice, HarnessName, ModelChoice, ModelOption, TokenUsage } from "@iskios/contracts";

/** Each harness by the name the owner reads. */
export const harnessLabels = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
} as const satisfies Record<HarnessName, string>;

/** A model's label from its harness's list, or its identifier when the list does not name it. */
export const modelLabelOf = (model: ModelChoice, options: ReadonlyArray<ModelOption> = []) =>
  options.find((option) => option.id === model)?.label ??
  (model === "default"
    ? "Default model"
    : (knownModelOf(model)?.name ?? model.charAt(0).toUpperCase() + model.slice(1)));

/** Each harness's usual model company, when the model's own identifier names none. */
const harnessProviders = { claude: "Anthropic", codex: "OpenAI", opencode: "OpenCode" } as const satisfies Record<
  HarnessName,
  string
>;

const titled = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** A model identifier as company and readable name with version, such as `claude-sonnet-5-5` as Anthropic and "Sonnet 5.5"; null when unrecognised. */
const knownModelOf = (id: string): { name: string; provider: string } | null => {
  const withoutDate = id.replace(/-\d{8}$/, "");
  // Claude: `claude-sonnet-5-5` and `claude-opus-4-1`, or the older `claude-3-5-sonnet`.
  const claude =
    /^claude-(fable|opus|sonnet|haiku)-(\d+(?:-\d+)?)$/.exec(withoutDate) ??
    /^claude-(\d+(?:-\d+)?)-(opus|sonnet|haiku)$/.exec(withoutDate);
  if (claude !== null) {
    const [family, version] = /^\d/.test(claude[1] ?? "") ? [claude[2], claude[1]] : [claude[1], claude[2]];
    return { name: `${titled(family ?? "")} ${(version ?? "").replace("-", ".")}`, provider: "Anthropic" };
  }
  // The bare Claude aliases the thread's chosen model uses: `sonnet`.
  if (/^(fable|opus|sonnet|haiku)$/.test(withoutDate)) return { name: titled(withoutDate), provider: "Anthropic" };
  // OpenAI: `gpt-5.1-codex` as "GPT-5.1 Codex".
  const gpt = /^gpt-(.+)$/.exec(withoutDate);
  if (gpt !== null) return { name: `GPT-${(gpt[1] ?? "").split("-").map(titled).join(" ")}`, provider: "OpenAI" };
  return null;
};

/**
 * The Companion's label above its reply: the model company, then the model's name and version, such as
 * "Anthropic - Sonnet 5.5". It uses the model the harness reported for the reply; without one, the thread's
 * chosen model.
 */
export const companionLabelOf = (harness: HarnessName, reported: string | null, chosen: ModelChoice) => {
  const known = reported === null ? null : knownModelOf(reported);
  if (known !== null) return `${known.provider} - ${known.name}`;
  const name = reported ?? modelLabelOf(chosen);
  return `${harnessProviders[harness]} - ${name}`;
};

/**
 * Who wrote an agent reply: the harness and model recorded with it, so a handover leaves earlier replies under their own
 * provider and model (thread-handover). A reply that recorded no harness (from before handovers) is the thread's own;
 * one that recorded no model was written by the harness's default.
 */
export const replyWriterOf = (
  reply: { readonly harness: HarnessName | null; readonly model: string | null },
  threadHarness: HarnessName,
) => {
  const harness = reply.harness ?? threadHarness;
  return { harness, label: companionLabelOf(harness, reply.model, "default") };
};

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

/** Seconds as a short span: `16s`, `1m 4s`. */
export const spanOf = (seconds: number) =>
  seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
