import type { LoreKind, LoreState, Settings } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { dayMillis, readSettings } from "../core/index.ts";

// Stored and wire names keep `intel` so existing data and agents still work: thread tool names (`save_intel`, ...) and settings keys (`intelHalfLives`, `intelWarningPercent`).

// Lore over time (scoped-intel, Kinds, Fading): a lore entry's strength falls by half over its kind's half-life
// since it was last used, slower the more it was used. Strength is worked out when read; nothing runs on a timer.

/** Below this strength a lore entry is dormant: out of the context, still found by search. */
const dormantBelow = 0.15;
/** Below this strength a lore entry is archived: out of search too, only in the lore panel. */
const archivedBelow = 0.05;

/** The kinds a thread names in `save_intel`. */
export type ToolKind = "rule" | "preference" | "decision" | "fact" | "temporary";

/** The lore kind each `save_intel` kind names. */
export const kindOfTool = {
  decision: "Decision",
  fact: "Fact",
  preference: "Preference",
  rule: "Rule",
  temporary: "Temporary",
} as const satisfies Record<ToolKind, LoreKind>;

/** What fading needs to know: the time now and the half-lives in Settings. */
export interface Fading {
  readonly halfLives: Settings["intelHalfLives"];
  readonly now: number;
}

/** Reads the time now and the half-lives in Settings. */
export const readFading = Effect.gen(function* () {
  const now = yield* Clock.currentTimeMillis;
  const { intelHalfLives } = yield* readSettings;
  return { halfLives: intelHalfLives, now } satisfies Fading;
});

/** What a lore entry's strength depends on. */
export interface Fadable {
  readonly isPinned: number;
  readonly kind: LoreKind;
  readonly lastUsedAt: number;
  readonly uses: number;
}

/** The half-life in days of a lore entry of that kind, or null for a rule, which never fades. */
export const halfLifeDaysOf = (kind: LoreKind, halfLives: Fading["halfLives"]) =>
  ({
    Decision: halfLives.decision,
    Fact: halfLives.fact,
    Preference: halfLives.preference,
    Rule: null,
    Temporary: halfLives.temporary,
  })[kind];

/** From 1 just after a use down towards 0: `0.5 ^ (elapsed / (half-life × (1 + log2(1 + uses))))`. */
export const strengthOf = (loreEntry: Fadable, fading: Fading) => {
  const halfLifeDays = halfLifeDaysOf(loreEntry.kind, fading.halfLives);
  if (loreEntry.isPinned === 1 || halfLifeDays === null) return 1;
  const halfLife = halfLifeDays * dayMillis * (1 + Math.log2(1 + loreEntry.uses));
  const elapsed = Math.max(0, fading.now - loreEntry.lastUsedAt);
  return 0.5 ** (elapsed / halfLife);
};

/**
 * When a lore entry crossed into dormant and archived since its last use, up to now (scoped-intel, History and
 * undo). Strength halves each half-life, so it reaches a threshold after `half-life × log2(1 / threshold)`.
 */
export const fadingStepsOf = (loreEntry: Fadable, fading: Fading) => {
  const halfLifeDays = halfLifeDaysOf(loreEntry.kind, fading.halfLives);
  if (loreEntry.isPinned === 1 || halfLifeDays === null) return [];
  const halfLife = halfLifeDays * dayMillis * (1 + Math.log2(1 + loreEntry.uses));
  const steps = [
    { at: loreEntry.lastUsedAt + halfLife * Math.log2(1 / dormantBelow), kind: "Dormant" },
    { at: loreEntry.lastUsedAt + halfLife * Math.log2(1 / archivedBelow), kind: "Archived" },
  ] as const;
  return steps.filter((step) => step.at <= fading.now).map((step) => ({ ...step, at: Math.round(step.at) }));
};

/** The state a lore entry's strength puts it in. */
export const stateOf = (strength: number): LoreState => {
  if (strength < archivedBelow) return "Archived";
  if (strength < dormantBelow) return "Dormant";
  return "Active";
};

/** The state a lore entry is in now. */
export const stateOfLoreEntry = (loreEntry: Fadable, fading: Fading) => stateOf(strengthOf(loreEntry, fading));

/** The longest summary of a global lore entry in the index, in characters. Provisional (work-in-progress, Batch 13). */
const summaryLength = 80;

/** A global lore entry's line in the index: its text, cut at a word past the summary length. */
export const summaryOf = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= summaryLength) return flat;
  const cut = flat.slice(0, summaryLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
};
