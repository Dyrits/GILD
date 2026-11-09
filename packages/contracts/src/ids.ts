import { Schema } from "effect";

// Identifiers, branded so one kind cannot stand for another.

/** Identifies a mission. */
export const MissionId = Schema.String.pipe(Schema.brand("MissionId"));
export type MissionId = typeof MissionId.Type;

/** Identifies a thread. */
export const ThreadId = Schema.String.pipe(Schema.brand("ThreadId"));
export type ThreadId = typeof ThreadId.Type;

/** Identifies a message in a thread. */
export const MessageId = Schema.String.pipe(Schema.brand("MessageId"));
export type MessageId = typeof MessageId.Type;

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

/** Identifies an intel (scoped-intel). */
export const IntelId = Schema.String.pipe(Schema.brand("IntelId"));
export type IntelId = typeof IntelId.Type;

/** Identifies a thread's change to intel, done or awaiting the owner's approval (scoped-intel). */
export const IntelChangeId = Schema.String.pipe(Schema.brand("IntelChangeId"));
export type IntelChangeId = typeof IntelChangeId.Type;

/** Identifies one entry in an intel's history (scoped-intel, History and undo). */
export const IntelHistoryEntryId = Schema.String.pipe(Schema.brand("IntelHistoryEntryId"));
export type IntelHistoryEntryId = typeof IntelHistoryEntryId.Type;

/** Identifies a widening or narrowing the service proposes from evidence (scoped-intel, Widening and narrowing). */
export const IntelProposalId = Schema.String.pipe(Schema.brand("IntelProposalId"));
export type IntelProposalId = typeof IntelProposalId.Type;

/** Identifies a provider account added in Gild: a harness signed in with its own folder (provider-accounts). */
export const AccountId = Schema.String.pipe(Schema.brand("AccountId"));
export type AccountId = typeof AccountId.Type;
