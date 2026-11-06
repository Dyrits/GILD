import type { MessageId, SendMessageResult } from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "./errors.ts";

/** A message to record in a thread: from the owner, or from another thread of its mission. */
interface NewMessage {
  /** The sending thread, for a thread message. */
  readonly fromThreadId: string | null;
  /** Whether it waits for the receiver's next turn instead of joining a running one (CHG-0039). */
  readonly isQueued: boolean;
  /** Whether it is a result reported by a thread beneath (thread-tree, Results). */
  readonly isResult: boolean;
  readonly text: string;
  readonly threadId: string;
}

/** Records a message for a thread, after the thread's existing messages. Callers run it in a transaction. */
export const insertMessage = (message: NewMessage) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [thread] = yield* sql<{
      missionId: string;
    }>`SELECT mission_id AS missionId FROM threads WHERE id = ${message.threadId}`;
    if (thread === undefined) return yield* notFound("No such thread.");
    const now = yield* Clock.currentTimeMillis;
    const messageId = crypto.randomUUID();
    const [next] = yield* sql<{ sequence: number }>`
      SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM messages WHERE thread_id = ${message.threadId}`;
    yield* sql`INSERT INTO messages
        (id, mission_id, thread_id, sender_kind, sender_thread_id, is_result, is_queued, text, sequence, sent_at)
      VALUES (${messageId}, ${thread.missionId}, ${message.threadId},
        ${message.fromThreadId === null ? "user" : "thread"}, ${message.fromThreadId}, ${message.isResult ? 1 : 0},
        ${message.isQueued ? 1 : 0}, ${message.text}, ${next?.sequence ?? 1}, ${now})`;
    yield* sql`UPDATE missions SET last_activity_at = ${now} WHERE id = ${thread.missionId}`;
    return messageId as MessageId;
  });

/** Records an owner message for a thread, queued or to steer a running turn. Callers run it in a transaction. */
export const insertUserMessage = (threadId: string, text: string, isQueued: boolean) =>
  insertMessage({ fromThreadId: null, isQueued, isResult: false, text, threadId }).pipe(
    Effect.map((messageId) => ({ messageId }) satisfies SendMessageResult),
  );

/** A message as the receiving thread's harness reads it: a thread message names its sender. */
export const deliveredTextOf = (message: {
  readonly fromThreadId: string | null;
  readonly fromTitle: string | null;
  readonly isResult: boolean;
  readonly text: string;
}) =>
  message.fromThreadId === null
    ? message.text
    : `${message.isResult ? "Result" : "Message"} from thread "${message.fromTitle ?? ""}" (${message.fromThreadId}):\n${message.text}`;
