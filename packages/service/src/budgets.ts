import type { BudgetLimits } from "@canopy/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "./errors.ts";
import { haltThreads, holdQuestionHolder, holdThread, releaseThread, waitsInTurn } from "./lifecycle.ts";
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
} from "./spending.ts";

// Stopping and releasing work at budget limits, and the owner's budget changes (budget-control, Reaching a limit).
// A scope is a mission's id, or null for the global budget; what the owner reads lives in budgetViews.ts.

/** The `budget_stops` rows of a scope: the mission's, or the global ones with null. */
export const stopScopeOf = (sql: SqlClient.SqlClient, missionId: string | null, column = "mission_id") =>
  missionId === null ? sql`${sql.literal(column)} IS NULL` : sql`${sql.literal(column)} = ${missionId}`;

/** The threads a scope covers: the mission's, or every thread with null. */
const threadScopeOf = (sql: SqlClient.SqlClient, missionId: string | null) =>
  missionId === null ? sql`1 = 1` : sql`mission_id = ${missionId}`;

/** The scopes whose budget is reached over a mission: its own, then the global one. */
const reachedScopeListOf = (missionId: string) =>
  Effect.map(reachedScopesOf(missionId), (reached) => [
    ...(reached.isMission ? [missionId] : []),
    ...(reached.isGlobal ? [null] : []),
  ]);

/** Records a budget line in the mission's top thread. Callers run it in a transaction. */
const insertEvent = (missionId: string, text: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO budget_events (id, mission_id, text, at) VALUES (${crypto.randomUUID()}, ${missionId}, ${text}, ${now})`;
  });

/** The scope's open stop's holder, opening the stop with `holderId` when none is open. */
const ensureStop = (missionId: string | null, holderId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [open] = yield* sql<{ threadId: string }>`
      SELECT thread_id AS threadId FROM budget_stops
      WHERE resolution IS NULL AND ${stopScopeOf(sql, missionId)}`;
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
      WHERE (state = 'Running' OR ${sql.literal(waitsInTurn)})
        AND ${threadScopeOf(sql, missionId)}`;
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

/**
 * Stops work under every reached budget over the mission: running threads go to Attention and the
 * scope's question opens, held by `holderId` unless one is open. Returns the threads whose turns must
 * be cancelled. Callers run it in a transaction.
 */
export const enforceBudgets = (missionId: string, holderId: string | null) =>
  Effect.gen(function* () {
    const halted = new Set<string>();
    for (const scope of yield* reachedScopeListOf(missionId))
      for (const id of yield* stopScope(scope, holderId)) halted.add(id);
    return [...halted];
  });

/**
 * Holds the scope's working threads and opens its question, held by `holderId` or the first of them.
 * Returns the threads at work, held or not, as the turns to cancel.
 */
const stopScope = (scope: string | null, holderId: string | null) =>
  Effect.gen(function* () {
    const working = yield* workingThreadsOf(scope);
    const holder = holderId ?? working[0] ?? null;
    if (holder === null) return working;
    yield* holdThreads(working);
    yield* holdQuestionHolder(yield* ensureStop(scope, holder), "Budget");
    return working;
  });

/** A thread about to start a turn under a reached budget waits in Attention instead. Callers run it in a transaction. */
export const holdIfReached = (threadId: string, missionId: string) =>
  Effect.gen(function* () {
    const scopes = yield* reachedScopeListOf(missionId);
    if (scopes.length === 0) return false;
    for (const scope of scopes) yield* ensureStop(scope, threadId);
    yield* holdThread(threadId, "Budget");
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
      if (reached.isMission) yield* ensureStop(thread.missionId, thread.id);
      if (reached.isGlobal) yield* ensureStop(null, thread.id);
      continue;
    }
    yield* releaseThread(thread.id);
    released.push(thread.id);
  }
  return released;
});

/**
 * The owner answers Stop: the stop's held threads become Stopped and keep their messages. Returns the
 * missions whose threads stopped, to wake. Callers run it in a transaction.
 */
export const stopAtBudget = (stopId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [stop] = yield* sql<{ missionId: string | null; resolution: string | null }>`
      SELECT mission_id AS missionId, resolution FROM budget_stops WHERE id = ${stopId}`;
    if (stop === undefined) return yield* notFound("No such budget stop.");
    if (stop.resolution !== null) return yield* invalid("This budget question was already answered.");
    const now = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE budget_stops SET resolution = 'Stopped', resolved_at = ${now} WHERE id = ${stopId}`;
    const held = yield* sql<{ id: string; missionId: string }>`
      SELECT id, mission_id AS missionId FROM threads
      WHERE blocker = 'Budget' AND state = 'Attention' AND ${threadScopeOf(sql, stop.missionId)}`;
    yield* haltThreads(
      held.map((thread) => thread.id),
      "Stopped",
    );
    return [...new Set(held.map((thread) => thread.missionId))];
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
  const halted = isReached(global.limits, global.spent) ? yield* stopScope(null, null) : [];
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
