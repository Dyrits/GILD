import type { LoreOrigin } from "@gild/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { summaryOf } from "./loreFading.ts";

// Where a lore entry comes from (scoped-intel, Saving): the thread that saved it and, when there is one, the
// journal entry or message it rests on. The origin is copied when saved, so it outlives its thread.

/**
 * What a thread's save rests on: the journal entry it names in its mission, or else the latest message
 * delivered to it, the one its turn answers. Null when there is neither; a string when the entry does not exist.
 */
export const readOrigin = (threadId: string, journalEntry: number | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (journalEntry !== null) {
      const [entry] = yield* sql<{ text: string }>`
        SELECT e.text FROM journal_entries e JOIN threads t ON t.mission_id = e.mission_id
        WHERE t.id = ${threadId} AND e.number = ${journalEntry}`;
      if (entry === undefined) return `there is no journal entry ${journalEntry} in this mission`;
      return { entryNumber: journalEntry, excerpt: summaryOf(entry.text), from: null, kind: "JournalEntry" } as const;
    }
    const [message] = yield* sql<{ fromTitle: string | null; senderKind: string; text: string }>`
      SELECT sender_kind AS senderKind, sender_title AS fromTitle, text FROM messages
      WHERE thread_id = ${threadId} AND sender_kind IN ('user', 'thread') AND delivered_turn_id IS NOT NULL
      ORDER BY sequence DESC LIMIT 1`;
    if (message === undefined) return null;
    return {
      entryNumber: null,
      excerpt: summaryOf(message.text),
      from: message.senderKind === "user" ? null : (message.fromTitle ?? "a thread"),
      kind: "Message",
    } satisfies LoreOrigin;
  });

/** The origin columns' values, in the order `origin_kind, origin_entry, origin_from, origin_excerpt`. */
export const originColumnsOf = (origin: LoreOrigin | null) => ({
  originEntry: origin?.entryNumber ?? null,
  originExcerpt: origin?.excerpt ?? null,
  originFrom: origin?.from ?? null,
  originKind: origin?.kind ?? null,
});
