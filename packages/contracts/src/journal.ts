import { Schema } from "effect";
import { MissionId } from "./ids.ts";

// A mission's journal (mission-journal).

/** Who wrote a journal entry: a thread of the mission, or the owner (mission-journal, Content). */
export const JournalAuthorKind = Schema.Literals(["thread", "user"]);
export type JournalAuthorKind = typeof JournalAuthorKind.Type;

/** One change log entry; never edited or deleted. */
export const JournalEntry = Schema.Struct({
  authorKind: JournalAuthorKind,
  /** The writing thread's title when it wrote the entry; null for the owner. */
  authorTitle: Schema.NullOr(Schema.String),
  /** The entry's place in the change log, from 1. */
  number: Schema.Number,
  text: Schema.String,
  writtenAt: Schema.Number,
});
export type JournalEntry = typeof JournalEntry.Type;

/** A mission's journal as the owner reads it: the briefing and the whole change log, newest first. */
export const JournalView = Schema.Struct({
  briefing: Schema.String,
  /** The briefing's estimated size and its limit, in tokens. */
  briefingTokens: Schema.Number,
  entries: Schema.Array(JournalEntry),
  limit: Schema.Number,
  missionId: MissionId,
  /** Increases with each rewrite; a rewrite names the version it was based on. */
  version: Schema.Number,
});
export type JournalView = typeof JournalView.Type;
