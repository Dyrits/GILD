import type { Question } from "@gild/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";

// Every read joins the mission title, which a question shows outside its thread.
const selectQuestions = (sql: SqlClient.SqlClient) => sql`
  SELECT q.id, q.mission_id AS missionId, m.title AS missionTitle, q.thread_id AS threadId, q.source,
    q.summary, q.details, q.pattern, q.permission, q.asked_at AS askedAt, q.outcome, q.message, q.device,
    q.resolved_at AS resolvedAt
  FROM questions q JOIN missions m ON m.id = q.mission_id`;

/** A thread's questions, open and recorded, in the order asked. */
export const listThreadQuestions = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<Question>`${selectQuestions(sql)} WHERE q.thread_id = ${threadId} ORDER BY q.asked_at, q.rowid`;
  });

/** Every open question across missions, oldest first, for the dashboard's list. */
export const listOpenQuestions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql<Question>`${selectQuestions(sql)} WHERE q.outcome IS NULL ORDER BY q.asked_at, q.rowid`;
});

/** Recorded questions, newest first, optionally for one mission. */
export const listQuestionHistory = (missionId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<Question>`${selectQuestions(sql)}
      WHERE q.outcome IS NOT NULL AND ${missionId === null ? sql`1 = 1` : sql`q.mission_id = ${missionId}`}
      ORDER BY q.resolved_at DESC, q.rowid DESC`;
  });

/** One question by its identifier. */
export const readQuestion = (questionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [question] = yield* sql<Question>`${selectQuestions(sql)} WHERE q.id = ${questionId}`;
    return question ?? null;
  });
