import type { JournalEntry, JournalView, MissionId } from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { touchMission } from "./activity.ts";
import { notFound } from "./errors.ts";
import { readSettings } from "./settings.ts";

/** How many entries a thread's starting context and `read_journal` carry by default (mission-journal, Reading). */
export const latestEntryCount = 20;
/** The most opener's messages a new thread starts with; summarizing longer ones is staged (CHG-0043). */
const openerMessageCount = 40;
/** The answer to `report_result`'s journal argument when a thread has nothing to record. */
export const nothingToRecord = "nothing to record";

/** A briefing's size in tokens, estimated the same way for every harness (mission-journal, Size). */
export const tokensOf = (text: string) => Math.ceil(text.length / 4);

/** Who writes to a journal: a thread of the mission, or the owner. */
export type JournalAuthor = { readonly kind: "thread"; readonly threadId: string } | { readonly kind: "user" };

/** A briefing rewrite and the version it was based on, which a thread may omit and is then refused. */
export interface BriefingRewrite {
  readonly basedOn: number | null;
  readonly briefing: string;
}

/** What an update did: the new version and entry number, or why it was refused with the current briefing. */
export type JournalOutcome =
  | { readonly _tag: "Recorded"; readonly number: number; readonly version: number }
  | {
      readonly _tag: "Refused";
      readonly briefing: string;
      readonly reason: "Empty" | "OverLimit" | "Stale";
      readonly text: string;
      readonly version: number;
    };

/** The mission's journal, made with it: an empty briefing at version 0. Callers run it in a transaction. */
export const insertJournal = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT INTO journals (mission_id, briefing, version) VALUES (${missionId}, '', 0)`;
  });

const readBriefing = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ briefing: string; version: number }>`
      SELECT briefing, version FROM journals WHERE mission_id = ${missionId}`;
    if (row === undefined) return yield* notFound("No such mission.");
    return row;
  });

type EntryRow = Omit<JournalEntry, "authorKind"> & { authorKind: string };

/** Entries before `before` (an entry number; null for the latest), at most `count`, oldest first. */
const listEntries = (missionId: string, before: number | null, count: number | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<EntryRow>`
      SELECT number, author_kind AS authorKind, author_title AS authorTitle, text, written_at AS writtenAt
      FROM journal_entries
      WHERE mission_id = ${missionId} AND ${before === null ? sql`1 = 1` : sql`number < ${before}`}
      ORDER BY number DESC LIMIT ${count ?? -1}`;
    return (rows as ReadonlyArray<JournalEntry>).toReversed();
  });

const appendEntry = (missionId: string, author: JournalAuthor, text: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const [next] = yield* sql<{ number: number }>`
      SELECT COALESCE(MAX(number), 0) + 1 AS number FROM journal_entries WHERE mission_id = ${missionId}`;
    const number = next?.number ?? 1;
    const threadId = author.kind === "thread" ? author.threadId : null;
    yield* sql`INSERT INTO journal_entries (mission_id, number, author_kind, author_thread_id, author_title, text, written_at)
      VALUES (${missionId}, ${number}, ${author.kind}, ${threadId},
        (SELECT title FROM threads WHERE id = ${threadId}), ${text}, ${now})`;
    yield* touchMission(missionId, now);
    return number;
  });

/**
 * Adds an entry and, when given, rewrites the briefing in the same change. A rewrite over the limit, or
 * not based on the current version, is refused with the current briefing. Callers run it in a transaction.
 */
export const updateJournal = (
  missionId: string,
  author: JournalAuthor,
  entry: string,
  rewrite: BriefingRewrite | null,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const current = yield* readBriefing(missionId);
    const refuse = (reason: "Empty" | "OverLimit" | "Stale", text: string): JournalOutcome => ({
      _tag: "Refused",
      briefing: current.briefing,
      reason,
      text,
      version: current.version,
    });
    if (entry.trim() === "") return refuse("Empty", "Not recorded: give an entry saying what changed.");
    if (rewrite !== null) {
      const { briefingLimit } = yield* readSettings;
      const tokens = tokensOf(rewrite.briefing);
      if (tokens > briefingLimit) {
        return refuse(
          "OverLimit",
          `Not recorded: the briefing is about ${tokens} tokens, over the limit of ${briefingLimit}. Shorten it and try again.`,
        );
      }
      if (rewrite.basedOn !== current.version) {
        return refuse(
          "Stale",
          rewrite.basedOn === null
            ? "Not recorded: give basedOn, the briefing version your rewrite starts from."
            : "Not recorded: the briefing was rewritten since the version you started from. Merge your change into the current briefing and try again with its version.",
        );
      }
      yield* sql`UPDATE journals SET briefing = ${rewrite.briefing}, version = version + 1 WHERE mission_id = ${missionId}`;
    }
    const number = yield* appendEntry(missionId, author, entry.trim());
    return {
      _tag: "Recorded",
      number,
      version: rewrite === null ? current.version : current.version + 1,
    } satisfies JournalOutcome;
  });

/** The owner's view of a mission's journal: the briefing and every entry, newest first. */
export const readJournalView = (missionId: string) =>
  Effect.gen(function* () {
    const { briefing, version } = yield* readBriefing(missionId);
    const { briefingLimit } = yield* readSettings;
    const entries = yield* listEntries(missionId, null, null);
    return {
      briefing,
      briefingTokens: tokensOf(briefing),
      entries: entries.toReversed(),
      limit: briefingLimit,
      missionId: missionId as MissionId,
      version,
    } satisfies JournalView;
  });

const timeOf = (millis: number) => new Date(millis).toISOString().slice(0, 16).replace("T", " ");

const entryLineOf = (entry: JournalEntry) =>
  `#${entry.number} · ${timeOf(entry.writtenAt)} UTC · ${entry.authorKind === "user" ? "the owner" : `thread "${entry.authorTitle ?? ""}"`}: ${entry.text}`;

/** The journal as a thread reads it: the briefing with its version, then entries oldest first. */
export const journalTextOf = (
  briefing: { readonly briefing: string; readonly version: number },
  entries: ReadonlyArray<JournalEntry>,
) =>
  [
    `Briefing (version ${briefing.version}):`,
    briefing.briefing === "" ? "(empty)" : briefing.briefing,
    "",
    entries.length === 0 ? "No entries." : `Entries ${entries[0]?.number} to ${entries.at(-1)?.number}:`,
    ...entries.map(entryLineOf),
  ].join("\n");

/** What `read_journal` answers: the briefing and up to `count` entries before `before`. */
export const readJournalText = (threadId: string, before: number | null, count: number | null) =>
  Effect.gen(function* () {
    const missionId = yield* missionOf(threadId);
    const briefing = yield* readBriefing(missionId);
    const entries = yield* listEntries(missionId, before, count ?? latestEntryCount);
    return journalTextOf(briefing, entries);
  });

/** The mission a thread belongs to. */
export const missionOf = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ missionId: string }>`SELECT mission_id AS missionId FROM threads WHERE id = ${threadId}`;
    if (row === undefined) return yield* notFound("No such thread.");
    return row.missionId;
  });

const senderLabelOf = (row: { sender: string; fromTitle: string | null; isResult: number }) =>
  row.sender === "user"
    ? "Owner"
    : row.sender === "agent"
      ? "Opener"
      : `${row.isResult === 1 ? "Result from" : "Message from"} thread "${row.fromTitle ?? ""}"`;

/**
 * The opener's messages since the journal's latest entry, as a new thread starts with them (thread-tree,
 * Opening a thread); null when there are none. Captured when the thread is opened, so later messages stay out.
 */
export const openerMessagesOf = (openerId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const missionId = yield* missionOf(openerId);
    const [latest] = yield* sql<{ writtenAt: number | null }>`
      SELECT MAX(written_at) AS writtenAt FROM journal_entries WHERE mission_id = ${missionId}`;
    // At or after the entry's millisecond: a message written in the same millisecond is kept rather than lost.
    const since = latest?.writtenAt ?? 0;
    const rows = yield* sql<{ sender: string; fromTitle: string | null; isResult: number; text: string }>`
      SELECT sender_kind AS sender, sender_title AS fromTitle, is_result AS isResult, text FROM messages
      WHERE thread_id = ${openerId} AND sent_at >= ${since} ORDER BY sequence DESC LIMIT ${openerMessageCount}`;
    if (rows.length === 0) return null;
    const [counted] = yield* sql<{ total: number }>`
      SELECT COUNT(*) AS total FROM messages WHERE thread_id = ${openerId} AND sent_at >= ${since}`;
    // The new thread knows how much of its opener's conversation it misses (thread-tree, Opening a thread).
    const leftOut = (counted?.total ?? rows.length) - rows.length;
    const omitted = leftOut > 0 ? [`(${leftOut} earlier ${leftOut === 1 ? "message" : "messages"} left out.)`] : [];
    const kept = rows.toReversed().map((row) => `${senderLabelOf(row)}:\n${row.text}`);
    return [...omitted, ...kept].join("\n\n");
  });

/** How a thread uses the mission journal; part of its system prompt, the same every turn (mission-journal). */
export const journalInstructions = [
  "# Mission journal",
  "Every thread of this mission shares this journal: a briefing of where the mission stands, and a change log only ever added to. Each of your turns starts with the current briefing and latest entries.",
  "Call read_journal for the current briefing and older entries. Call update_journal with an entry when you settle a decision, change direction, or finish a piece of work. Rewrite the briefing only when where the mission stands has changed: pass the whole new briefing and basedOn, the version you started from.",
].join("\n");

/** The mission's journal for each turn's message: the briefing and the latest entries. */
export const journalContextOf = (missionId: string) =>
  Effect.gen(function* () {
    const briefing = yield* readBriefing(missionId);
    const entries = yield* listEntries(missionId, null, latestEntryCount);
    return ["# Mission journal at this turn", journalTextOf(briefing, entries)].join("\n");
  });

/** The opener's messages as each turn's message carries them, after the journal; null when there are none. */
export const openerContextOf = (openerMessages: string | null) =>
  openerMessages === null
    ? null
    : ["# Your opener's messages since the latest journal entry", openerMessages].join("\n");
