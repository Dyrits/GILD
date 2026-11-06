import type {
  EffortChoice,
  Message,
  MissionDetail,
  MissionEnding,
  MissionList,
  MissionPrompt,
  MissionState,
  MissionSummary,
  ModelChoice,
  Settings,
  StartMissionResult,
  ThreadState,
  ThreadSummary,
  WorkspaceChoice,
} from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient, type Statement } from "effect/sql";
import { applyDefaultBudget, listBudgetEvents, readHeldStop } from "./budgets.ts";
import { readChatter } from "./chatter.ts";
import { invalid, notFound } from "./errors.ts";
import { insertJournal } from "./journal.ts";
import { listThreadQuestions } from "./questions.ts";
import { readSettings, saveStartChoices } from "./settings.ts";
import { isReached, readGlobalBudget, tokenSum } from "./spending.ts";
import { listThreadSuggestions } from "./suggestionStore.ts";
import { attachWorkspace, readThreadWorkspace } from "./workspaces.ts";

// Ordered from most to least urgent (mission-tracking specification). Done and
// Stopped add no urgency; Idle is the provisional fallback until it is settled.
const urgency: ReadonlyArray<ThreadState> = ["Attention", "Failed", "Running", "Waiting", "Idle"];
const workedOutStateOf = (states: ReadonlyArray<string>): ThreadState =>
  urgency.find((state) => states.includes(state)) ?? "Idle";
/** States that put a mission first on the dashboard (provisional: CHG-0045, work-in-progress Batch 9). */
const needsOwner: ReadonlyArray<MissionState> = ["Attention", "Failed"];
const day = 24 * 60 * 60 * 1000;

export const titleOf = (text: string) => text.trim().split("\n", 1)[0]?.trim().slice(0, 200) ?? "";

/**
 * Records the mission, its top thread in the chosen workspace or none, and the first message.
 * Callers run it in a transaction.
 */
export const insertMission = (
  text: string,
  model: ModelChoice,
  effort: EffortChoice,
  workspacePath: string | null,
  shouldRememberChoices = true,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const global = yield* readGlobalBudget;
    // A reached global budget refuses new missions (budget-control, Reaching a limit).
    if (isReached(global.limits, global.spent))
      return yield* invalid("The global budget is reached. Raise it in Settings to start a mission.");
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
    yield* insertJournal(missionId);
    yield* applyDefaultBudget(missionId, (yield* readSettings).defaultMissionBudget);
    // A mission opened from an off-topic suggestion is not the owner's own start, so the prefill stays.
    if (shouldRememberChoices) yield* saveStartChoices({ effort, model, workspacePath });
    return { messageId, missionId, threadId } as StartMissionResult;
  });

type MissionRow = {
  id: string;
  title: string;
  topThreadId: string;
  lastActivityAt: number;
  states: string;
  threadCount: number;
  ending: MissionEnding | null;
  isTitleByUser: number;
  isAskingDone: number;
  inactivityDismissedAt: number | null;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  workspaceId: string | null;
  workspaceName: string | null;
  budgetCost: number | null;
  budgetTokens: number | null;
  spentCost: number;
  spentTokens: number;
};

/** What the dashboard asks of a mission not ended: Mark as done after its result, or about its inactivity. */
const promptOf = (row: MissionRow, now: number, settings: Settings): MissionPrompt | null => {
  if (row.ending !== null) return null;
  if (row.isAskingDone === 1) return "MarkDone";
  const quietSince = Math.max(row.lastActivityAt, row.inactivityDismissedAt ?? 0);
  return now - quietSince >= settings.inactivityDays * day ? "Inactive" : null;
};

const summaryOf = (row: MissionRow, now: number, settings: Settings): MissionSummary => {
  const states = row.states.split(",");
  return {
    budget: {
      limits: { cost: row.budgetCost, tokens: row.budgetTokens },
      spent: { cost: row.spentCost, tokens: row.spentTokens },
    },
    id: row.id,
    isTitleByUser: row.isTitleByUser === 1,
    lastActivityAt: row.lastActivityAt,
    prompt: promptOf(row, now, settings),
    runningCount: states.filter((state) => state === "Running").length,
    state: row.ending ?? workedOutStateOf(states),
    threadCount: row.threadCount,
    title: row.title,
    topThreadId: row.topThreadId,
    usage: { cacheCreation: row.cacheCreation, cacheRead: row.cacheRead, input: row.input, output: row.output },
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
  } as MissionSummary;
};

const missionRows = (sql: SqlClient.SqlClient, where: Statement.Fragment) =>
  sql<MissionRow>`
    SELECT m.id, m.title, m.top_thread_id AS topThreadId, m.last_activity_at AS lastActivityAt,
      (SELECT group_concat(t.state) FROM threads t WHERE t.mission_id = m.id) AS states,
      (SELECT COUNT(*) FROM threads t WHERE t.mission_id = m.id) AS threadCount,
      m.ending, m.is_title_by_user AS isTitleByUser, m.is_asking_done AS isAskingDone,
      m.inactivity_dismissed_at AS inactivityDismissedAt,
      COALESCE(SUM(u.input), 0) AS input, COALESCE(SUM(u.output), 0) AS output,
      COALESCE(SUM(u.cache_read), 0) AS cacheRead, COALESCE(SUM(u.cache_creation), 0) AS cacheCreation,
      m.budget_cost AS budgetCost, m.budget_tokens AS budgetTokens, COALESCE(SUM(u.cost), 0) AS spentCost,
      COALESCE(SUM(${sql.literal(tokenSum)}), 0) AS spentTokens,
      w.id AS workspaceId, w.name AS workspaceName
    FROM missions m
      JOIN threads top ON top.id = m.top_thread_id
      LEFT JOIN workspaces w ON w.id = top.workspace_id
      LEFT JOIN journals j ON j.mission_id = m.id
      LEFT JOIN usage u ON u.mission_id = m.id
    WHERE ${where}
    GROUP BY m.id
    ORDER BY m.last_activity_at DESC`;

/** The current summary of each given mission, for missions offered elsewhere (thread-tree, Off-topic requests). */
export const listMissionSummaries = (missionIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (missionIds.length === 0) return [];
    const now = yield* Clock.currentTimeMillis;
    const settings = yield* readSettings;
    const rows = yield* missionRows(sql, sql`m.id IN ${sql.in(missionIds)}`);
    return rows.map((row) => summaryOf(row, now, settings));
  });

/** The dashboard's filters: the Archived view or not, a state, a workspace, and a search text. */
export interface MissionFilters {
  readonly isArchived: boolean;
  readonly search: string | null;
  readonly state: MissionState | null;
  readonly workspaceId: string | null;
}

/**
 * The view's missions that match the filters, those needing the owner first and then by latest activity,
 * with the workspaces among all the view's missions.
 */
export const listMissions = (filters: MissionFilters) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const settings = yield* readSettings;
    const search = filters.search?.trim().toLowerCase() ?? "";
    const rows = yield* missionRows(
      sql,
      filters.isArchived ? sql`m.ending = 'Archived'` : sql`(m.ending IS NULL OR m.ending = 'Done')`,
    );
    const workspaces = new Map<string, string>();
    for (const row of rows) if (row.workspaceId !== null) workspaces.set(row.workspaceId, row.workspaceName ?? "");
    // instr, not LIKE, so % and _ in the search are plain text.
    const matching =
      search === ""
        ? new Set(rows.map((row) => row.id))
        : new Set(
            (yield* sql<{ id: string }>`
              SELECT m.id FROM missions m LEFT JOIN journals j ON j.mission_id = m.id
              WHERE instr(lower(m.title), ${search}) > 0 OR instr(lower(COALESCE(j.briefing, '')), ${search}) > 0`).map(
              (row) => row.id,
            ),
          );
    const missions = rows
      .filter((row) => matching.has(row.id))
      .filter((row) => filters.workspaceId === null || row.workspaceId === filters.workspaceId)
      .map((row) => summaryOf(row, now, settings))
      .filter((mission) => filters.state === null || mission.state === filters.state);
    const first = missions.filter((mission) => needsOwner.includes(mission.state));
    return {
      missions: [...first, ...missions.filter((mission) => !needsOwner.includes(mission.state))],
      workspaces: [...workspaces].map(([id, name]) => ({ id, name }) as WorkspaceChoice),
    } satisfies MissionList;
  });

type ThreadRow = Omit<ThreadSummary, "isOpenedByAgent" | "isAside"> & { isOpenedByAgent: number; isAside: number };

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
        t.is_opened_by_agent AS isOpenedByAgent, t.is_aside AS isAside,
        (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id AND m.sender_kind IN ('user', 'thread')
          AND m.delivered_turn_id IS NULL) AS waitingCount
      FROM tree JOIN threads t ON t.id = tree.id
      WHERE t.mission_id = ${missionId}
      ORDER BY tree.path`;
    return rows.map(
      ({ path: _path, ...row }) =>
        ({ ...row, isAside: row.isAside === 1, isOpenedByAgent: row.isOpenedByAgent === 1 }) as ThreadSummary,
    );
  });

/** A mission with its thread tree and the conversation of one thread, the top thread by default. */
export const readMission = (missionId: string, threadId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* missionRows(sql, sql`m.id = ${missionId}`);
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
    const suggestions = yield* listThreadSuggestions(selected.id);
    return {
      budgetEvents: selected.parentId === null ? yield* listBudgetEvents(missionId) : [],
      budgetStop: yield* readHeldStop(selected.id),
      chatter: yield* readChatter(selected.id),
      messages: messages.map((message) => ({
        ...message,
        isQueued: message.isQueued === 1,
        isResult: message.isResult === 1,
      })),
      mission: summaryOf(row, yield* Clock.currentTimeMillis, yield* readSettings),
      questions,
      suggestions,
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
