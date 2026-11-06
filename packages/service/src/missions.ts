import type {
  EffortChoice,
  Message,
  MissionDetail,
  MissionSummary,
  ModelChoice,
  StartMissionResult,
  ThreadState,
  ThreadSummary,
} from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { readChatter } from "./chatter.ts";
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
    yield* sql`INSERT INTO threads (id, mission_id, state, model, effort, workspace_id, title)
      VALUES (${threadId}, ${missionId}, 'Idle', ${model}, ${effort}, ${workspaceId}, ${titleOf(text)})`;
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

type ThreadRow = Omit<ThreadSummary, "isOpenedByAgent"> & { isOpenedByAgent: number };

/** The mission's threads with their depth and kept messages, each parent before the threads beneath it. */
const listThreads = (missionId: string, topThreadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<ThreadRow & { path: string }>`
      WITH RECURSIVE tree(id, depth, path) AS (
        SELECT id, 0, '' FROM threads WHERE id = ${topThreadId}
        UNION ALL
        SELECT t.id, tree.depth + 1, tree.path || printf('%020d', t.rowid) || '/'
        FROM threads t JOIN tree ON t.parent_id = tree.id
      )
      SELECT t.id, t.parent_id AS parentId, t.title, t.state, tree.depth, tree.path,
        t.is_opened_by_agent AS isOpenedByAgent,
        (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id AND m.sender_kind IN ('user', 'thread')
          AND m.delivered_turn_id IS NULL) AS waitingCount
      FROM tree JOIN threads t ON t.id = tree.id
      WHERE t.mission_id = ${missionId}
      ORDER BY tree.path`;
    return rows.map(
      ({ path: _path, ...row }) => ({ ...row, isOpenedByAgent: row.isOpenedByAgent === 1 }) as ThreadSummary,
    );
  });

/** A mission with its thread tree and the conversation of one thread, the top thread by default. */
export const readMission = (missionId: string, threadId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* missionRows(sql, missionId);
    if (row === undefined) return yield* notFound("No such mission.");
    const threads = yield* listThreads(missionId, row.topThreadId);
    const selected = threads.find((thread) => thread.id === (threadId ?? row.topThreadId));
    if (selected === undefined) return yield* notFound("No such thread in this mission.");
    const [thread] = yield* sql<Pick<MissionDetail["thread"], "id" | "model" | "effort" | "failure" | "blocker">>`
      SELECT id, model, effort, failure, blocker FROM threads WHERE id = ${selected.id}`;
    if (thread === undefined) return yield* notFound("No such thread in this mission.");
    const workspace = yield* readThreadWorkspace(selected.id);
    const messages = yield* sql<Omit<Message, "isResult" | "isQueued"> & { isResult: number; isQueued: number }>`
      SELECT m.id, m.thread_id AS threadId, m.sender_kind AS sender, m.text, m.sequence, m.sent_at AS sentAt,
        m.sender_thread_id AS fromThreadId, COALESCE(s.title, m.sender_title) AS fromTitle, m.is_result AS isResult,
        (m.is_queued = 1 AND m.delivered_turn_id IS NULL) AS isQueued
      FROM messages m LEFT JOIN threads s ON s.id = m.sender_thread_id
      WHERE m.thread_id = ${selected.id} ORDER BY m.sequence`;
    const questions = yield* listThreadQuestions(selected.id);
    return {
      chatter: yield* readChatter(selected.id),
      messages: messages.map((message) => ({
        ...message,
        isQueued: message.isQueued === 1,
        isResult: message.isResult === 1,
      })),
      mission: summaryOf(row),
      questions,
      thread: {
        ...thread,
        depth: selected.depth,
        parentId: selected.parentId,
        state: selected.state,
        title: selected.title,
        waitingCount: selected.waitingCount,
        workspace,
      },
      threads,
    } as MissionDetail;
  });
