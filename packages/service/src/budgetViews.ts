import type { BudgetEvent, BudgetPart, BudgetStop, BudgetWindow } from "@canopy/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { stopScopeOf } from "./budgets.ts";
import { notFound } from "./errors.ts";
import { missionLimitsOf, missionSpendingOf, readGlobalBudget, spendingColumns } from "./spending.ts";

// What the owner reads of budgets: open stops, budget lines, and the budget window (budget-control, Seeing use).

/** One part of a budget window's split: a thread or a mission, with what it spent. */
type PartRow = { id: string; title: string; cost: number; tokens: number };

const partsOf = (rows: ReadonlyArray<PartRow>) =>
  rows.map((row): BudgetPart => ({ id: row.id, spent: { cost: row.cost, tokens: row.tokens }, title: row.title }));

/** The stops with their mission titles, to filter. */
const selectStops = (sql: SqlClient.SqlClient) => sql`
  SELECT s.id, s.mission_id AS missionId, m.title AS missionTitle, s.reached_at AS reachedAt,
    CASE WHEN s.mission_id IS NULL THEN 'Global' ELSE 'Mission' END AS scope, s.thread_id AS threadId
  FROM budget_stops s LEFT JOIN missions m ON m.id = s.mission_id`;

/** The open stop in a mission's scope, or the global one with null. */
const readOpenStop = (missionId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [stop] = yield* sql<BudgetStop>`${selectStops(sql)}
      WHERE s.resolution IS NULL AND ${stopScopeOf(sql, missionId, "s.mission_id")}`;
    return stop ?? null;
  });

/** The open stop whose question the thread holds, mission or global. */
export const readHeldStop = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [stop] = yield* sql<BudgetStop>`${selectStops(sql)}
      WHERE s.resolution IS NULL AND s.thread_id = ${threadId} ORDER BY s.mission_id IS NULL`;
    return stop ?? null;
  });

/** The mission's budget lines, in order. */
export const listBudgetEvents = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<BudgetEvent>`SELECT id, text, at FROM budget_events WHERE mission_id = ${missionId} ORDER BY at, rowid`;
  });

/**
 * The budget window of a mission, split by thread, or the global one, split by mission; deleted threads
 * and missions keep their spending under one part each.
 */
export const readBudgetWindow = (missionId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (missionId === null) {
      const global = yield* readGlobalBudget;
      const parts = yield* sql<PartRow>`
        SELECT COALESCE(m.id, 'deleted') AS id, COALESCE(m.title, 'Deleted missions') AS title, ${sql.literal(spendingColumns)}
        FROM usage u LEFT JOIN missions m ON m.id = u.mission_id
        WHERE u.ended_at >= ${global.since} GROUP BY COALESCE(m.id, 'deleted') ORDER BY tokens DESC, cost DESC`;
      return {
        limits: global.limits,
        nextStart: global.nextStart,
        parts: partsOf(parts),
        period: global.period,
        periodStart: global.since,
        spent: global.spent,
        stop: yield* readOpenStop(null),
      } satisfies BudgetWindow;
    }
    const [mission] = yield* sql<{ id: string }>`SELECT id FROM missions WHERE id = ${missionId}`;
    if (mission === undefined) return yield* notFound("No such mission.");
    const parts = yield* sql<PartRow>`
      SELECT COALESCE(th.id, 'deleted') AS id, COALESCE(th.title, 'Deleted threads') AS title, ${sql.literal(spendingColumns)}
      FROM usage u LEFT JOIN threads th ON th.id = u.thread_id
      WHERE u.mission_id = ${missionId} GROUP BY COALESCE(th.id, 'deleted') ORDER BY tokens DESC, cost DESC`;
    return {
      limits: yield* missionLimitsOf(missionId),
      nextStart: null,
      parts: partsOf(parts),
      period: null,
      periodStart: null,
      spent: yield* missionSpendingOf(missionId),
      stop: yield* readOpenStop(missionId),
    } satisfies BudgetWindow;
  });
