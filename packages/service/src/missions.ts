import type {
  EffortChoice,
  MissionDetail,
  MissionSummary,
  ModelChoice,
  StartMissionResult,
  ThreadState,
} from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "./errors.ts";
import { listThreadQuestions } from "./questions.ts";
import { attachWorkspace, readThreadWorkspace } from "./workspaces.ts";

// Ordered from most to least urgent (mission-tracking specification). Done and
// Stopped add no urgency; Idle is the provisional fallback until it is settled.
const urgency: ReadonlyArray<ThreadState> = ["Attention", "Failed", "Running", "Waiting", "Idle"];
const missionState = (states: ReadonlyArray<string>): ThreadState =>
  urgency.find((state) => states.includes(state)) ?? "Idle";

export const titleOf = (text: string) => text.trim().split("\n", 1)[0]?.trim().slice(0, 200) ?? "";

/**
 * Records the mission, its top thread in the chosen workspace or none, and the first message.
 * Callers run it in a transaction.
 */
export const insertMission = (text: string, model: ModelChoice, effort: EffortChoice, workspacePath: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const workspaceId = workspacePath === null ? null : yield* attachWorkspace(workspacePath);
    const now = yield* Clock.currentTimeMillis;
    const missionId = crypto.randomUUID();
    const threadId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    yield* sql`INSERT INTO missions (id, top_thread_id, title, created_at, last_activity_at)
      VALUES (${missionId}, ${threadId}, ${titleOf(text)}, ${now}, ${now})`;
    yield* sql`INSERT INTO threads (id, mission_id, state, model, effort, workspace_id)
      VALUES (${threadId}, ${missionId}, 'Idle', ${model}, ${effort}, ${workspaceId})`;
    yield* sql`INSERT INTO messages (id, mission_id, thread_id, sender_kind, text, sequence, sent_at)
      VALUES (${messageId}, ${missionId}, ${threadId}, 'user', ${text}, 1, ${now})`;
    return { messageId, missionId, threadId } as StartMissionResult;
  });

type MissionRow = {
  id: string;
  title: string;
  topThreadId: string;
  lastActivityAt: number;
  states: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  workspaceName: string | null;
};

const summaryOf = (row: MissionRow): MissionSummary =>
  ({
    id: row.id,
    lastActivityAt: row.lastActivityAt,
    state: missionState(row.states.split(",")),
    title: row.title,
    topThreadId: row.topThreadId,
    usage: { cacheCreation: row.cacheCreation, cacheRead: row.cacheRead, input: row.input, output: row.output },
    workspaceName: row.workspaceName,
  }) as MissionSummary;

const missionRows = (sql: SqlClient.SqlClient, missionId?: string) =>
  sql<MissionRow>`
    SELECT m.id, m.title, m.top_thread_id AS topThreadId, m.last_activity_at AS lastActivityAt,
      (SELECT group_concat(t.state) FROM threads t WHERE t.mission_id = m.id) AS states,
      COALESCE(SUM(u.input), 0) AS input, COALESCE(SUM(u.output), 0) AS output,
      COALESCE(SUM(u.cache_read), 0) AS cacheRead, COALESCE(SUM(u.cache_creation), 0) AS cacheCreation,
      (SELECT w.name FROM threads t JOIN workspaces w ON w.id = t.workspace_id WHERE t.id = m.top_thread_id)
        AS workspaceName
    FROM missions m LEFT JOIN usage u ON u.mission_id = m.id
    WHERE ${missionId === undefined ? sql`1 = 1` : sql`m.id = ${missionId}`}
    GROUP BY m.id
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
    if (row === undefined) return yield* notFound("No such mission.");
    const [thread] = yield* sql<Omit<MissionDetail["thread"], "workspace">>`
      SELECT id, state, model, effort, failure, blocker FROM threads WHERE id = ${row.topThreadId}`;
    if (thread === undefined) return yield* notFound("The mission has no top thread.");
    const workspace = yield* readThreadWorkspace(row.topThreadId);
    const messages = yield* sql<MissionDetail["messages"][number]>`
      SELECT id, thread_id AS threadId, sender_kind AS sender, text, sequence, sent_at AS sentAt
      FROM messages WHERE thread_id = ${row.topThreadId} ORDER BY sequence`;
    const questions = yield* listThreadQuestions(row.topThreadId);
    return {
      messages,
      mission: summaryOf(row),
      questions,
      thread: { ...thread, workspace },
    } as MissionDetail;
  });
