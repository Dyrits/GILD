import type {
  EffortChoice,
  HarnessName,
  MissionEnding,
  MissionPrompt,
  MissionSummary,
  ModelChoice,
  Settings,
  StartChoices,
  StartMissionResult,
  ThreadState,
} from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient, type Statement } from "effect/sql";
import { applyDefaultBudget } from "./budgets.ts";
import { invalid } from "./errors.ts";
import { insertJournal } from "./journal.ts";
import { insertMessage } from "./messaging.ts";
import { checkAccount, type RunnerChoice, runnerOf } from "./runners.ts";
import { dayMillis, readSettings, saveStartChoices } from "./settings.ts";
import { isReached, readGlobalBudget, tokenSum } from "./spending.ts";
import { titleOf } from "./titles.ts";
import { attachWorkspace } from "./workspaces.ts";

// Ordered from most to least urgent (mission-tracking specification). Done and
// Stopped add no urgency; Idle is the provisional fallback until it is settled.
const urgency: ReadonlyArray<ThreadState> = ["Attention", "Failed", "Running", "Waiting", "Idle"];
const workedOutStateOf = (states: ReadonlyArray<string>): ThreadState =>
  urgency.find((state) => states.includes(state)) ?? "Idle";
/** States that put a mission first on the dashboard (provisional: CHG-0045, work-in-progress Batch 9). */

/**
 * Records the mission, its top thread in the chosen workspace or none, and the first message.
 * Callers run it in a transaction.
 */
export const insertMission = (
  text: string,
  choice: RunnerChoice & { readonly effort: EffortChoice; readonly model: ModelChoice },
  workspacePath: string | null,
  shouldRememberChoices = true,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const global = yield* readGlobalBudget;
    // A reached global budget refuses new missions (budget-control, Reaching a limit).
    if (isReached(global.limits, global.spent))
      return yield* invalid("The global budget is reached. Raise it in Settings to start a mission.");
    const settings = yield* readSettings;
    const runner = yield* checkAccount(
      runnerOf(
        { accountId: null, effort: choice.effort, harness: settings.defaultHarness, model: choice.model },
        choice,
      ),
    );
    const { accountId, effort, harness, model } = runner;
    const workspaceId = workspacePath === null ? null : yield* attachWorkspace(workspacePath);
    const now = yield* Clock.currentTimeMillis;
    const missionId = crypto.randomUUID();
    const threadId = crypto.randomUUID();
    yield* sql`INSERT INTO missions (id, top_thread_id, title, created_at, last_activity_at)
      VALUES (${missionId}, ${threadId}, ${titleOf(text)}, ${now}, ${now})`;
    yield* sql`INSERT INTO threads (id, mission_id, state, harness, account_id, model, effort, workspace_id, title)
      VALUES (${threadId}, ${missionId}, 'Idle', ${harness}, ${accountId}, ${model}, ${effort}, ${workspaceId}, ${titleOf(text)})`;
    const messageId = yield* insertMessage({ fromThreadId: null, isQueued: false, isResult: false, text, threadId });
    yield* insertJournal(missionId);
    yield* applyDefaultBudget(missionId, settings.defaultMissionBudget);
    // A mission opened from an off-topic suggestion is not the owner's own start, so the prefill stays.
    if (shouldRememberChoices)
      yield* saveStartChoices({
        accountId: accountId as StartChoices["accountId"],
        effort,
        harness,
        model,
        workspacePath,
      });
    return { messageId, missionId, threadId } as StartMissionResult;
  });

type MissionRow = {
  id: string;
  title: string;
  topThreadId: string;
  harness: HarnessName;
  model: ModelChoice;
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
  return now - quietSince >= settings.inactivityDays * dayMillis ? "Inactive" : null;
};

const summaryOf = (row: MissionRow, now: number, settings: Settings): MissionSummary => {
  const states = row.states.split(",");
  return {
    budget: {
      limits: { cost: row.budgetCost, tokens: row.budgetTokens },
      spent: { cost: row.spentCost, tokens: row.spentTokens },
    },
    harness: row.harness,
    id: row.id,
    isTitleByUser: row.isTitleByUser === 1,
    lastActivityAt: row.lastActivityAt,
    model: row.model,
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
    SELECT m.id, m.title, m.top_thread_id AS topThreadId, top.harness AS harness, top.model AS model, m.last_activity_at AS lastActivityAt,
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

/** The summaries of the Archived view's missions, or of the dashboard's: not ended, or Done. */
export const listViewSummaries = (isArchived: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const settings = yield* readSettings;
    const rows = yield* missionRows(
      sql,
      isArchived ? sql`m.ending = 'Archived'` : sql`(m.ending IS NULL OR m.ending = 'Done')`,
    );
    return rows.map((row) => summaryOf(row, now, settings));
  });
