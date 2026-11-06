import type { BudgetEvent, BudgetLimits, BudgetPart, BudgetStop, BudgetWindow } from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "./errors.ts";
import { haltThreads } from "./lifecycle.ts";
import {
  changeTextOf,
  isEmpty,
  isReached,
  limitsTextOf,
  missionLimitsOf,
  missionSpendingOf,
  reachedScopesOf,
  reachedTextOf,
  readGlobalBudget,
  tokenSum,
} from "./spending.ts";

// Stopping and releasing work at budget limits, and the owner's budget changes (budget-control, Reaching a limit).

/** Records a budget line in the mission's top thread. Callers run it in a transaction. */
const insertEvent = (missionId: string, text: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO budget_events (id, mission_id, text, at) VALUES (${crypto.randomUUID()}, ${missionId}, ${text}, ${now})`;
  });

/** The scope's open stop's holder, opening the stop with `holderId` when none is open. */
const openStop = (missionId: string | null, holderId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [open] = yield* sql<{ threadId: string }>`
      SELECT thread_id AS threadId FROM budget_stops
      WHERE resolution IS NULL AND ${missionId === null ? sql`mission_id IS NULL` : sql`mission_id = ${missionId}`}`;
    if (open !== undefined) return open.threadId;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO budget_stops (id, mission_id, thread_id, reached_at)
      VALUES (${crypto.randomUUID()}, ${missionId}, ${holderId}, ${now})`;
    if (missionId !== null) {
      const text = reachedTextOf(yield* missionLimitsOf(missionId), yield* missionSpendingOf(missionId));
      yield* insertEvent(missionId, `Stopped at the budget limit: ${text}`);
    }
    return holderId;
  });

/** Threads at work, in a turn or waiting inside one on the owner, in a mission or everywhere. */
const workingThreadsOf = (missionId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`
      SELECT id FROM threads
      WHERE (state = 'Running' OR (state = 'Attention' AND blocker IS NULL))
        AND ${missionId === null ? sql`1 = 1` : sql`mission_id = ${missionId}`}`;
    return rows.map((row) => row.id);
  });

/** Holds threads in Attention for a budget; their interrupted messages run again once released. */
const holdThreads = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (ids.length === 0) return;
    yield* sql`UPDATE messages SET delivered_turn_id = NULL WHERE delivered_turn_id IN (
      SELECT id FROM turns WHERE thread_id IN ${sql.in(ids)} AND status = 'running')`;
    yield* haltThreads(ids, "Attention", "Budget");
  });

const holdQuestionHolder = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET state = 'Attention', blocker = 'Budget'
      WHERE id = ${threadId} AND state NOT IN ('Stopped', 'Running') AND is_deleting = 0`;
  });

/**
 * Stops work under every reached budget over the mission: running threads go to Attention and the
 * scope's question opens, held by `holderId` unless one is open. Returns the threads whose turns must
 * be cancelled. Callers run it in a transaction.
 */
export const enforceBudgets = (missionId: string, holderId: string | null) =>
  Effect.gen(function* () {
    const reached = yield* reachedScopesOf(missionId);
    const halted = new Set<string>();
    const scopes = [...(reached.isMission ? [missionId] : []), ...(reached.isGlobal ? [null] : [])];
    for (const scope of scopes) {
      const working = yield* workingThreadsOf(scope);
      for (const id of working) halted.add(id);
      const holder = holderId ?? working[0] ?? null;
      if (holder === null) continue;
      yield* holdThreads(working);
      yield* holdQuestionHolder(yield* openStop(scope, holder));
    }
    return [...halted];
  });

/** A thread about to start a turn under a reached budget waits in Attention instead. Callers run it in a transaction. */
export const holdIfReached = (threadId: string, missionId: string) =>
  Effect.gen(function* () {
    const reached = yield* reachedScopesOf(missionId);
    if (!reached.isMission && !reached.isGlobal) return false;
    for (const scope of [...(reached.isMission ? [missionId] : []), ...(reached.isGlobal ? [null] : [])])
      yield* openStop(scope, threadId);
    yield* holdQuestionHolder(threadId);
    return true;
  });

/**
 * Ends stops whose budget is no longer reached and releases the threads they held, which become Idle.
 * Returns the released threads to wake. Callers run it in a transaction.
 */
export const releaseBudgets = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const global = yield* readGlobalBudget;
  const isGlobalReached = isReached(global.limits, global.spent);
  const stops = yield* sql<{ id: string; missionId: string | null }>`
    SELECT id, mission_id AS missionId FROM budget_stops WHERE resolution IS NULL`;
  for (const stop of stops) {
    const isStillReached =
      stop.missionId === null ? isGlobalReached : (yield* reachedScopesOf(stop.missionId)).isMission;
    if (!isStillReached)
      yield* sql`UPDATE budget_stops SET resolution = 'Raised', resolved_at = ${now} WHERE id = ${stop.id}`;
  }
  const held = yield* sql<{ id: string; missionId: string }>`
    SELECT id, mission_id AS missionId FROM threads WHERE blocker = 'Budget' AND state = 'Attention'`;
  const released: Array<string> = [];
  for (const thread of held) {
    const reached = yield* reachedScopesOf(thread.missionId);
    if (reached.isMission || reached.isGlobal) {
      // Still held by the other budget: make sure its question is open.
      if (reached.isMission) yield* openStop(thread.missionId, thread.id);
      if (reached.isGlobal) yield* openStop(null, thread.id);
      continue;
    }
    yield* sql`UPDATE threads SET state = 'Idle', blocker = NULL WHERE id = ${thread.id}`;
    released.push(thread.id);
  }
  return released;
});

/** The owner answers Stop: the stop's held threads become Stopped and keep their messages. */
export const stopAtBudget = (stopId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [stop] = yield* sql<{ missionId: string | null; resolution: string | null }>`
      SELECT mission_id AS missionId, resolution FROM budget_stops WHERE id = ${stopId}`;
    if (stop === undefined) return yield* notFound("No such budget stop.");
    if (stop.resolution !== null) return yield* invalid("This budget question was already answered.");
    const now = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE budget_stops SET resolution = 'Stopped', resolved_at = ${now} WHERE id = ${stopId}`;
    yield* sql`UPDATE threads SET state = 'Stopped', blocker = NULL
      WHERE blocker = 'Budget' AND state = 'Attention'
        AND ${stop.missionId === null ? sql`1 = 1` : sql`mission_id = ${stop.missionId}`}`;
    return null;
  });

/**
 * The owner sets, changes, or removes a mission's budget: the line is recorded, then work stops if the
 * budget is now reached, or held threads are released. Callers run it in a transaction, then cancel
 * the halted turns and wake the released threads.
 */
export const setMissionBudget = (missionId: string, limits: BudgetLimits) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [mission] = yield* sql<{
      topThreadId: string;
    }>`SELECT top_thread_id AS topThreadId FROM missions WHERE id = ${missionId}`;
    if (mission === undefined) return yield* notFound("No such mission.");
    const before = yield* missionLimitsOf(missionId);
    yield* sql`UPDATE missions SET budget_cost = ${limits.cost}, budget_tokens = ${limits.tokens} WHERE id = ${missionId}`;
    const text = changeTextOf(before, limits);
    if (text !== null) yield* insertEvent(missionId, text);
    const halted = (yield* reachedScopesOf(missionId)).isMission
      ? yield* enforceBudgets(missionId, mission.topThreadId)
      : [];
    return { halted, released: yield* releaseBudgets };
  });

/** After the global budget changed: work stops if it is reached, or held threads are released. Callers run it in a transaction. */
export const applyGlobalBudget = Effect.gen(function* () {
  const global = yield* readGlobalBudget;
  const halted: Array<string> = [];
  if (isReached(global.limits, global.spent)) {
    const working = yield* workingThreadsOf(null);
    const holder = working[0];
    if (holder !== undefined) {
      yield* holdThreads(working);
      yield* holdQuestionHolder(yield* openStop(null, holder));
      halted.push(...working);
    }
  }
  return { halted, released: yield* releaseBudgets };
});

/** Records a new mission's budget, copied from the default, with its line. Callers run it in a transaction. */
export const applyDefaultBudget = (missionId: string, limits: BudgetLimits) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (isEmpty(limits)) return;
    yield* sql`UPDATE missions SET budget_cost = ${limits.cost}, budget_tokens = ${limits.tokens} WHERE id = ${missionId}`;
    yield* insertEvent(missionId, `Budget set: ${limitsTextOf(limits)}`);
  });

const stopRows = (sql: SqlClient.SqlClient) => sql`
  SELECT s.id, s.mission_id AS missionId, m.title AS missionTitle, s.reached_at AS reachedAt,
    CASE WHEN s.mission_id IS NULL THEN 'Global' ELSE 'Mission' END AS scope, s.thread_id AS threadId
  FROM budget_stops s LEFT JOIN missions m ON m.id = s.mission_id`;

/** The open stop in a mission's scope, or the global one with null. */
export const readOpenStop = (missionId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [stop] = yield* sql<BudgetStop>`${stopRows(sql)}
      WHERE s.resolution IS NULL AND ${missionId === null ? sql`s.mission_id IS NULL` : sql`s.mission_id = ${missionId}`}`;
    return stop ?? null;
  });

/** The open stop whose question the thread holds, mission or global. */
export const readHeldStop = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [stop] = yield* sql<BudgetStop>`${stopRows(sql)}
      WHERE s.resolution IS NULL AND s.thread_id = ${threadId} ORDER BY s.mission_id IS NULL`;
    return stop ?? null;
  });

/** The mission's budget lines, in order. */
export const listBudgetEvents = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<BudgetEvent>`SELECT id, text, at FROM budget_events WHERE mission_id = ${missionId} ORDER BY at, rowid`;
  });

/** The budget window of a mission, split by thread, or the global one, split by mission. */
export const readBudgetWindow = (missionId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (missionId === null) {
      const global = yield* readGlobalBudget;
      const parts = yield* sql<{ id: string; title: string; cost: number; tokens: number }>`
        SELECT m.id, m.title, COALESCE(SUM(u.cost), 0) AS cost, COALESCE(SUM(${sql.literal(tokenSum)}), 0) AS tokens
        FROM usage u JOIN turns t ON t.id = u.turn_id JOIN missions m ON m.id = u.mission_id
        WHERE t.ended_at >= ${global.since} GROUP BY m.id ORDER BY tokens DESC, cost DESC`;
      return {
        limits: global.limits,
        nextStart: global.nextStart,
        parts: parts.map((p): BudgetPart => ({ id: p.id, spent: { cost: p.cost, tokens: p.tokens }, title: p.title })),
        period: global.period,
        periodStart: global.since,
        spent: global.spent,
        stop: yield* readOpenStop(null),
      } satisfies BudgetWindow;
    }
    const [mission] = yield* sql<{ id: string }>`SELECT id FROM missions WHERE id = ${missionId}`;
    if (mission === undefined) return yield* notFound("No such mission.");
    const parts = yield* sql<{ id: string; title: string; cost: number; tokens: number }>`
      SELECT th.id, th.title, COALESCE(SUM(u.cost), 0) AS cost, COALESCE(SUM(${sql.literal(tokenSum)}), 0) AS tokens
      FROM usage u JOIN turns t ON t.id = u.turn_id JOIN threads th ON th.id = t.thread_id
      WHERE u.mission_id = ${missionId} GROUP BY th.id ORDER BY tokens DESC, cost DESC`;
    return {
      limits: yield* missionLimitsOf(missionId),
      nextStart: null,
      parts: parts.map((p): BudgetPart => ({ id: p.id, spent: { cost: p.cost, tokens: p.tokens }, title: p.title })),
      period: null,
      periodStart: null,
      spent: yield* missionSpendingOf(missionId),
      stop: yield* readOpenStop(missionId),
    } satisfies BudgetWindow;
  });
