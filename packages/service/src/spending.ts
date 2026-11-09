import type { BudgetLimits, BudgetPeriod, Spending } from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { readSettings } from "./settings.ts";

// Budget control (budget-control specifications; work-in-progress Batch 11). A turn with a reported cost
// counts as API-key spending; one without counts its tokens, cache reads included, as subscription spending.

/** Tokens a usage row counts when it carries no cost. */
export const tokenSum = "CASE WHEN u.cost IS NULL THEN u.input + u.output + u.cache_read + u.cache_creation ELSE 0 END";

/** The cost and tokens columns summed over usage rows `u`. */
export const spendingColumns = `COALESCE(SUM(u.cost), 0) AS cost, COALESCE(SUM(${tokenSum}), 0) AS tokens`;

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
const nextStartOf = (now: number, period: BudgetPeriod) => {
  const date = new Date(periodStartOf(now, period));
  nextShifts[period](date);
  return date.getTime();
};

/** Whether a budget has neither limit. */
export const isEmpty = (limits: BudgetLimits) => limits.cost === null && limits.tokens === null;

/** Whether spending has reached either limit; an empty limit never is. */
export const isReached = (limits: BudgetLimits, spent: Spending) =>
  (limits.cost !== null && spent.cost >= limits.cost) || (limits.tokens !== null && spent.tokens >= limits.tokens);

const tokenCountText = (tokens: number) => Math.round(tokens).toLocaleString("en-US");
const tokensText = (tokens: number) => `${tokenCountText(tokens)} tokens`;
const costText = (cost: number) => `$${cost.toFixed(2)}`;

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

/** Which budgets over a mission are reached: its own, and the global one. */
export const reachedScopesOf = (missionId: string) =>
  Effect.gen(function* () {
    const global = yield* readGlobalBudget;
    return {
      isGlobal: isReached(global.limits, global.spent),
      isMission: isReached(yield* missionLimitsOf(missionId), yield* missionSpendingOf(missionId)),
    };
  });

/** The refusal for work under a reached budget, or null when none is reached. */
export const budgetRefusalOf = (missionId: string) =>
  Effect.gen(function* () {
    const reached = yield* reachedScopesOf(missionId);
    if (reached.isMission)
      return "The mission's budget is reached. Only the owner can raise it: wait, or tell the owner.";
    if (reached.isGlobal) return "The global budget is reached. Only the owner can raise it: wait, or tell the owner.";
    return null;
  });

const percentOf = (spent: number, limit: number) => Math.floor((spent / limit) * 100);

const usesOf = (limits: BudgetLimits, spent: Spending) =>
  [
    limits.cost === null
      ? null
      : `${costText(spent.cost)} of ${costText(limits.cost)} used (${percentOf(spent.cost, limits.cost)}%)`,
    limits.tokens === null
      ? null
      : `${tokenCountText(spent.tokens)} of ${tokensText(limits.tokens)} used (${percentOf(spent.tokens, limits.tokens)}%)`,
  ].filter((part) => part !== null);

const periodWords = { Day: "today's", Month: "this month's", Week: "this week's" } satisfies Record<
  BudgetPeriod,
  string
>;

/** The one budget line a thread's turn context carries, or null with no budget at all. */
export const budgetLineOf = (missionId: string) =>
  Effect.gen(function* () {
    const limits = yield* missionLimitsOf(missionId);
    const global = yield* readGlobalBudget;
    if (isEmpty(limits) && isEmpty(global.limits)) return null;
    const mission = isEmpty(limits)
      ? "no budget for this mission"
      : usesOf(limits, yield* missionSpendingOf(missionId)).join("; ");
    const words = periodWords[global.period];
    const globalParts = [
      global.limits.cost === null ? null : `${percentOf(global.spent.cost, global.limits.cost)}% of ${words} cost`,
      global.limits.tokens === null
        ? null
        : `${percentOf(global.spent.tokens, global.limits.tokens)}% of ${words} tokens`,
    ].filter((part) => part !== null);
    return `Budget: ${mission}${globalParts.length === 0 ? "" : `; global: ${globalParts.join(", ")}`}. At a limit, Gild stops the work under it and asks the owner.`;
  });
