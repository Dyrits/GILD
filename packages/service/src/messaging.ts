import { MessageId, type SendMessageResult } from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { touchMission } from "./activity.ts";
import { resetOwnerChatter, resetResultChatter } from "./chatter.ts";
import { notFound } from "./errors.ts";
import { listSkills, withSkillInstructions } from "./skills.ts";
import { readThreadWorkspace } from "./workspaces.ts";

// The thread inbox: a thread's message history and what waits to be delivered to it (thread-messaging).
// It alone writes messages, assigns their order, and marks them delivered.

/** One message appended at the end of a thread's history, without side effects on chatter or ending. */
const appendMessage = (message: {
  readonly missionId: string;
  readonly threadId: string;
  readonly senderKind: "user" | "agent" | "thread";
  readonly fromThreadId: string | null;
  readonly isResult: boolean;
  readonly isQueued: boolean;
  readonly text: string;
  readonly now: number;
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const messageId = MessageId.make(crypto.randomUUID());
    const [next] = yield* sql<{ sequence: number }>`
      SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM messages WHERE thread_id = ${message.threadId}`;
    yield* sql`INSERT INTO messages
        (id, mission_id, thread_id, sender_kind, sender_thread_id, is_result, is_queued, text, sequence, sent_at, sender_title)
      VALUES (${messageId}, ${message.missionId}, ${message.threadId}, ${message.senderKind}, ${message.fromThreadId},
        ${message.isResult ? 1 : 0}, ${message.isQueued ? 1 : 0}, ${message.text}, ${next?.sequence ?? 1}, ${message.now},
        (SELECT title FROM threads WHERE id = ${message.fromThreadId}))`;
    yield* touchMission(message.missionId, message.now);
    return messageId;
  });

/** Records an agent's reply in its thread. Callers run it in a transaction. */
export const insertReply = (missionId: string, threadId: string, text: string) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    return yield* appendMessage({
      fromThreadId: null,
      isQueued: false,
      isResult: false,
      missionId,
      now,
      senderKind: "agent",
      text,
      threadId,
    });
  });

/** A message waiting to be delivered, as its receiver's harness reads it. */
export interface PendingMessage {
  readonly id: string;
  readonly text: string;
}

/**
 * The thread's messages from the owner and other threads not yet delivered, in order; with `isSteering`,
 * only those that may join a running turn (queued owner messages wait for the next one; CHG-0039).
 */
export const listPending = (threadId: string, isSteering: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{
      id: string;
      text: string;
      fromThreadId: string | null;
      fromTitle: string | null;
      isResult: number;
    }>`
      SELECT m.id, m.text, m.sender_thread_id AS fromThreadId, COALESCE(s.title, m.sender_title) AS fromTitle,
        m.is_result AS isResult
      FROM messages m LEFT JOIN threads s ON s.id = m.sender_thread_id
      WHERE m.thread_id = ${threadId} AND m.sender_kind IN ('user', 'thread') AND m.delivered_turn_id IS NULL
        AND ${isSteering ? sql`m.is_queued = 0` : sql`1 = 1`}
      ORDER BY m.sequence`;
    // The owner's slash-names become pointers to the skills' instructions, as the thread's workspace sees them.
    const skills = rows.some((row) => row.fromThreadId === null && row.text.includes("/"))
      ? yield* listSkills((yield* readThreadWorkspace(threadId))?.path ?? null)
      : [];
    return rows.map(
      (row): PendingMessage => ({
        id: row.id,
        text: deliveredTextOf({
          ...row,
          isResult: row.isResult === 1,
          text: row.fromThreadId === null ? withSkillInstructions(row.text, skills) : row.text,
        }),
      }),
    );
  });

/** The mission's threads, other than `exceptThreadId`, with messages waiting that could start a turn. */
export const listThreadsWithPending = (missionId: string, exceptThreadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ threadId: string }>`
      SELECT DISTINCT m.thread_id AS threadId FROM messages m JOIN threads t ON t.id = m.thread_id
      WHERE m.mission_id = ${missionId} AND m.sender_kind IN ('user', 'thread') AND m.delivered_turn_id IS NULL
        AND t.state NOT IN ('Running', 'Attention', 'Stopped') AND t.id != ${exceptThreadId}`;
    return rows.map((row) => row.threadId);
  });

/** Marks messages as delivered to a turn; one already delivered keeps its turn. Callers run it in a transaction. */
export const deliverMessages = (messageIds: ReadonlyArray<string>, turnId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (messageIds.length === 0) return;
    yield* sql`UPDATE messages SET delivered_turn_id = ${turnId}
      WHERE id IN ${sql.in(messageIds)} AND delivered_turn_id IS NULL`;
  });

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
    }>`SELECT mission_id AS missionId FROM threads WHERE id = ${message.threadId} AND is_deleting = 0`;
    if (thread === undefined) return yield* notFound("No such thread.");
    if (message.fromThreadId === null) {
      yield* resetOwnerChatter(message.threadId);
      // The owner writing in a Done or archived mission continues it; its threads record what follows
      // in the journal (mission-tracking, Ending a mission).
      yield* sql`UPDATE missions SET ending = NULL WHERE id = ${thread.missionId} AND ending IS NOT NULL`;
    } else if (message.isResult) yield* resetResultChatter(message.fromThreadId, message.threadId);
    return yield* appendMessage({
      ...message,
      missionId: thread.missionId,
      now: yield* Clock.currentTimeMillis,
      senderKind: message.fromThreadId === null ? "user" : "thread",
    });
  });

/** Records an owner message for a thread, queued or to steer a running turn. Callers run it in a transaction. */
export const insertUserMessage = (threadId: string, text: string, isQueued: boolean) =>
  insertMessage({ fromThreadId: null, isQueued, isResult: false, text, threadId }).pipe(
    Effect.map((messageId) => ({ messageId }) satisfies SendMessageResult),
  );

/** A message as the receiving thread's harness reads it: a thread message names its sender. */
const deliveredTextOf = (message: {
  readonly fromThreadId: string | null;
  readonly fromTitle: string | null;
  readonly isResult: boolean;
  readonly text: string;
}) =>
  message.fromThreadId === null && message.fromTitle === null
    ? message.text
    : `${message.isResult ? "Result" : "Message"} from thread "${message.fromTitle ?? ""}" (${message.fromThreadId ?? "deleted"}):\n${message.text}`;
