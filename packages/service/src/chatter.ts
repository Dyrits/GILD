import type { ChatterNotice } from "@openmission/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { Changes } from "./changes.ts";
import { invalid } from "./errors.ts";
import { haltThreads } from "./lifecycle.ts";
import { readSettings } from "./settings.ts";
import { Threads } from "./threads.ts";

const pairOf = (a: string, b: string) => (a < b ? ([a, b] as const) : ([b, a] as const));

/** Resets every exchange involving an owner-addressed thread; an existing pause still needs a decision. */
export const resetOwnerChatter = Effect.fn("resetOwnerChatter")(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE chatter SET count = 0 WHERE first_id = ${threadId} OR second_id = ${threadId}`;
});

/** A result resets only the unordered pair that exchanged it and does not count as another message. */
export const resetResultChatter = Effect.fn("resetResultChatter")(function* (from: string, to: string) {
  const sql = yield* SqlClient.SqlClient;
  const [first, second] = pairOf(from, to);
  yield* sql`UPDATE chatter SET count = 0 WHERE first_id = ${first} AND second_id = ${second}`;
});

/** Counts a thread message atomically and invalidates both turns on the first threshold crossing. */
export const countChatter = Effect.fn("countChatter")(function* (from: string, to: string) {
  const sql = yield* SqlClient.SqlClient;
  const [first, second] = pairOf(from, to);
  yield* sql`INSERT INTO chatter (first_id, second_id, count) VALUES (${first}, ${second}, 1)
    ON CONFLICT (first_id, second_id) DO UPDATE SET count = count + 1`;
  const [pair] = yield* sql<{ count: number; pauseId: string | null }>`
    SELECT count, pause_id AS pauseId FROM chatter WHERE first_id = ${first} AND second_id = ${second}`;
  const { chatterThreshold } = yield* readSettings;
  if (pair === undefined || pair.pauseId !== null || pair.count < chatterThreshold) return [];
  yield* sql`UPDATE chatter SET pause_id = ${crypto.randomUUID()}, pause_count = ${pair.count}
    WHERE first_id = ${first} AND second_id = ${second}`;
  yield* haltThreads([first, second], "Attention");
  return [first, second];
});

/** Resume cannot bypass the explicit decision on an unresolved chatter pause. */
export const requireChatterDecision = Effect.fn("requireChatterDecision")(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows =
    yield* sql`SELECT 1 FROM chatter WHERE pause_id IS NOT NULL AND (first_id = ${threadId} OR second_id = ${threadId})`;
  if (rows.length > 0)
    return yield* invalid("Decide whether these threads should continue or stop in the chatter notice first.");
});

/** The unresolved exchanges involving the selected thread, for its conversation notice. */
export const readChatter = Effect.fn("readChatter")(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql<ChatterNotice>`
    SELECT c.pause_id AS id, c.pause_count AS count, c.first_id AS firstId, a.title AS firstTitle,
      c.second_id AS secondId, b.title AS secondTitle
    FROM chatter c JOIN threads a ON a.id = c.first_id JOIN threads b ON b.id = c.second_id
    WHERE c.pause_id IS NOT NULL AND (c.first_id = ${threadId} OR c.second_id = ${threadId})`;
});

/** Releases threads held only by resolved chatter exchanges; other blockers and Stop still win. */
export const releaseChatter = Effect.fn("releaseChatter")(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Idle', blocker = NULL
    WHERE blocker = 'Chatter' AND state = 'Attention' AND NOT EXISTS (
      SELECT 1 FROM chatter WHERE pause_id IS NOT NULL AND (first_id = threads.id OR second_id = threads.id))`;
});

/** Applies the owner's decision once to this pause, preserving queued messages in either choice. */
export const resolveChatter = Effect.fn("resolveChatter")(function* (pauseId: string, choice: "Continue" | "Stop") {
  const sql = yield* SqlClient.SqlClient;
  const threads = yield* Threads;
  const changes = yield* Changes;
  const [paused] = yield* sql<{ firstId: string; secondId: string }>`
    SELECT first_id AS firstId, second_id AS secondId FROM chatter WHERE pause_id = ${pauseId}`;
  if (paused === undefined) return yield* invalid("This chatter pause was already resolved.");
  // Keep Attention in place until the invalidated turns have finished exiting.
  yield* threads.cancel([paused.firstId, paused.secondId]);
  const ids = yield* sql.withTransaction(
    Effect.gen(function* () {
      const [pair] = yield* sql<{ firstId: string; secondId: string }>`
      SELECT first_id AS firstId, second_id AS secondId FROM chatter WHERE pause_id = ${pauseId}`;
      if (pair === undefined) return yield* invalid("This chatter pause was already resolved.");
      const ids = [pair.firstId, pair.secondId];
      yield* sql`UPDATE chatter SET count = 0, pause_id = NULL, pause_count = NULL WHERE pause_id = ${pauseId}`;
      if (choice === "Stop") yield* haltThreads(ids, "Stopped");
      yield* releaseChatter();
      yield* sql.afterCommit(changes.publish);
      return ids;
    }),
  );
  if (choice === "Continue") for (const id of ids) yield* threads.wake(id);
  return null;
});
