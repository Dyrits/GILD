import type { BudgetLimits, BudgetPeriod, HarnessName, Spending } from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import {
  costText,
  isEmpty,
  isReached,
  limitsTextOf,
  missionLimitsOf,
  missionSpendingOf,
  nextStartOf,
  periodStartOf,
  reachedTextOf,
  readGlobalBudget,
  spendingColumns,
  tokenCountText,
  tokensText,
} from "../core/index.ts";
import { harnessLabels, ownAccountLabel } from "../harness/index.ts";

// The scopes a budget can cover (budget-control, Budgets): a mission's own, one provider account's, and the global
// one. Each scope says what it limits, what it has spent, which threads it stops, and how its stops are found, so
// the code that stops and releases work never tests for which kind it holds.

/** One budget's scope: a mission, a provider account, or everything. */
export type BudgetScope =
  | { readonly _tag: "Mission"; readonly id: string }
  | { readonly _tag: "Global" }
  | { readonly _tag: "Account"; readonly accountId: string | null; readonly harness: HarnessName };

/** A provider account: a harness with an added account's id, or null for its own sign-in on this computer. */
export interface AccountRef {
  readonly accountId: string | null;
  readonly harness: HarnessName;
}

/** The text an account is stored under in `budget_stops`: its harness and id, the id empty for the computer's own. */
export const accountKeyOf = (ref: AccountRef) => `${ref.harness}:${ref.accountId ?? ""}`;

/** The account a stored key names. */
export const accountOfKey = (key: string): AccountRef => {
  const colon = key.indexOf(":");
  const accountId = key.slice(colon + 1);
  return { accountId: accountId === "" ? null : accountId, harness: key.slice(0, colon) as HarnessName };
};

/** The account a thread runs on, or null when it no longer exists. */
export const accountOfThread = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ accountId: string | null; harness: HarnessName }>`
      SELECT harness, account_id AS accountId FROM threads WHERE id = ${threadId}`;
    return row === undefined ? null : ({ accountId: row.accountId, harness: row.harness } satisfies AccountRef);
  });

/** An account's name as the owner reads it, for example "Claude Code · Work" or "Claude Code · This computer". */
export const accountLabelOf = (ref: AccountRef) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (ref.accountId === null) return `${harnessLabels[ref.harness]} · ${ownAccountLabel}`;
    const [row] = yield* sql<{ label: string }>`SELECT label FROM accounts WHERE id = ${ref.accountId}`;
    return `${harnessLabels[ref.harness]} · ${row?.label ?? "Removed account"}`;
  });

/** What an account's budget holds, as stored. */
export interface AccountBudgetRow {
  readonly lastChange: string | null;
  readonly limits: BudgetLimits;
  readonly period: BudgetPeriod | null;
  readonly since: number;
}

/** An account's budget, or null when it has none. */
export const readAccountBudgetRow = (ref: AccountRef) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{
      cost: number | null;
      lastChange: string | null;
      period: BudgetPeriod | null;
      since: number;
      tokens: number | null;
    }>`SELECT cost, tokens, period, since, last_change AS lastChange FROM account_budgets
      WHERE harness = ${ref.harness} AND account_id = ${ref.accountId ?? ""}`;
    return row === undefined
      ? null
      : ({
          lastChange: row.lastChange,
          limits: { cost: row.cost, tokens: row.tokens },
          period: row.period,
          since: row.since,
        } satisfies AccountBudgetRow);
  });

/** When an account's counting began: its period's start, or the day its credits were bought. */
export const accountStartOf = (row: AccountBudgetRow, now: number) =>
  row.period === null ? row.since : periodStartOf(now, row.period);

/** What the account's own turns used since counting began, counted as every budget counts. */
export const accountSpendingOf = (ref: AccountRef, since: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<Spending>`
      SELECT ${sql.literal(spendingColumns)} FROM usage u
      WHERE u.harness = ${ref.harness} AND u.account_id IS ${ref.accountId} AND u.ended_at >= ${since}`;
    return row ?? { cost: 0, tokens: 0 };
  });

const noLimits: BudgetLimits = { cost: null, tokens: null };

/** A scope's limits and what is counted against them. */
export const budgetOf = (scope: BudgetScope) =>
  Effect.gen(function* () {
    if (scope._tag === "Mission")
      return { limits: yield* missionLimitsOf(scope.id), spent: yield* missionSpendingOf(scope.id) };
    if (scope._tag === "Global") {
      const global = yield* readGlobalBudget;
      return { limits: global.limits, spent: global.spent };
    }
    const row = yield* readAccountBudgetRow(scope);
    if (row === null) return { limits: noLimits, spent: { cost: 0, tokens: 0 } };
    const now = yield* Clock.currentTimeMillis;
    return { limits: row.limits, spent: yield* accountSpendingOf(scope, accountStartOf(row, now)) };
  });

/** Whether a scope's budget is reached; one with no limit never is. */
export const isScopeReached = (scope: BudgetScope) =>
  Effect.map(budgetOf(scope), ({ limits, spent }) => isReached(limits, spent));

/**
 * The scopes whose budget is reached over a mission and the account its thread runs on, in the order the owner meets
 * them: the mission's, the account's, then the global one.
 */
export const reachedScopesOf = (missionId: string, account: AccountRef | null) =>
  Effect.gen(function* () {
    const scopes: ReadonlyArray<BudgetScope> = [
      { _tag: "Mission", id: missionId },
      ...(account === null ? [] : [{ _tag: "Account", ...account } as const]),
      { _tag: "Global" },
    ];
    const reached: Array<BudgetScope> = [];
    for (const scope of scopes) if (yield* isScopeReached(scope)) reached.push(scope);
    return reached;
  });

/** The `budget_stops` rows of a scope; `prefix` names the table in a query, such as "s.". */
export const stopWhere = (sql: SqlClient.SqlClient, scope: BudgetScope, prefix = "") =>
  scope._tag === "Mission"
    ? sql`${sql.literal(`${prefix}mission_id`)} = ${scope.id}`
    : scope._tag === "Global"
      ? sql`${sql.literal(`${prefix}mission_id`)} IS NULL AND ${sql.literal(`${prefix}account_key`)} IS NULL`
      : sql`${sql.literal(`${prefix}account_key`)} = ${accountKeyOf(scope)}`;

/** The threads a scope covers, as a condition on the `threads` table. */
export const threadsWhere = (sql: SqlClient.SqlClient, scope: BudgetScope) =>
  scope._tag === "Mission"
    ? sql`mission_id = ${scope.id}`
    : scope._tag === "Global"
      ? sql`1 = 1`
      : sql`harness = ${scope.harness} AND account_id IS ${scope.accountId}`;

/** The scope a `budget_stops` row is about. */
export const scopeOfStop = (row: { accountKey: string | null; missionId: string | null }): BudgetScope =>
  row.accountKey !== null
    ? { _tag: "Account", ...accountOfKey(row.accountKey) }
    : row.missionId === null
      ? { _tag: "Global" }
      : { _tag: "Mission", id: row.missionId };

/** The account's scope when its budget is reached, as a list of at most one. */
const reachedAccountScopeOf = (account: AccountRef | null) =>
  Effect.gen(function* () {
    if (account === null) return [] as ReadonlyArray<BudgetScope>;
    const scope = { _tag: "Account", ...account } as const;
    return (yield* isScopeReached(scope)) ? ([scope] as ReadonlyArray<BudgetScope>) : [];
  });

/** The refusal for work under a reached budget, or null when none is reached. */
export const budgetRefusalOf = (
  missionId: string | null,
  account: AccountRef | null = null,
  only: BudgetScope["_tag"] | null = null,
) =>
  Effect.gen(function* () {
    const reached =
      missionId === null ? yield* reachedAccountScopeOf(account) : yield* reachedScopesOf(missionId, account);
    const [first] = only === null ? reached : reached.filter((scope) => scope._tag === only);
    if (first === undefined) return null;
    const whose = { Account: "The account's", Global: "The global", Mission: "The mission's" }[first._tag];
    return `${whose} budget is reached. Only the owner can raise it: wait, or tell the owner.`;
  });

/** The reached limits of a scope in words, for example "$5.00 of $5.00". */
export const reachedTextOfScope = (scope: BudgetScope) =>
  Effect.map(budgetOf(scope), ({ limits, spent }) => reachedTextOf(limits, spent));

// The one budget line a turn carries (budget-control, Seeing budget use and consumption).

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

/** A limit's share used, for example "40% of this month's tokens". */
const sharesOf = (limits: BudgetLimits, spent: Spending, words: string) =>
  [
    limits.cost === null ? null : `${percentOf(spent.cost, limits.cost)}% of ${words} cost`,
    limits.tokens === null ? null : `${percentOf(spent.tokens, limits.tokens)}% of ${words} tokens`,
  ].filter((part) => part !== null);

/** The one budget line a thread's turn context carries, or null with no budget at all. */
export const budgetLineOf = (missionId: string, account: AccountRef | null = null) =>
  Effect.gen(function* () {
    const limits = yield* missionLimitsOf(missionId);
    const global = yield* readGlobalBudget;
    const accountRow = account === null ? null : yield* readAccountBudgetRow(account);
    const accountLimits = accountRow?.limits ?? noLimits;
    if (isEmpty(limits) && isEmpty(global.limits) && isEmpty(accountLimits)) return null;
    const mission = isEmpty(limits)
      ? "no budget for this mission"
      : usesOf(limits, yield* missionSpendingOf(missionId)).join("; ");
    const globalParts = sharesOf(global.limits, global.spent, periodWords[global.period]);
    const accountParts =
      account === null || accountRow === null || isEmpty(accountLimits)
        ? []
        : sharesOf(
            accountLimits,
            yield* accountSpendingOf(account, accountStartOf(accountRow, yield* Clock.currentTimeMillis)),
            accountRow.period === null ? "the credit's" : periodWords[accountRow.period],
          );
    const accountName =
      accountParts.length === 0 || account === null ? "" : (yield* accountLabelOf(account)).split(" · ")[1];
    return `Budget: ${mission}${globalParts.length === 0 ? "" : `; global: ${globalParts.join(", ")}`}${accountParts.length === 0 ? "" : `; account ${accountName}: ${accountParts.join(", ")}`}. At a limit, Gild stops the work under it and asks the owner.`;
  });

/** The words for an account budget's limits, for the account's row. */
export const accountLimitsTextOf = (limits: BudgetLimits) => limitsTextOf(limits);

/** When an account's period starts over. */
export const accountNextStartOf = (row: AccountBudgetRow, now: number) =>
  row.period === null ? null : nextStartOf(now, row.period);
