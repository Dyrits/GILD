import type { IntelKind, IntelState, Settings } from "@canopy/contracts";
import { Clock, Effect } from "effect";
import { dayMillis, readSettings } from "./settings.ts";

// Intel over time (scoped-intel, Kinds, Fading): an intel's strength falls by half over its kind's half-life
// since it was last used, slower the more it was used. Strength is worked out when read; nothing runs on a timer.

/** Below this strength an intel is dormant: out of the context, still found by search. */
const dormantBelow = 0.15;
/** Below this strength an intel is archived: out of search too, only in the intel panel. */
const archivedBelow = 0.05;

/** The kinds a thread names in `save_intel`. */
export type ToolKind = "rule" | "preference" | "decision" | "fact" | "temporary";

/** The intel kind each `save_intel` kind names. */
export const kindOfTool = {
  decision: "Decision",
  fact: "Fact",
  preference: "Preference",
  rule: "Rule",
  temporary: "Temporary",
} as const satisfies Record<ToolKind, IntelKind>;

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

/** What an intel's strength depends on. */
export interface Fadable {
  readonly isPinned: number;
  readonly kind: IntelKind;
  readonly lastUsedAt: number;
  readonly uses: number;
}

/** The half-life in days of an intel of that kind, or null for a rule, which never fades. */
export const halfLifeDaysOf = (kind: IntelKind, halfLives: Fading["halfLives"]) =>
  ({
    Decision: halfLives.decision,
    Fact: halfLives.fact,
    Preference: halfLives.preference,
    Rule: null,
    Temporary: halfLives.temporary,
  })[kind];

/** From 1 just after a use down towards 0: `0.5 ^ (elapsed / (half-life × (1 + log2(1 + uses))))`. */
export const strengthOf = (intel: Fadable, fading: Fading) => {
  const halfLifeDays = halfLifeDaysOf(intel.kind, fading.halfLives);
  if (intel.isPinned === 1 || halfLifeDays === null) return 1;
  const halfLife = halfLifeDays * dayMillis * (1 + Math.log2(1 + intel.uses));
  const elapsed = Math.max(0, fading.now - intel.lastUsedAt);
  return 0.5 ** (elapsed / halfLife);
};

/**
 * When an intel crossed into dormant and archived since its last use, up to now (scoped-intel, History and
 * undo). Strength halves each half-life, so it reaches a threshold after `half-life × log2(1 / threshold)`.
 */
export const fadingStepsOf = (intel: Fadable, fading: Fading) => {
  const halfLifeDays = halfLifeDaysOf(intel.kind, fading.halfLives);
  if (intel.isPinned === 1 || halfLifeDays === null) return [];
  const halfLife = halfLifeDays * dayMillis * (1 + Math.log2(1 + intel.uses));
  const steps = [
    { at: intel.lastUsedAt + halfLife * Math.log2(1 / dormantBelow), kind: "Dormant" },
    { at: intel.lastUsedAt + halfLife * Math.log2(1 / archivedBelow), kind: "Archived" },
  ] as const;
  return steps.filter((step) => step.at <= fading.now).map((step) => ({ ...step, at: Math.round(step.at) }));
};

/** The state an intel's strength puts it in. */
export const stateOf = (strength: number): IntelState => {
  if (strength < archivedBelow) return "Archived";
  if (strength < dormantBelow) return "Dormant";
  return "Active";
};

/** The state an intel is in now. */
export const stateOfIntel = (intel: Fadable, fading: Fading) => stateOf(strengthOf(intel, fading));

/** The longest summary of a global intel in the index, in characters. Provisional (work-in-progress, Batch 13). */
const summaryLength = 80;

/** A global intel's line in the index: its text, cut at a word past the summary length. */
export const summaryOf = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= summaryLength) return flat;
  const cut = flat.slice(0, summaryLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
};
