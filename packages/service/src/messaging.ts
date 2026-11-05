import type { SendMessageResult } from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "./errors.ts";

/** Records an owner message for a thread, after the thread's existing messages. Callers run it in a transaction. */
export const insertUserMessage = (threadId: string, text: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [thread] = yield* sql<{
      missionId: string;
    }>`SELECT mission_id AS missionId FROM threads WHERE id = ${threadId}`;
    if (thread === undefined) return yield* notFound("No such thread.");
    const now = yield* Clock.currentTimeMillis;
    const messageId = crypto.randomUUID();
    const [next] = yield* sql<{ sequence: number }>`
      SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM messages WHERE thread_id = ${threadId}`;
    yield* sql`INSERT INTO messages (id, mission_id, thread_id, sender_kind, text, sequence, sent_at)
      VALUES (${messageId}, ${thread.missionId}, ${threadId}, 'user', ${text}, ${next?.sequence ?? 1}, ${now})`;
    yield* sql`UPDATE missions SET last_activity_at = ${now} WHERE id = ${thread.missionId}`;
    return { messageId } as SendMessageResult;
  });
