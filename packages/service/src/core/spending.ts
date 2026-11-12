import type { BudgetLimits, BudgetPeriod, Spending } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { readSettings } from "./settings.ts";

// Budget control (budget-control specifications; work-in-progress Batch 11). A turn counts toward one unit, chosen by its
// billing kind: an API-key turn counts its reported cost, every other turn counts its tokens, cache reads included.
// A turn recorded before billing kinds (billing NULL) counts as it always did, by whether it has a cost.

/** Whether usage row `u` counts toward the cost unit: an API-key turn, or an earlier one that reported a cost. */
const isApiKey = "COALESCE(u.billing, CASE WHEN u.cost IS NULL THEN 'Subscription' ELSE 'ApiKey' END) = 'ApiKey'";

/** Tokens a usage row counts: those of every turn that is not API-key. */
export const tokenSum = `CASE WHEN ${isApiKey} THEN 0 ELSE u.input + u.output + u.cache_read + u.cache_creation END`;

/** The cost a usage row counts: an API-key turn's reported cost, or its estimate when the harness reported none. */
export const costSum = `CASE WHEN ${isApiKey} THEN COALESCE(u.cost, u.estimate, 0) ELSE 0 END`;

/** The cost and tokens columns summed over usage rows `u`. */
export const spendingColumns = `COALESCE(SUM(${costSum}), 0) AS cost, COALESCE(SUM(${tokenSum}), 0) AS tokens`;

/** Whether usage row `u` carries a cost its harness reported on an API-key turn, which is shown as reported. */
export const isReportedColumn = `(${isApiKey} AND u.cost IS NOT NULL)`;

/**
 * The columns of what usage rows `u` used, shown rather than counted (budget-control, Estimated cost): `reported`
 * is the cost of API-key turns, `estimated` the estimate of every other turn, `unpricedTurns` the turns since
 * estimates began with neither, and `earlierTurns` those recorded before billing kinds.
 */
export const consumptionColumns = `COUNT(u.turn_id) AS turns,
  COALESCE(SUM(u.input), 0) AS input, COALESCE(SUM(u.output), 0) AS output,
  COALESCE(SUM(u.cache_read), 0) AS cacheRead, COALESCE(SUM(u.cache_creation), 0) AS cacheCreation,
  COALESCE(SUM(CASE WHEN ${isReportedColumn} THEN u.cost ELSE 0 END), 0) AS reported,
  COALESCE(SUM(CASE WHEN ${isReportedColumn} THEN 0 ELSE COALESCE(u.estimate, 0) END), 0) AS estimated,
  COALESCE(SUM(CASE WHEN u.billing IS NOT NULL AND NOT ${isReportedColumn} AND u.estimate IS NULL THEN 1 ELSE 0 END), 0) AS unpricedTurns,
  COALESCE(SUM(CASE WHEN u.turn_id IS NOT NULL AND u.billing IS NULL AND NOT ${isReportedColumn} THEN 1 ELSE 0 END), 0) AS earlierTurns`;

/** The cost of usage row `u` when it has a price (the harness's reported cost on an API-key turn, else its estimate), else NULL. */
export const knownCostColumn = `CASE WHEN ${isReportedColumn} THEN u.cost ELSE u.estimate END`;

/** The turns of usage rows `u` that have a price, to tell a known zero from no price at all. */
export const pricedTurnsColumn = `COALESCE(SUM(CASE WHEN ${knownCostColumn} IS NOT NULL THEN 1 ELSE 0 END), 0) AS pricedTurns`;

/** A budget with neither limit. */
const noLimits: BudgetLimits = { cost: null, tokens: null };

const startShifts = {
  Day: () => void 0,
  Month: (date: Date) => {
    date.setDate(1);
  },
  Week: (date: Date) => {
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  },
} satisfies Record<BudgetPeriod, (date: Date) => void>;

const nextShifts = {
  Day: (date: Date) => date.setDate(date.getDate() + 1),
  Month: (date: Date) => date.setMonth(date.getMonth() + 1),
  Week: (date: Date) => date.setDate(date.getDate() + 7),
} satisfies Record<BudgetPeriod, (date: Date) => void>;

/** When the global period holding `now` started: local midnight, on Monday for a week, on the 1st for a month. */
export const periodStartOf = (now: number, period: BudgetPeriod) => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  startShifts[period](date);
  return date.getTime();
};

/** When the global period holding `now` starts over. */
export const nextStartOf = (now: number, period: BudgetPeriod) => {
  const date = new Date(periodStartOf(now, period));
  nextShifts[period](date);
  return date.getTime();
};

/** Whether a budget has neither limit. */
export const isEmpty = (limits: BudgetLimits) => limits.cost === null && limits.tokens === null;

/** Whether spending has reached either limit; an empty limit never is. */
export const isReached = (limits: BudgetLimits, spent: Spending) =>
  (limits.cost !== null && spent.cost >= limits.cost) || (limits.tokens !== null && spent.tokens >= limits.tokens);

export const tokenCountText = (tokens: number) => Math.round(tokens).toLocaleString("en-US");
export const tokensText = (tokens: number) => `${tokenCountText(tokens)} tokens`;
export const costText = (cost: number) => `$${cost.toFixed(2)}`;

/** A budget's limits in words, for example "$5.00 and 50,000 tokens". */
export const limitsTextOf = (limits: BudgetLimits) =>
  [limits.cost === null ? null : costText(limits.cost), limits.tokens === null ? null : tokensText(limits.tokens)]
    .filter((part) => part !== null)
    .join(" and ");

const rankOf = (limit: number | null) => limit ?? Number.POSITIVE_INFINITY;

/** The line a budget change leaves, or null when nothing changed. */
export const changeTextOf = (before: BudgetLimits, after: BudgetLimits) => {
  if (before.cost === after.cost && before.tokens === after.tokens) return null;
  if (isEmpty(after)) return "Budget removed";
  if (isEmpty(before)) return `Budget set: ${limitsTextOf(after)}`;
  const pairs = [
    [before.cost, after.cost],
    [before.tokens, after.tokens],
  ] as const;
  if (pairs.every(([was, now]) => rankOf(now) >= rankOf(was))) return `Budget raised to ${limitsTextOf(after)}`;
  if (pairs.every(([was, now]) => rankOf(now) <= rankOf(was))) return `Budget lowered to ${limitsTextOf(after)}`;
  return `Budget changed to ${limitsTextOf(after)}`;
};

/** The reached limits in words, for example "100 of 100 tokens". */
export const reachedTextOf = (limits: BudgetLimits, spent: Spending) =>
  [
    limits.cost !== null && spent.cost >= limits.cost ? `${costText(spent.cost)} of ${costText(limits.cost)}` : null,
    limits.tokens !== null && spent.tokens >= limits.tokens
      ? `${tokenCountText(spent.tokens)} of ${tokensText(limits.tokens)}`
      : null,
  ]
    .filter((part) => part !== null)
    .join(" and ");

/** A mission's limits. */
export const missionLimitsOf = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ cost: number | null; tokens: number | null }>`
      SELECT budget_cost AS cost, budget_tokens AS tokens FROM missions WHERE id = ${missionId}`;
    return row === undefined ? noLimits : ({ cost: row.cost, tokens: row.tokens } satisfies BudgetLimits);
  });

/** What a mission spent over its whole life. */
export const missionSpendingOf = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<Spending>`
      SELECT ${sql.literal(spendingColumns)} FROM usage u WHERE u.mission_id = ${missionId}`;
    return row ?? { cost: 0, tokens: 0 };
  });

/** The global budget, its period, and what all missions spent since the period started. */
export const readGlobalBudget = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const settings = yield* readSettings;
  const now = yield* Clock.currentTimeMillis;
  const since = periodStartOf(now, settings.globalBudgetPeriod);
  const [row] = yield* sql<Spending>`
    SELECT ${sql.literal(spendingColumns)} FROM usage u WHERE u.ended_at >= ${since}`;
  return {
    limits: settings.globalBudget,
    nextStart: nextStartOf(now, settings.globalBudgetPeriod),
    period: settings.globalBudgetPeriod,
    since,
    spent: row ?? { cost: 0, tokens: 0 },
  };
});
