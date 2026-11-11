import type {
  Crest,
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
} from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient, type Statement } from "effect/sql";
import {
  consumptionColumns,
  costSum,
  dayMillis,
  invalid,
  isReached,
  readGlobalBudget,
  readSettings,
  saveStartChoices,
  tokenSum,
} from "../core/index.ts";
import { checkAccount, type RunnerChoice, runnerOf } from "../harness/index.ts";
import { budgetRefusalOf } from "./budgetScopes.ts";
import { applyDefaultBudget } from "./budgets.ts";
import { consumptionOf } from "./consumption.ts";
import { insertJournal } from "./journal.ts";
import { insertMessage } from "./messaging.ts";
import { runStateOf, scheduleOf } from "./ritualSchedule.ts";
import { attachmentsTitle, titleOf } from "./titles.ts";
import { attachWorkspace, crestOfRow } from "./workspaces.ts";

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
  realm: { crest: Crest | null; name: string } | null = null,
  attachmentIds: ReadonlyArray<string> = [],
) =>
  insertQuest(
    { attachmentIds, firstMessage: text, realm, shouldRememberChoices, title: titleOf(text) || attachmentsTitle },
    choice,
    workspacePath,
  ).pipe(Effect.map((started) => started as StartMissionResult));

/**
 * Records a quest, its top thread, and its first message when it has one; a Ritual's quest has none until its first run
 * (rituals). A title given by `isTitleByOwner` is kept against agents' renames. Callers run it in a transaction.
 */
export const insertQuest = (
  quest: {
    /** The files attached to the first message, added beforehand as drafts (message-attachments). */
    readonly attachmentIds?: ReadonlyArray<string>;
    readonly firstMessage: string | null;
    readonly isTitleByOwner?: boolean;
    readonly realm: { crest: Crest | null; name: string } | null;
    readonly shouldRememberChoices: boolean;
    readonly title: string;
  },
  choice: RunnerChoice & { readonly effort: EffortChoice; readonly model: ModelChoice },
  workspacePath: string | null,
) =>
  Effect.gen(function* () {
    const { realm, shouldRememberChoices } = quest;
    const sql = yield* SqlClient.SqlClient;
    const global = yield* readGlobalBudget;
    // A reached global budget refuses new missions (budget-control, Reaching a limit).
    if (isReached(global.limits, global.spent))
      return yield* invalid("The global budget is reached. Raise it in the Workshop to start a mission.");
    const settings = yield* readSettings;
    const runner = yield* checkAccount(
      runnerOf(
        { accountId: null, effort: choice.effort, harness: settings.defaultHarness, model: choice.model },
        choice,
      ),
    );
    const { accountId, effort, harness, model } = runner;
    // A reached account budget refuses a quest started on that account (budget-control, Reaching a limit).
    const accountBudgetRefusal = yield* budgetRefusalOf(null, { accountId, harness }, "Account");
    if (accountBudgetRefusal !== null) return yield* invalid(accountBudgetRefusal);
    const workspaceId = workspacePath === null ? null : yield* attachWorkspace(workspacePath, realm);
    const now = yield* Clock.currentTimeMillis;
    const missionId = crypto.randomUUID();
    const threadId = crypto.randomUUID();
    yield* sql`INSERT INTO missions (id, top_thread_id, title, created_at, last_activity_at, is_title_by_user)
      VALUES (${missionId}, ${threadId}, ${quest.title}, ${now}, ${now}, ${quest.isTitleByOwner === true ? 1 : 0})`;
    // The Charter's backup Companions are the new thread's own from the start (thread-panel, Backup companions).
    yield* sql`INSERT INTO threads (id, mission_id, state, harness, account_id, model, effort, workspace_id, title, backups)
      VALUES (${threadId}, ${missionId}, 'Idle', ${harness}, ${accountId}, ${model}, ${effort}, ${workspaceId}, ${quest.title}, ${JSON.stringify(settings.backups)})`;
    const messageId =
      quest.firstMessage === null
        ? null
        : yield* insertMessage({
            fromThreadId: null,
            isQueued: false,
            isResult: false,
            text: quest.firstMessage,
            threadId,
            ...(quest.attachmentIds === undefined ? {} : { attachmentIds: quest.attachmentIds }),
          });
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
    return { messageId, missionId, threadId };
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
  reported: number;
  estimated: number;
  turns: number;
  unpricedTurns: number;
  earlierTurns: number;
  workspaceId: string | null;
  workspaceCrest: string | null;
  workspaceName: string | null;
  budgetCost: number | null;
  budgetTokens: number | null;
  ritualId: string | null;
  ritualIsOn: number | null;
  ritualLastRunAt: number | null;
  ritualLastRunState: string | null;
  ritualNextRunAt: number | null;
  ritualSchedule: string | null;
  topState: string;
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
    consumption: consumptionOf(row),
    harness: row.harness,
    id: row.id,
    isTitleByUser: row.isTitleByUser === 1,
    lastActivityAt: row.lastActivityAt,
    model: row.model,
    prompt: promptOf(row, now, settings),
    ritual:
      row.ritualId === null || row.ritualSchedule === null
        ? null
        : {
            id: row.ritualId,
            isOn: row.ritualIsOn === 1,
            lastRunAt: row.ritualLastRunAt,
            lastRunState: runStateOf(row.ritualLastRunState, row.topState),
            nextRunAt: row.ritualNextRunAt,
            schedule: scheduleOf(row.ritualSchedule),
          },
    runningCount: states.filter((state) => state === "Running").length,
    state: row.ending ?? workedOutStateOf(states),
    threadCount: row.threadCount,
    title: row.title,
    topThreadId: row.topThreadId,
    usage: { cacheCreation: row.cacheCreation, cacheRead: row.cacheRead, input: row.input, output: row.output },
    workspaceCrest: crestOfRow(row.workspaceCrest),
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
      ${sql.literal(consumptionColumns)},
      m.budget_cost AS budgetCost, m.budget_tokens AS budgetTokens, COALESCE(SUM(${sql.literal(costSum)}), 0) AS spentCost,
      COALESCE(SUM(${sql.literal(tokenSum)}), 0) AS spentTokens,
      w.id AS workspaceId, w.name AS workspaceName, w.crest AS workspaceCrest,
      r.id AS ritualId, r.is_on AS ritualIsOn, r.last_run_at AS ritualLastRunAt, r.last_run_state AS ritualLastRunState,
      r.next_run_at AS ritualNextRunAt, r.schedule AS ritualSchedule, top.state AS topState
    FROM missions m
      JOIN threads top ON top.id = m.top_thread_id
      LEFT JOIN rituals r ON r.mission_id = m.id
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
    // A Ritual's quest is listed with the Rituals, not with the quests (rituals); the Guildmaster's is in no list.
    const rows = yield* missionRows(
      sql,
      isArchived
        ? sql`m.ending = 'Archived' AND r.id IS NULL AND m.is_guildmaster = 0`
        : sql`(m.ending IS NULL OR m.ending = 'Done') AND r.id IS NULL AND m.is_guildmaster = 0`,
    );
    return rows.map((row) => summaryOf(row, now, settings));
  });
