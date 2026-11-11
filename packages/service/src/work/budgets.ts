import type { BudgetLimits } from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import {
  changeTextOf,
  invalid,
  isEmpty,
  limitsTextOf,
  missionLimitsOf,
  notFound,
  readGlobalBudget,
} from "../core/index.ts";
import { fallBackToBackup } from "./backups.ts";
import {
  accountLabelOf,
  accountOfThread,
  type BudgetScope,
  isScopeReached,
  reachedScopesOf,
  reachedTextOfScope,
  scopeOfStop,
  stopWhere,
  threadsWhere,
} from "./budgetScopes.ts";
import { changed } from "./commands.ts";
import { haltThreads, holdQuestionHolder, holdThread, releaseThread, waitsInTurn } from "./lifecycle.ts";

// Stopping and releasing work at budget limits, and the owner's budget changes (budget-control, Reaching a limit).
// A scope is a mission's budget, a provider account's, or the global one (budgetScopes.ts); what the owner reads
// lives in budgetViews.ts.

/** Records a budget line in the mission's top thread. Callers run it in a transaction. */
export const insertEvent = (missionId: string, text: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO budget_events (id, mission_id, text, at) VALUES (${crypto.randomUUID()}, ${missionId}, ${text}, ${now})`;
  });

/** Records a line about the global budget in the Guildmaster's quest, where the owner reads it; nothing is recorded before the Guildmaster exists. */
const insertGlobalEvent = (text: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [guildmaster] = yield* sql<{ id: string }>`SELECT id FROM missions WHERE is_guildmaster = 1`;
    if (guildmaster !== undefined) yield* insertEvent(guildmaster.id, text);
  });

/** The scope's open stop's holder, opening the stop with `holderId` when none is open; whether it was opened now. */
const ensureStop = (scope: BudgetScope, holderId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [open] = yield* sql<{ threadId: string }>`
      SELECT thread_id AS threadId FROM budget_stops
      WHERE resolution IS NULL AND ${stopWhere(sql, scope)}`;
    if (open !== undefined) return { holder: open.threadId, isNew: false };
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO budget_stops (id, mission_id, account_key, thread_id, reached_at)
      VALUES (${crypto.randomUUID()}, ${scope._tag === "Mission" ? scope.id : null},
        ${scope._tag === "Account" ? `${scope.harness}:${scope.accountId ?? ""}` : null}, ${holderId}, ${now})`;
    if (scope._tag === "Mission") {
      yield* insertEvent(scope.id, `Stopped at the budget limit: ${yield* reachedTextOfScope(scope)}`);
    } else if (scope._tag === "Global") {
      yield* insertGlobalEvent(`Stopped at the global budget limit: ${yield* reachedTextOfScope(scope)}`);
    }
    return { holder: holderId, isNew: true };
  });

/** A line in each quest that has a thread the account's budget stopped, naming the account and what was reached. */
const recordAccountStop = (scope: BudgetScope & { _tag: "Account" }, threadIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (threadIds.length === 0) return;
    const missions = yield* sql<{ missionId: string }>`
      SELECT DISTINCT mission_id AS missionId FROM threads WHERE id IN ${sql.in(threadIds)}`;
    const text = `Account ${yield* accountLabelOf(scope)} reached its budget: ${yield* reachedTextOfScope(scope)}`;
    for (const { missionId } of missions) yield* insertEvent(missionId, text);
  });

/** Threads at work, in a turn or waiting inside one on the owner, under a scope. */
const workingThreadsOf = (scope: BudgetScope) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`
      SELECT id FROM threads
      WHERE (state = 'Running' OR ${sql.literal(waitsInTurn)})
        AND ${threadsWhere(sql, scope)}`;
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
 * Holds the scope's working threads and opens its question, held by `holderId` or the first of them.
 * Returns the threads at work, held or not, as the turns to cancel.
 */
const stopScope = (scope: BudgetScope, holderId: string | null) =>
  Effect.gen(function* () {
    const working = yield* workingThreadsOf(scope);
    const holder = holderId ?? working[0] ?? null;
    if (holder === null) return working;
    yield* holdThreads(working);
    const stop = yield* ensureStop(scope, holder);
    if (stop.isNew && scope._tag === "Account") yield* recordAccountStop(scope, [...new Set([holder, ...working])]);
    yield* holdQuestionHolder(stop.holder, "Budget");
    return working;
  });

/**
 * Stops work under every reached budget over the mission and the account of the thread that spent: running threads
 * go to Attention and the scope's question opens, held by `holderId` unless one is open. Returns the threads whose
 * turns the command must cancel. Callers run it in a transaction.
 */
export const enforceBudgets = (missionId: string, holderId: string | null) =>
  Effect.gen(function* () {
    const halted = new Set<string>();
    const account = holderId === null ? null : yield* accountOfThread(holderId);
    for (const scope of yield* reachedScopesOf(missionId, account))
      for (const id of yield* stopScope(scope, holderId)) halted.add(id);
    return [...halted];
  });

/** A thread about to start a turn under a reached budget waits in Attention instead. Callers run it in a transaction. */
export const holdIfReached = (threadId: string, missionId: string) =>
  Effect.gen(function* () {
    const scopes = yield* reachedScopesOf(missionId, yield* accountOfThread(threadId));
    if (scopes.length === 0) return false;
    for (const scope of scopes) yield* ensureStop(scope, threadId);
    yield* holdThread(threadId, "Budget");
    return true;
  });

/**
 * Ends stops whose budget is no longer reached and releases the threads they held, which become Idle.
 * Returns the released threads, for the command that releases them to wake. Callers run it in a transaction.
 */
export const releaseBudgets = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const stops = yield* sql<{ accountKey: string | null; id: string; missionId: string | null }>`
    SELECT id, mission_id AS missionId, account_key AS accountKey FROM budget_stops WHERE resolution IS NULL`;
  for (const stop of stops) {
    if (!(yield* isScopeReached(scopeOfStop(stop))))
      yield* sql`UPDATE budget_stops SET resolution = 'Raised', resolved_at = ${now} WHERE id = ${stop.id}`;
  }
  const held = yield* sql<{ id: string; missionId: string }>`
    SELECT id, mission_id AS missionId FROM threads WHERE blocker = 'Budget' AND state = 'Attention'`;
  const released: Array<string> = [];
  for (const thread of held) {
    const reached = yield* reachedScopesOf(thread.missionId, yield* accountOfThread(thread.id));
    if (reached.length > 0) {
      // Still held by another budget: make sure its question is open.
      for (const scope of reached) yield* ensureStop(scope, thread.id);
      continue;
    }
    yield* releaseThread(thread.id);
    released.push(thread.id);
  }
  return released;
});

/** The held threads under a scope, to stop or to carry on. */
const heldThreadsOf = (scope: BudgetScope) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<{ id: string; missionId: string }>`
      SELECT id, mission_id AS missionId FROM threads
      WHERE blocker = 'Budget' AND state = 'Attention' AND ${threadsWhere(sql, scope)}`;
  });

/**
 * The owner answers Stop: the stop's held threads become Stopped and keep their messages, and the missions
 * whose threads stopped are woken.
 */
export const stopAtBudget = (stopId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [stop] = yield* sql<{ accountKey: string | null; missionId: string | null; resolution: string | null }>`
      SELECT mission_id AS missionId, account_key AS accountKey, resolution FROM budget_stops WHERE id = ${stopId}`;
    if (stop === undefined) return yield* notFound("No such budget stop.");
    if (stop.resolution !== null) return yield* invalid("This budget question was already answered.");
    const now = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE budget_stops SET resolution = 'Stopped', resolved_at = ${now} WHERE id = ${stopId}`;
    const held = yield* heldThreadsOf(scopeOfStop(stop));
    yield* haltThreads(
      held.map((thread) => thread.id),
      "Stopped",
    );
    return changed(null, { missionsToWake: [...new Set(held.map((thread) => thread.missionId))] });
  });

/**
 * The owner answers Switch to a backup Companion at an account's budget: the thread that holds the question carries on
 * with its next backup, on another account or harness, and the threads still held by the account stay held under
 * the same question. Refused when the stop is not an account's or the thread has no backup to take.
 */
export const switchAtBudget = (stopId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [stop] = yield* sql<{
      accountKey: string | null;
      missionId: string | null;
      resolution: string | null;
      threadId: string;
    }>`SELECT mission_id AS missionId, account_key AS accountKey, resolution, thread_id AS threadId
      FROM budget_stops WHERE id = ${stopId}`;
    if (stop === undefined) return yield* notFound("No such budget stop.");
    if (stop.resolution !== null) return yield* invalid("This budget question was already answered.");
    const scope = scopeOfStop(stop);
    if (scope._tag !== "Account") return yield* invalid("Only an account's budget offers a backup Companion.");
    // A held thread is in Attention, which a change of runner refuses: it is released first, and the whole answer is
    // undone when it has no backup to take.
    yield* releaseThread(stop.threadId);
    const reason = `Account ${yield* accountLabelOf(scope)} reached its budget`;
    const switched = yield* fallBackToBackup(stop.threadId, reason);
    if (!switched.followUps.isChanged) return yield* invalid("This thread has no backup Companion to switch to.");
    const others = (yield* heldThreadsOf(scope)).filter((thread) => thread.id !== stop.threadId);
    const now = yield* Clock.currentTimeMillis;
    if (others[0] === undefined)
      yield* sql`UPDATE budget_stops SET resolution = 'Switched', resolved_at = ${now} WHERE id = ${stopId}`;
    else yield* sql`UPDATE budget_stops SET thread_id = ${others[0].id} WHERE id = ${stopId}`;
    return switched;
  });

/**
 * The owner sets, changes, or removes a mission's budget: the line is recorded, then work stops if the
 * budget is now reached, or held threads are released: the halted turns are cancelled and the released
 * threads woken.
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
    const halted = (yield* isScopeReached({ _tag: "Mission", id: missionId }))
      ? yield* enforceBudgets(missionId, mission.topThreadId)
      : [];
    return changed(null, { threadsToWake: yield* releaseBudgets, turnsToCancel: halted });
  });

/**
 * After the global budget changed: work stops if it is reached, or held threads are released; the halted
 * turns are cancelled and the released threads woken.
 */
export const applyGlobalBudget = (before: BudgetLimits) =>
  Effect.gen(function* () {
    const global = yield* readGlobalBudget;
    const text = changeTextOf(before, global.limits);
    if (text !== null) yield* insertGlobalEvent(text.replace(/^Budget/, "Global budget"));
    const halted = (yield* isScopeReached({ _tag: "Global" })) ? yield* stopScope({ _tag: "Global" }, null) : [];
    return changed(null, { threadsToWake: yield* releaseBudgets, turnsToCancel: halted });
  });

/**
 * After an account's budget changed: its threads stop if it is now reached, or held threads are released; the halted
 * turns are cancelled and the released threads woken.
 */
export const applyAccountBudget = (scope: BudgetScope & { _tag: "Account" }) =>
  Effect.gen(function* () {
    const halted = (yield* isScopeReached(scope)) ? yield* stopScope(scope, null) : [];
    return changed(null, { threadsToWake: yield* releaseBudgets, turnsToCancel: halted });
  });

/** Records a new mission's budget, copied from the default, with its line. Callers run it in a transaction. */
export const applyDefaultBudget = (missionId: string, limits: BudgetLimits) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (isEmpty(limits)) return;
    yield* sql`UPDATE missions SET budget_cost = ${limits.cost}, budget_tokens = ${limits.tokens} WHERE id = ${missionId}`;
    yield* insertEvent(missionId, `Budget set: ${limitsTextOf(limits)}`);
  });
