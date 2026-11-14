import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { insertUserMessage } from "./messaging.ts";

// Where a message delivered to a thread came from, as structural authority reads it (guildmasterProvenance.ts): only the
// owner's own words count, never a Ritual's run message or a suggestion's agent-written text the owner only routed.

/**
 * Records a suggestion's text as a message in the thread the owner continued it in, marked as the suggestion's: the
 * owner routed it, but an agent wrote it, so it stays out of owner-word authority (mission-coordination, audit SA-06).
 * Callers run it in a transaction.
 */
export const insertSuggestedMessage = Effect.fnUntraced(function* (threadId: string, text: string, isQueued: boolean) {
  const sql = yield* SqlClient.SqlClient;
  const { messageId } = yield* insertUserMessage(threadId, text, isQueued);
  yield* sql`INSERT INTO suggested_messages (message_id) VALUES (${messageId})`;
});

/**
 * The texts of the owner's own messages delivered to the thread's running turn. A message from another thread, an
 * agent's reply, the service's message that starts a Ritual's run, and a suggestion's agent-written text the owner
 * only routed here are never among them.
 */
export const readOwnerTexts = (threadId: string, turnId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ text: string }>`
      SELECT m.text FROM messages m
      WHERE m.thread_id = ${threadId} AND m.delivered_turn_id = ${turnId}
        AND m.sender_kind = 'user' AND m.sender_thread_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM ritual_run_messages r WHERE r.message_id = m.id)
        AND NOT EXISTS (SELECT 1 FROM suggested_messages s WHERE s.message_id = m.id)`;
    return rows.map((row) => row.text);
  });

/** Whether the running turn is one of the Ritual's runs: its service-made run message was delivered to it. */
export const isRitualRunTurn = (threadId: string, turnId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`
      SELECT m.id FROM messages m JOIN ritual_run_messages r ON r.message_id = m.id
      WHERE m.thread_id = ${threadId} AND m.delivered_turn_id = ${turnId} LIMIT 1`;
    return rows.length > 0;
  });
