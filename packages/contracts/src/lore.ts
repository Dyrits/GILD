import { Schema } from "effect";
import { LoreChangeId, LoreEntryId, LoreHistoryEntryId, LoreProposalId, MissionId, ThreadId } from "./ids.ts";

// Stored and wire names keep `intel` so existing data and agents still work: thread tool names (`save_intel`, ...).

// Scoped lore (scoped-intel): facts, preferences, and decisions kept at the scope where they apply.

/** Where a lore entry applies: a thread and the threads beneath it, a workspace, or everywhere. */
export const LoreScope = Schema.Literals(["Thread", "Workspace", "Global"]);
export type LoreScope = typeof LoreScope.Type;

/** What a lore entry is, which sets how fast it fades when no thread uses it (scoped-intel, Kinds). */
export const LoreKind = Schema.Literals(["Rule", "Preference", "Decision", "Fact", "Temporary"]);
export type LoreKind = typeof LoreKind.Type;

/**
 * Whether a lore entry is in threads' contexts (Active), found only by search (Dormant), or only in the lore
 * panel (Archived), from its strength (scoped-intel, Fading).
 */
export const LoreState = Schema.Literals(["Active", "Dormant", "Archived"]);
export type LoreState = typeof LoreState.Type;

/** The lore panel's state filter: a state, pinned lore, or deleted lore that can be restored. */
export const LoreStateFilter = Schema.Literals(["Active", "Dormant", "Archived", "Pinned", "Deleted"]);
export type LoreStateFilter = typeof LoreStateFilter.Type;

/**
 * What a lore entry rests on (scoped-intel, Saving): the journal entry the thread named, or else the message its
 * turn was answering, as it read when the lore entry was saved.
 */
export const LoreOrigin = Schema.Struct({
  /** The journal entry's number in the saving thread's mission; null for a message. */
  entryNumber: Schema.NullOr(Schema.Number),
  /** The start of the entry or message, cut at a word. */
  excerpt: Schema.String,
  /** For a message: the sending thread's title, or null when the owner sent it; null for an entry too. */
  from: Schema.NullOr(Schema.String),
  kind: Schema.Literals(["JournalEntry", "Message"]),
});
export type LoreOrigin = typeof LoreOrigin.Type;

/** One lore entry as the owner reads it in the lore panel. */
export const LoreEntry = Schema.Struct({
  id: LoreEntryId,
  isPinned: Schema.Boolean,
  kind: LoreKind,
  /** When a thread last used it, or when it was saved or restored. */
  lastUsedAt: Schema.Number,
  /** The mission of the thread it belongs to, for a thread lore entry; null otherwise. */
  missionId: Schema.NullOr(MissionId),
  /** What it rests on; null when nothing was there, or the owner saved it. */
  origin: Schema.NullOr(LoreOrigin),
  savedAt: Schema.Number,
  /** The title of the thread that saved it, as titled then; null when the owner saved it. */
  savedByTitle: Schema.NullOr(Schema.String),
  scope: LoreScope,
  /** The scope in words: the thread's title (with its mission's when it is a top thread), the workspace's name, or Global. */
  scopeLabel: Schema.String,
  state: LoreState,
  /** From 1 when just used down towards 0, halving over its kind's half-life; 1 for a rule or a pinned lore entry. */
  strength: Schema.Number,
  text: Schema.String,
  /** The estimated size in tokens, at about 4 characters per token (scoped-intel, Saving). */
  tokens: Schema.Number,
  updatedAt: Schema.Number,
  /** How many times threads used it: each time search_intel returned it or a thread said it relied on it. */
  uses: Schema.Number,
});
export type LoreEntry = typeof LoreEntry.Type;

/**
 * What a thread did to lore: saved, saved a duplicate that replaced a lore entry's text (scoped-intel,
 * Duplicates), corrected or widened, or deleted.
 */
export const LoreChangeKind = Schema.Literals(["Save", "Replace", "Update", "Forget"]);
export type LoreChangeKind = typeof LoreChangeKind.Type;

/** Whether a change was made at once, or awaits, received, or was refused the owner's approval. */
export const LoreChangeStatus = Schema.Literals(["Done", "Awaiting", "Approved", "Declined"]);
export type LoreChangeStatus = typeof LoreChangeStatus.Type;

/** A thread's change to lore, shown in its thread; global ones and widening wait for the owner. */
export const LoreChange = Schema.Struct({
  at: Schema.Number,
  id: LoreChangeId,
  kind: LoreChangeKind,
  /** The lore changed or deleted; for a save, the lore made, once made. */
  loreEntryId: Schema.NullOr(LoreEntryId),
  /** The lore entry's text before the change, for a replacement, an update, or a deletion. */
  previousText: Schema.NullOr(Schema.String),
  resolvedAt: Schema.NullOr(Schema.Number),
  /** The scope the change puts the lore in, or the scope it was deleted from. */
  scope: LoreScope,
  scopeLabel: Schema.String,
  status: LoreChangeStatus,
  /** The new text, or the deleted text for a deletion. */
  text: Schema.String,
  threadId: ThreadId,
  /** The thread's title. */
  threadTitle: Schema.String,
});
export type LoreChange = typeof LoreChange.Type;

/** How much of the chosen model's context window the lore in a thread's scope takes (scoped-intel, Size warning). */
export const LoreGauge = Schema.Struct({
  /** The active lore entries in scope, in full or as index lines. */
  count: Schema.Number,
  /** Whether it takes more than the warning share, so the lore icon turns red. */
  isOverWarning: Schema.Boolean,
  /** What the lore takes in a turn's context: scoped lore in full and the global index. */
  tokens: Schema.Number,
  /** The share in percent above which the icon turns red (Settings). */
  warningPercent: Schema.Number,
  /** The chosen model's context window, in tokens. */
  windowTokens: Schema.Number,
});
export type LoreGauge = typeof LoreGauge.Type;

/**
 * What an entry in a lore entry's history records (scoped-intel, History and undo): a thread's save, replacement,
 * correction, widening, or deletion; the owner's edit, deletion, pin, unpin, or restore; a proposal the owner
 * approved, which widens, narrows, or merges a lore entry into another; a fading step; or an undo.
 */
export const LoreHistoryKind = Schema.Literals([
  "Saved",
  "Replaced",
  "Corrected",
  "Widened",
  "Narrowed",
  "Merged",
  "Deleted",
  "Edited",
  "Pinned",
  "Unpinned",
  "Restored",
  "Dormant",
  "Archived",
  "Undone",
]);
export type LoreHistoryKind = typeof LoreHistoryKind.Type;

/** Who or what made an entry: a thread, the owner, or fading. */
export const LoreActor = Schema.Literals(["Thread", "Owner", "Fading"]);
export type LoreActor = typeof LoreActor.Type;

/** One entry in a lore entry's history, as the owner reads it in the lore panel. */
export const LoreHistoryEntry = Schema.Struct({
  actor: LoreActor,
  /** The thread's title as it was then; null for the owner and fading. */
  actorTitle: Schema.NullOr(Schema.String),
  /** When the owner approved a thread's global change or widening; null otherwise. */
  approvedAt: Schema.NullOr(Schema.Number),
  at: Schema.Number,
  /** Whether the owner can undo it: made by a thread or the owner, and not undone yet. */
  canUndo: Schema.Boolean,
  id: LoreHistoryEntryId,
  kind: LoreHistoryKind,
  loreEntryId: LoreEntryId,
  /** The text before the entry; null when the lore did not exist before it. */
  previousText: Schema.NullOr(Schema.String),
  /** The scope after the entry, or before it for a deletion, in words. */
  scopeLabel: Schema.String,
  /** The text after the entry; null when the lore no longer exists after it. */
  text: Schema.NullOr(Schema.String),
  /** For an undo: what kind of entry it undid; null otherwise. */
  undid: Schema.NullOr(LoreHistoryKind),
  /** When the owner undid it; null while it stands. */
  undoneAt: Schema.NullOr(Schema.Number),
});
export type LoreHistoryEntry = typeof LoreHistoryEntry.Type;

/** A lore entry's history, newest first, for an existing or a deleted lore entry. */
export const LoreHistory = Schema.Struct({
  entries: Schema.Array(LoreHistoryEntry),
  isDeleted: Schema.Boolean,
  loreEntryId: LoreEntryId,
});
export type LoreHistory = typeof LoreHistory.Type;

/** A deleted lore entry the owner can bring back by undoing its deletion. */
export const DeletedLoreEntry = Schema.Struct({
  deletedAt: Schema.Number,
  /** The history entry that deleted it, which Undo deletion undoes. */
  entryId: LoreHistoryEntryId,
  id: LoreEntryId,
  kind: LoreKind,
  scope: LoreScope,
  scopeLabel: Schema.String,
  text: Schema.String,
});
export type DeletedLoreEntry = typeof DeletedLoreEntry.Type;

/** What the service proposes from evidence: one global lore entry for the same one in several workspaces, or a narrower scope. */
export const LoreProposalKind = Schema.Literals(["Widen", "Narrow"]);
export type LoreProposalKind = typeof LoreProposalKind.Type;

/** A lore entry a proposal moves or merges, as it is now. */
export const ProposedLoreEntry = Schema.Struct({
  id: LoreEntryId,
  scopeLabel: Schema.String,
  text: Schema.String,
});
export type ProposedLoreEntry = typeof ProposedLoreEntry.Type;

/**
 * A widening or narrowing the service proposes from evidence, waiting in the lore panel for the owner's
 * approval and changing nothing before it (scoped-intel, Widening and narrowing).
 */
export const LoreProposal = Schema.Struct({
  /** For a narrowing: the half-life in days over which every use came from one workspace; null for a widening. */
  halfLifeDays: Schema.NullOr(Schema.Number),
  id: LoreProposalId,
  kind: LoreProposalKind,
  /** The lore entries it moves: each workspace's for a widening, the global one for a narrowing. */
  loreEntries: Schema.Array(ProposedLoreEntry),
  /** The kind the lore entry has once moved: the newest one's for a widening. */
  loreKind: LoreKind,
  /** The scope it proposes, in words. */
  scopeLabel: Schema.String,
  /** The text the lore entry keeps: the newest one's for a widening. */
  text: Schema.String,
  /** For a narrowing: the uses over that half-life, all from the workspace; null for a widening. */
  uses: Schema.NullOr(Schema.Number),
});
export type LoreProposal = typeof LoreProposal.Type;

/** The lore panel: lore in one thread's scope (most specific first) or all, and the changes awaiting approval. */
export const LoreView = Schema.Struct({
  awaiting: Schema.Array(LoreChange),
  /** Deleted lore, newest deletion first, listed only under the Deleted filter. */
  deleted: Schema.Array(DeletedLoreEntry),
  /** The thread's gauge when the panel was opened from a thread; null otherwise. */
  gauge: Schema.NullOr(LoreGauge),
  loreEntries: Schema.Array(LoreEntry),
  /** Widenings and narrowings proposed from evidence, awaiting the owner. */
  proposals: Schema.Array(LoreProposal),
});
export type LoreView = typeof LoreView.Type;
