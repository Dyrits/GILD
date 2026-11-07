import { Schema } from "effect";
import { IntelChangeId, IntelHistoryEntryId, IntelId, IntelProposalId, MissionId, ThreadId } from "./ids.ts";

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

/** The intel panel's state filter: a state, pinned intel, or deleted intel that can be restored. */
export const IntelStateFilter = Schema.Literals(["Active", "Dormant", "Archived", "Pinned", "Deleted"]);
export type IntelStateFilter = typeof IntelStateFilter.Type;

/**
 * What an intel rests on (scoped-intel, Saving): the journal entry the thread named, or else the message its
 * turn was answering, as it read when the intel was saved.
 */
export const IntelOrigin = Schema.Struct({
  /** The journal entry's number in the saving thread's mission; null for a message. */
  entryNumber: Schema.NullOr(Schema.Number),
  /** The start of the entry or message, cut at a word. */
  excerpt: Schema.String,
  /** For a message: the sending thread's title, or null when the owner sent it; null for an entry too. */
  from: Schema.NullOr(Schema.String),
  kind: Schema.Literals(["JournalEntry", "Message"]),
});
export type IntelOrigin = typeof IntelOrigin.Type;

/** One intel as the owner reads it in the intel panel. */
export const Intel = Schema.Struct({
  id: IntelId,
  isPinned: Schema.Boolean,
  kind: IntelKind,
  /** When a thread last used it, or when it was saved or restored. */
  lastUsedAt: Schema.Number,
  /** The mission of the thread it belongs to, for a thread intel; null otherwise. */
  missionId: Schema.NullOr(MissionId),
  /** What it rests on; null when nothing was there, or the owner saved it. */
  origin: Schema.NullOr(IntelOrigin),
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
  /** How many times threads used it: each time search_intel returned it or a thread said it relied on it. */
  uses: Schema.Number,
});
export type Intel = typeof Intel.Type;

/**
 * What a thread did to intel: saved, saved a duplicate that replaced an intel's text (scoped-intel,
 * Duplicates), corrected or widened, or deleted.
 */
export const IntelChangeKind = Schema.Literals(["Save", "Replace", "Update", "Forget"]);
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
  /** The intel's text before the change, for a replacement, an update, or a deletion. */
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

/**
 * What an entry in an intel's history records (scoped-intel, History and undo): a thread's save, replacement,
 * correction, widening, or deletion; the owner's edit, deletion, pin, unpin, or restore; a proposal the owner
 * approved, which widens, narrows, or merges an intel into another; a fading step; or an undo.
 */
export const IntelHistoryKind = Schema.Literals([
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
export type IntelHistoryKind = typeof IntelHistoryKind.Type;

/** Who or what made an entry: a thread, the owner, or fading. */
export const IntelActor = Schema.Literals(["Thread", "Owner", "Fading"]);
export type IntelActor = typeof IntelActor.Type;

/** One entry in an intel's history, as the owner reads it in the intel panel. */
export const IntelHistoryEntry = Schema.Struct({
  actor: IntelActor,
  /** The thread's title as it was then; null for the owner and fading. */
  actorTitle: Schema.NullOr(Schema.String),
  /** When the owner approved a thread's global change or widening; null otherwise. */
  approvedAt: Schema.NullOr(Schema.Number),
  at: Schema.Number,
  /** Whether the owner can undo it: made by a thread or the owner, and not undone yet. */
  canUndo: Schema.Boolean,
  id: IntelHistoryEntryId,
  intelId: IntelId,
  kind: IntelHistoryKind,
  /** The text before the entry; null when the intel did not exist before it. */
  previousText: Schema.NullOr(Schema.String),
  /** The scope after the entry, or before it for a deletion, in words. */
  scopeLabel: Schema.String,
  /** The text after the entry; null when the intel no longer exists after it. */
  text: Schema.NullOr(Schema.String),
  /** For an undo: what kind of entry it undid; null otherwise. */
  undid: Schema.NullOr(IntelHistoryKind),
  /** When the owner undid it; null while it stands. */
  undoneAt: Schema.NullOr(Schema.Number),
});
export type IntelHistoryEntry = typeof IntelHistoryEntry.Type;

/** An intel's history, newest first, for an existing or a deleted intel. */
export const IntelHistory = Schema.Struct({
  entries: Schema.Array(IntelHistoryEntry),
  intelId: IntelId,
  isDeleted: Schema.Boolean,
});
export type IntelHistory = typeof IntelHistory.Type;

/** A deleted intel the owner can bring back by undoing its deletion. */
export const DeletedIntel = Schema.Struct({
  deletedAt: Schema.Number,
  /** The history entry that deleted it, which Undo deletion undoes. */
  entryId: IntelHistoryEntryId,
  id: IntelId,
  kind: IntelKind,
  scope: IntelScope,
  scopeLabel: Schema.String,
  text: Schema.String,
});
export type DeletedIntel = typeof DeletedIntel.Type;

/** What the service proposes from evidence: one global intel for the same one in several workspaces, or a narrower scope. */
export const IntelProposalKind = Schema.Literals(["Widen", "Narrow"]);
export type IntelProposalKind = typeof IntelProposalKind.Type;

/** An intel a proposal moves or merges, as it is now. */
export const ProposedIntel = Schema.Struct({
  id: IntelId,
  scopeLabel: Schema.String,
  text: Schema.String,
});
export type ProposedIntel = typeof ProposedIntel.Type;

/**
 * A widening or narrowing the service proposes from evidence, waiting in the intel panel for the owner's
 * approval and changing nothing before it (scoped-intel, Widening and narrowing).
 */
export const IntelProposal = Schema.Struct({
  /** For a narrowing: the half-life in days over which every use came from one workspace; null for a widening. */
  halfLifeDays: Schema.NullOr(Schema.Number),
  id: IntelProposalId,
  /** The kind the intel has once moved: the newest intel's for a widening. */
  intelKind: IntelKind,
  /** The intels it moves: each workspace's for a widening, the global one for a narrowing. */
  intels: Schema.Array(ProposedIntel),
  kind: IntelProposalKind,
  /** The scope it proposes, in words. */
  scopeLabel: Schema.String,
  /** The text the intel keeps: the newest one's for a widening. */
  text: Schema.String,
  /** For a narrowing: the uses over that half-life, all from the workspace; null for a widening. */
  uses: Schema.NullOr(Schema.Number),
});
export type IntelProposal = typeof IntelProposal.Type;

/** The intel panel: intel in one thread's scope (most specific first) or all, and the changes awaiting approval. */
export const IntelView = Schema.Struct({
  awaiting: Schema.Array(IntelChange),
  /** Deleted intel, newest deletion first, listed only under the Deleted filter. */
  deleted: Schema.Array(DeletedIntel),
  /** The thread's gauge when the panel was opened from a thread; null otherwise. */
  gauge: Schema.NullOr(IntelGauge),
  intels: Schema.Array(Intel),
  /** Widenings and narrowings proposed from evidence, awaiting the owner. */
  proposals: Schema.Array(IntelProposal),
});
export type IntelView = typeof IntelView.Type;
