import type { AccountId, BudgetEvent, BudgetPart, BudgetStop, BudgetWindow, HarnessName } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient, type Statement } from "effect/sql";
import {
  consumptionColumns,
  missionLimitsOf,
  missionSpendingOf,
  notFound,
  readGlobalBudget,
  spendingColumns,
} from "../core/index.ts";
import { harnessLabels } from "../harness/index.ts";
import { accountLabelOf, accountOfKey, type BudgetScope, stopWhere } from "./budgetScopes.ts";
import { type ConsumptionRow, consumptionOf } from "./consumption.ts";

// What the owner reads of budgets: open stops, budget lines, and the budget window (budget-control, Seeing use).

/** One part of a budget window's split: a thread or a mission, with what it spent. */
type PartRow = ConsumptionRow & { id: string; title: string; cost: number; tokens: number };

const partsOf = (rows: ReadonlyArray<PartRow>) =>
  rows.map(
    (row): BudgetPart => ({
      consumption: consumptionOf(row),
      id: row.id,
      spent: { cost: row.cost, tokens: row.tokens },
      title: row.title,
    }),
  );

/** The name shown for turns recorded before their harness and model were. */
const earlierTurnsTitle = "Earlier turns";

/** The use of the usage rows `where` selects, split by the harness each turn ran on and then by its model. */
const splitsOf = (where: Statement.Fragment) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const byHarness = yield* sql<PartRow>`
      SELECT COALESCE(u.harness, '') AS id, '' AS title, ${sql.literal(spendingColumns)}, ${sql.literal(consumptionColumns)}
      FROM usage u WHERE ${where} GROUP BY COALESCE(u.harness, '') ORDER BY tokens DESC, cost DESC`;
    const byModel = yield* sql<PartRow>`
      SELECT COALESCE(u.model, '') AS id, '' AS title, ${sql.literal(spendingColumns)}, ${sql.literal(consumptionColumns)}
      FROM usage u WHERE ${where} GROUP BY COALESCE(u.model, '') ORDER BY tokens DESC, cost DESC`;
    const total = yield* sql<ConsumptionRow>`SELECT ${sql.literal(consumptionColumns)} FROM usage u WHERE ${where}`;
    return {
      byHarness: partsOf(
        byHarness.map((row) => ({
          ...row,
          title: Object.hasOwn(harnessLabels, row.id) ? harnessLabels[row.id as HarnessName] : earlierTurnsTitle,
        })),
      ),
      byModel: partsOf(byModel.map((row) => ({ ...row, title: row.id === "" ? earlierTurnsTitle : row.id }))),
      consumption: consumptionOf(total[0] as ConsumptionRow),
    };
  });

/** The stops with their mission titles, to filter. */
const selectStops = (sql: SqlClient.SqlClient) => sql`
  SELECT s.id, s.mission_id AS missionId, m.title AS missionTitle, s.reached_at AS reachedAt, s.account_key AS accountKey,
    CASE WHEN s.account_key IS NOT NULL THEN 'Account' WHEN s.mission_id IS NULL THEN 'Global' ELSE 'Mission' END AS scope,
    s.thread_id AS threadId
  FROM budget_stops s LEFT JOIN missions m ON m.id = s.mission_id`;

type StopRow = Omit<BudgetStop, "account" | "accountLabel"> & { accountKey: string | null };

/** A stop as the owner reads it, an account's named. */
const stopOf = ({ accountKey, ...row }: StopRow) =>
  Effect.gen(function* () {
    const account = accountKey === null ? null : accountOfKey(accountKey);
    return {
      ...row,
      account: account === null ? null : { accountId: account.accountId as AccountId | null, harness: account.harness },
      accountLabel: account === null ? null : yield* accountLabelOf(account),
    } satisfies BudgetStop;
  });

/** The open stop in a scope. */
const readOpenStop = (scope: BudgetScope) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [stop] = yield* sql<StopRow>`${selectStops(sql)}
      WHERE s.resolution IS NULL AND ${stopWhere(sql, scope, "s.")}`;
    return stop === undefined ? null : yield* stopOf(stop);
  });

/** The open stop whose question the thread holds: its mission's first, then its account's, then the global one. */
export const readHeldStop = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [stop] = yield* sql<StopRow>`${selectStops(sql)}
      WHERE s.resolution IS NULL AND s.thread_id = ${threadId}
      ORDER BY CASE WHEN s.mission_id IS NOT NULL THEN 0 WHEN s.account_key IS NOT NULL THEN 1 ELSE 2 END`;
    return stop === undefined ? null : yield* stopOf(stop);
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
        SELECT COALESCE(m.id, 'deleted') AS id, COALESCE(m.title, 'Deleted missions') AS title, ${sql.literal(spendingColumns)},
          ${sql.literal(consumptionColumns)}
        FROM usage u LEFT JOIN missions m ON m.id = u.mission_id
        WHERE u.ended_at >= ${global.since} GROUP BY COALESCE(m.id, 'deleted') ORDER BY tokens DESC, cost DESC`;
      return {
        ...(yield* splitsOf(sql`u.ended_at >= ${global.since}`)),
        limits: global.limits,
        nextStart: global.nextStart,
        parts: partsOf(parts),
        period: global.period,
        periodStart: global.since,
        spent: global.spent,
        stop: yield* readOpenStop({ _tag: "Global" }),
      } satisfies BudgetWindow;
    }
    const [mission] = yield* sql<{ id: string }>`SELECT id FROM missions WHERE id = ${missionId}`;
    if (mission === undefined) return yield* notFound("No such mission.");
    const parts = yield* sql<PartRow>`
      SELECT COALESCE(th.id, 'deleted') AS id, COALESCE(th.title, 'Deleted threads') AS title, ${sql.literal(spendingColumns)},
        ${sql.literal(consumptionColumns)}
      FROM usage u LEFT JOIN threads th ON th.id = u.thread_id
      WHERE u.mission_id = ${missionId} GROUP BY COALESCE(th.id, 'deleted') ORDER BY tokens DESC, cost DESC`;
    return {
      ...(yield* splitsOf(sql`u.mission_id = ${missionId}`)),
      limits: yield* missionLimitsOf(missionId),
      nextStart: null,
      parts: partsOf(parts),
      period: null,
      periodStart: null,
      spent: yield* missionSpendingOf(missionId),
      stop: yield* readOpenStop({ _tag: "Mission", id: missionId }),
    } satisfies BudgetWindow;
  });
