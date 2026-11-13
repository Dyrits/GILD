import {
  BillingKind,
  maxUsageDays,
  type UsageBreakdown,
  type UsageDay,
  UsageDimension,
  type UsageFilter,
  type UsagePeriod,
  type UsageRecord,
  type UsageReport,
  type UsageRow,
} from "@iskios/contracts";
import { Clock, Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, isReportedColumn, knownCostColumn } from "../core/index.ts";
import { ownAccountLabelOf } from "../remote/index.ts";
import { readMessages, readTurnsWithoutUsage } from "./usageGaps.ts";
import { type AmountRow, amountColumns, amountsOf, compareRows, harnessOf, names, sumAmounts } from "./usageRows.ts";
import { boundsOf, keyOf, questJoinsOf, type UsageBounds, usageColumns, whereOf } from "./usageScope.ts";

// The Reserves usage page's read (budget-control, Reserves usage page): the turns of a period and filters, summed, divided
// by harness, model, realm, quest, account, and day, and listed. A realm is the quest's today, so moving a quest moves
// its earlier turns with it; the turns themselves keep the harness, model, and account they ran on.

/** The most turns the page lists; the rest are counted. */
const maxRecords = 100;

/** The most rows a breakdown keeps (the biggest first); a day-by-day breakdown keeps every day. */
const maxRows = 100;

const isBilling = Schema.is(BillingKind);

/** The usage rows of a read over `bounds` and `filters`. */
const scopeOf = (bounds: UsageBounds, filters: ReadonlyArray<UsageFilter>) => {
  const where = whereOf(bounds, usageColumns, filters);
  return {
    from: `FROM usage u ${questJoinsOf(usageColumns.mission)} LEFT JOIN threads th ON th.id = u.thread_id`,
    params: where.params,
    where: where.text,
  };
};

type Scope = ReturnType<typeof scopeOf>;

/** What the filtered turns used, in all. */
const readTotals = (scope: Scope) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql.unsafe<AmountRow & { emptyTokenTurns: number; quests: number; threads: number }>(
      `SELECT ${amountColumns}, COUNT(DISTINCT u.mission_id) AS quests, COUNT(DISTINCT u.thread_id) AS threads,
        COALESCE(SUM(CASE WHEN u.input + u.output + u.cache_read + u.cache_creation = 0 THEN 1 ELSE 0 END), 0) AS emptyTokenTurns
       ${scope.from} WHERE ${scope.where}`,
      scope.params,
    );
    if (row === undefined) return yield* Effect.die(new Error("An aggregate read returned no row."));
    return { amounts: amountsOf(row), emptyTokenTurns: row.emptyTokenTurns, quests: row.quests, threads: row.threads };
  });

/** What each harness used on each local day. */
const readDays = (scope: Scope, bounds: UsageBounds) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql.unsafe<AmountRow & { dayKey: string; harnessKey: string }>(
      `SELECT ${keyOf("Day", usageColumns)} AS dayKey, COALESCE(u.harness, '') AS harnessKey, ${amountColumns}
       ${scope.from} WHERE ${scope.where} GROUP BY 1, 2 ORDER BY 1, 2`,
      scope.params,
    );
    return bounds.days.map(
      (day): UsageDay => ({
        byHarness: rows
          .filter((row) => row.dayKey === day)
          .map((row) => ({
            amounts: amountsOf(row),
            harness: harnessOf(row.harnessKey === "" ? null : row.harnessKey),
          })),
        day,
      }),
    );
  });

/** One breakdown: the turns of `scope` grouped by `dimension`, biggest first. */
const readBreakdown = (scope: Scope, dimension: UsageDimension) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql.unsafe<AmountRow & { rowHarness: string | null; rowKey: string; rowName: string | null }>(
      `SELECT ${keyOf(dimension, usageColumns)} AS rowKey, MAX(${names[dimension]}) AS rowName,
        CASE WHEN COUNT(u.harness) = COUNT(*) AND MIN(u.harness) = MAX(u.harness) THEN MIN(u.harness) END AS rowHarness,
        ${amountColumns}
       ${scope.from} WHERE ${scope.where} GROUP BY 1`,
      scope.params,
    );
    // A harness's own sign-in has no account row to name it, so it carries the owner's name for it, else the computer's.
    const ownNames = new Map<string, string>();
    if (dimension === "Account") {
      for (const row of rows) {
        if (row.rowName === null && row.rowKey.endsWith("/")) {
          const harness = row.rowKey.slice(0, -1);
          ownNames.set(harness, yield* ownAccountLabelOf(harness));
        }
      }
    }
    const sorted = rows
      .map(
        (row): UsageRow => ({
          amounts: amountsOf(row),
          harness: harnessOf(row.rowHarness),
          key: row.rowKey,
          name: row.rowName ?? ownNames.get(row.rowKey.slice(0, -1)) ?? null,
        }),
      )
      .sort(compareRows(dimension));
    const limit = dimension === "Day" ? maxUsageDays : maxRows;
    return {
      dimension,
      hiddenRows: Math.max(0, sorted.length - limit),
      rows: sorted.slice(0, limit),
      total: sumAmounts(sorted.map((row) => row.amounts)),
    } satisfies UsageBreakdown;
  });

/** The turns behind the numbers, newest first. */
const readRecords = (scope: Scope) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql.unsafe<{
      billing: string | null;
      cacheCreation: number;
      cacheRead: number;
      cost: number | null;
      endedAt: number;
      harness: string | null;
      input: number;
      isReported: number;
      model: string | null;
      output: number;
      questName: string | null;
      threadTitle: string | null;
      turnId: string;
    }>(
      `SELECT u.turn_id AS turnId, u.ended_at AS endedAt, u.harness AS harness, u.model AS model, u.billing AS billing,
        u.input AS input, u.output AS output, u.cache_read AS cacheRead, u.cache_creation AS cacheCreation,
        ${knownCostColumn} AS cost, ${isReportedColumn} AS isReported,
        ${names.Quest} AS questName, th.title AS threadTitle
       ${scope.from} WHERE ${scope.where} ORDER BY u.ended_at DESC, u.turn_id LIMIT ${maxRecords}`,
      scope.params,
    );
    return rows.map(
      (row): UsageRecord => ({
        billing: row.billing !== null && isBilling(row.billing) ? row.billing : null,
        cost: row.cost,
        endedAt: row.endedAt,
        harness: harnessOf(row.harness),
        isReported: row.isReported === 1,
        model: row.model,
        questName: row.questName,
        threadTitle: row.threadTitle,
        tokens: { cacheCreation: row.cacheCreation, cacheRead: row.cacheRead, input: row.input, output: row.output },
        turnId: row.turnId,
      }),
    );
  });

/** When the first usage was recorded and the latest, over all time. */
const readSpan = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ startedAt: number | null; updatedAt: number | null }>`
    SELECT MIN(ended_at) AS startedAt, MAX(ended_at) AS updatedAt FROM usage`;
  return { startedAt: row?.startedAt ?? null, updatedAt: row?.updatedAt ?? null };
});

/**
 * The usage page's data for a period and the filters chosen in its breakdowns (budget-control, Reserves usage page).
 * The totals, the turn records, and the counts follow every filter. Each breakdown, and the graph for a day, leaves out
 * the filter on its own dimension, so the rows beside a chosen one stay in view to compare and to choose instead.
 * Refused for a range that is no date, runs backwards, or is longer than `maxUsageDays`.
 */
export const readUsage = (period: UsagePeriod, filters: ReadonlyArray<UsageFilter>) =>
  Effect.gen(function* () {
    const bounds = boundsOf(period, yield* Clock.currentTimeMillis);
    if (bounds === null)
      return yield* invalid(`A range of days runs from one day to a later one, up to ${maxUsageDays} days.`);
    const scope = scopeOf(bounds, filters);
    const totals = yield* readTotals(scope);
    const breakdowns: UsageBreakdown[] = [];
    for (const dimension of UsageDimension.literals) {
      const others = filters.filter((filter) => filter.dimension !== dimension);
      breakdowns.push(
        yield* readBreakdown(others.length === filters.length ? scope : scopeOf(bounds, others), dimension),
      );
    }
    const dayFilters = filters.filter((filter) => filter.dimension !== "Day");
    const records = yield* readRecords(scope);
    return {
      amounts: totals.amounts,
      breakdowns,
      days: yield* readDays(dayFilters.length === filters.length ? scope : scopeOf(bounds, dayFilters), bounds),
      gaps: {
        earlierTurns: totals.amounts.earlierTurns,
        emptyTokenTurns: totals.emptyTokenTurns,
        turnsWithoutUsage: yield* readTurnsWithoutUsage(bounds, filters),
        unpricedTurns: totals.amounts.unpricedTurns,
      },
      messages: yield* readMessages(bounds, filters),
      period: { firstDay: bounds.firstDay, from: bounds.from, lastDay: bounds.lastDay, to: bounds.to },
      quests: totals.quests,
      records: { hiddenCount: Math.max(0, totals.amounts.turns - records.length), rows: records },
      ...(yield* readSpan),
      threads: totals.threads,
    } satisfies UsageReport;
  });
