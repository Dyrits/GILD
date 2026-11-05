import type { MissionDetail, MissionSummary, StartMissionResult, ThreadState } from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "./errors.ts";

// Ordered from most to least urgent (mission-tracking specification). Done and
// Stopped add no urgency; Idle is the provisional fallback until it is settled.
const urgency: ReadonlyArray<ThreadState> = ["Attention", "Failed", "Running", "Waiting", "Idle"];
const missionState = (states: ReadonlyArray<string>): ThreadState =>
  urgency.find((state) => states.includes(state)) ?? "Idle";

export const titleOf = (text: string) => text.trim().split("\n", 1)[0]?.trim().slice(0, 200) ?? "";

/** Records the mission, its top thread, and the first message. Callers run it in a transaction. */
export const insertMission = (text: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const missionId = crypto.randomUUID();
    const threadId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    yield* sql`INSERT INTO missions (id, top_thread_id, title, created_at, last_activity_at)
      VALUES (${missionId}, ${threadId}, ${titleOf(text)}, ${now}, ${now})`;
    yield* sql`INSERT INTO threads (id, mission_id, state) VALUES (${threadId}, ${missionId}, 'Idle')`;
    yield* sql`INSERT INTO messages (id, mission_id, thread_id, sender_kind, text, sequence, sent_at)
      VALUES (${messageId}, ${missionId}, ${threadId}, 'user', ${text}, 1, ${now})`;
    return { missionId, threadId, messageId } as StartMissionResult;
  });

type MissionRow = { id: string; title: string; topThreadId: string; lastActivityAt: number; states: string };

const summaryOf = (row: MissionRow): MissionSummary =>
  ({
    id: row.id,
    title: row.title,
    topThreadId: row.topThreadId,
    lastActivityAt: row.lastActivityAt,
    state: missionState(row.states.split(",")),
  }) as MissionSummary;

const missionRows = (sql: SqlClient.SqlClient, missionId?: string) =>
  sql<MissionRow>`
    SELECT m.id, m.title, m.top_thread_id AS topThreadId, m.last_activity_at AS lastActivityAt,
      (SELECT group_concat(t.state) FROM threads t WHERE t.mission_id = m.id) AS states
    FROM missions m
    WHERE ${missionId === undefined ? sql`1 = 1` : sql`m.id = ${missionId}`}
    ORDER BY m.last_activity_at DESC`;

export const listMissions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* missionRows(sql);
  return rows.map(summaryOf);
});

export const readMission = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* missionRows(sql, missionId);
    if (row === undefined) return yield* Effect.fail(notFound("No such mission."));
    const [thread] = yield* sql<{ id: string; state: ThreadState }>`
      SELECT id, state FROM threads WHERE id = ${row.topThreadId}`;
    const messages = yield* sql<MissionDetail["messages"][number]>`
      SELECT id, thread_id AS threadId, sender_kind AS sender, text, sequence, sent_at AS sentAt
      FROM messages WHERE thread_id = ${row.topThreadId} ORDER BY sequence`;
    return {
      mission: summaryOf(row),
      thread: thread ?? { id: row.topThreadId, state: "Idle" },
      messages,
    } as MissionDetail;
  });
