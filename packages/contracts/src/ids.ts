import { Schema } from "effect";

// Identifiers, branded so one kind cannot stand for another.

/** Identifies a mission. */
export const MissionId = Schema.String.pipe(Schema.brand("MissionId"));
export type MissionId = typeof MissionId.Type;

/** Identifies a Ritual (rituals). */
export const RitualId = Schema.String.pipe(Schema.brand("RitualId"));
export type RitualId = typeof RitualId.Type;

/** Identifies a thread. */
export const ThreadId = Schema.String.pipe(Schema.brand("ThreadId"));
export type ThreadId = typeof ThreadId.Type;

/** Identifies a message in a thread. */
export const MessageId = Schema.String.pipe(Schema.brand("MessageId"));
export type MessageId = typeof MessageId.Type;

/** Identifies an attached file (message-attachments). */
export const AttachmentId = Schema.String.pipe(Schema.brand("AttachmentId"));
export type AttachmentId = typeof AttachmentId.Type;

/** Identifies a workspace folder by identity, not by path. */
export const WorkspaceId = Schema.String.pipe(Schema.brand("WorkspaceId"));
export type WorkspaceId = typeof WorkspaceId.Type;

/** Identifies an approval question. */
export const QuestionId = Schema.String.pipe(Schema.brand("QuestionId"));
export type QuestionId = typeof QuestionId.Type;

/** Identifies a standing permission. */
export const PermissionId = Schema.String.pipe(Schema.brand("PermissionId"));
export type PermissionId = typeof PermissionId.Type;

/** Identifies an off-topic suggestion (thread-tree, Off-topic requests). */
export const SuggestionId = Schema.String.pipe(Schema.brand("SuggestionId"));
export type SuggestionId = typeof SuggestionId.Type;

/** Identifies a reached budget's stop and its question. */
export const BudgetStopId = Schema.String.pipe(Schema.brand("BudgetStopId"));
export type BudgetStopId = typeof BudgetStopId.Type;

/** Identifies a lore entry (scoped-intel). */
export const LoreEntryId = Schema.String.pipe(Schema.brand("LoreEntryId"));
export type LoreEntryId = typeof LoreEntryId.Type;

/** Identifies a thread's change to lore, done or awaiting the owner's approval (scoped-intel). */
export const LoreChangeId = Schema.String.pipe(Schema.brand("LoreChangeId"));
export type LoreChangeId = typeof LoreChangeId.Type;

/** Identifies one entry in a lore entry's history (scoped-intel, History and undo). */
export const LoreHistoryEntryId = Schema.String.pipe(Schema.brand("LoreHistoryEntryId"));
export type LoreHistoryEntryId = typeof LoreHistoryEntryId.Type;

/** Identifies a widening or narrowing the service proposes from evidence (scoped-intel, Widening and narrowing). */
export const LoreProposalId = Schema.String.pipe(Schema.brand("LoreProposalId"));
export type LoreProposalId = typeof LoreProposalId.Type;

/** Identifies a provider account added in Iskios: a harness signed in with its own folder (provider-accounts). */
export const AccountId = Schema.String.pipe(Schema.brand("AccountId"));
export type AccountId = typeof AccountId.Type;
