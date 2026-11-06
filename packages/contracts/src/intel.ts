import { Schema } from "effect";
import { IntelChangeId, IntelId, MissionId, ThreadId } from "./ids.ts";

// Scoped intel (scoped-intel): facts, preferences, and decisions kept at the scope where they apply.

/** Where an intel applies: a thread and the threads beneath it, a workspace, or everywhere. */
export const IntelScope = Schema.Literals(["Thread", "Workspace", "Global"]);
export type IntelScope = typeof IntelScope.Type;

/** What an intel is, which sets how fast it fades when no thread uses it (scoped-intel, Kinds). */
export const IntelKind = Schema.Literals(["Rule", "Preference", "Decision", "Fact", "Temporary"]);
export type IntelKind = typeof IntelKind.Type;

/**
 * Whether an intel is in threads' contexts (Active), found only by search (Dormant), or only in the intel
 * panel (Archived), from its strength (scoped-intel, Fading).
 */
export const IntelState = Schema.Literals(["Active", "Dormant", "Archived"]);
export type IntelState = typeof IntelState.Type;

/** The intel panel's state filter: a state, or pinned intel. */
export const IntelStateFilter = Schema.Literals(["Active", "Dormant", "Archived", "Pinned"]);
export type IntelStateFilter = typeof IntelStateFilter.Type;

/** One intel as the owner reads it in the intel panel. */
export const Intel = Schema.Struct({
  id: IntelId,
  isPinned: Schema.Boolean,
  kind: IntelKind,
  /** When a thread last used it, or when it was saved or restored. */
  lastUsedAt: Schema.Number,
  /** The mission of the thread it belongs to, for a thread intel; null otherwise. */
  missionId: Schema.NullOr(MissionId),
  savedAt: Schema.Number,
  /** The title of the thread that saved it, as titled then; null when the owner saved it. */
  savedByTitle: Schema.NullOr(Schema.String),
  scope: IntelScope,
  /** The scope in words: the thread's title (with its mission's when it is a top thread), the workspace's name, or Global. */
  scopeLabel: Schema.String,
  state: IntelState,
  /** From 1 when just used down towards 0, halving over its kind's half-life; 1 for a rule or a pinned intel. */
  strength: Schema.Number,
  text: Schema.String,
  /** The estimated size in tokens, at about 4 characters per token (scoped-intel, Saving). */
  tokens: Schema.Number,
  updatedAt: Schema.Number,
  /** How many times threads used it: each time search_intel returned it. */
  uses: Schema.Number,
});
export type Intel = typeof Intel.Type;

/** What a thread did to intel: saved, corrected or widened, or deleted. */
export const IntelChangeKind = Schema.Literals(["Save", "Update", "Forget"]);
export type IntelChangeKind = typeof IntelChangeKind.Type;

/** Whether a change was made at once, or awaits, received, or was refused the owner's approval. */
export const IntelChangeStatus = Schema.Literals(["Done", "Awaiting", "Approved", "Declined"]);
export type IntelChangeStatus = typeof IntelChangeStatus.Type;

/** A thread's change to intel, shown in its thread; global ones and widening wait for the owner. */
export const IntelChange = Schema.Struct({
  at: Schema.Number,
  id: IntelChangeId,
  /** The intel changed or deleted; for a save, the intel made, once made. */
  intelId: Schema.NullOr(IntelId),
  kind: IntelChangeKind,
  /** The intel's text before the change, for an update or a deletion. */
  previousText: Schema.NullOr(Schema.String),
  resolvedAt: Schema.NullOr(Schema.Number),
  /** The scope the change puts the intel in, or the scope it was deleted from. */
  scope: IntelScope,
  scopeLabel: Schema.String,
  status: IntelChangeStatus,
  /** The new text, or the deleted text for a deletion. */
  text: Schema.String,
  threadId: ThreadId,
  /** The thread's title. */
  threadTitle: Schema.String,
});
export type IntelChange = typeof IntelChange.Type;

/** How much of the chosen model's context window the intel in a thread's scope takes (scoped-intel, Size warning). */
export const IntelGauge = Schema.Struct({
  /** The active intels in scope, in full or as index lines. */
  count: Schema.Number,
  /** Whether it takes more than the warning share, so the intel icon turns red. */
  isOverWarning: Schema.Boolean,
  /** What the intel takes in a turn's context: scoped intel in full and the global index. */
  tokens: Schema.Number,
  /** The share in percent above which the icon turns red (Settings). */
  warningPercent: Schema.Number,
  /** The chosen model's context window, in tokens. */
  windowTokens: Schema.Number,
});
export type IntelGauge = typeof IntelGauge.Type;

/** The intel panel: intel in one thread's scope (most specific first) or all, and the changes awaiting approval. */
export const IntelView = Schema.Struct({
  awaiting: Schema.Array(IntelChange),
  /** The thread's gauge when the panel was opened from a thread; null otherwise. */
  gauge: Schema.NullOr(IntelGauge),
  intels: Schema.Array(Intel),
});
export type IntelView = typeof IntelView.Type;
