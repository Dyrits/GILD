import type { AccountBudget, BudgetLimits, BudgetPeriod, HarnessName } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import {
  changeTextOf,
  consumptionColumns,
  costText,
  invalid,
  isEmpty,
  notFound,
  periodStartOf,
} from "../core/index.ts";
import { harnessNames, ownAccountLabel } from "../harness/index.ts";
import {
  type AccountRef,
  accountNextStartOf,
  accountSpendingOf,
  accountStartOf,
  readAccountBudgetRow,
} from "./budgetScopes.ts";
import { applyAccountBudget } from "./budgets.ts";
import { type ConsumptionRow, consumptionOf } from "./consumption.ts";
import { PlanLimits } from "./planLimits.ts";

// The owner's limits and credits on provider accounts (budget-control, Account budgets and credits). An account budget
// counts only what Iskios's own turns used on the account, and says so.

/** Refuses an account that does not exist or belongs to another harness. */
const checkRef = (ref: AccountRef) =>
  Effect.gen(function* () {
    if (ref.accountId === null) return;
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ harness: HarnessName }>`SELECT harness FROM accounts WHERE id = ${ref.accountId}`;
    if (row === undefined) return yield* notFound("No such account.");
    if (row.harness !== ref.harness) return yield* invalid("That account belongs to another harness.");
  });

const dayStartOf = (at: number) => {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/**
 * Sets, changes, or removes an account's budget. With a period it counts from the period's start; with none (credits)
 * from the start of the day `since` falls on, or today. Work on the account stops at once if the budget is reached.
 */
export const setAccountBudget = (
  ref: AccountRef,
  limits: BudgetLimits,
  period: BudgetPeriod | null,
  since: number | null,
) =>
  Effect.gen(function* () {
    yield* checkRef(ref);
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const before = yield* readAccountBudgetRow(ref);
    const key = ref.accountId ?? "";
    if (isEmpty(limits)) {
      yield* sql`DELETE FROM account_budgets WHERE harness = ${ref.harness} AND account_id = ${key}`;
    } else {
      const start = period === null ? dayStartOf(since ?? now) : periodStartOf(now, period);
      const text = changeTextOf(before?.limits ?? { cost: null, tokens: null }, limits) ?? before?.lastChange ?? null;
      yield* sql`INSERT INTO account_budgets (harness, account_id, cost, tokens, period, since, last_change)
        VALUES (${ref.harness}, ${key}, ${limits.cost}, ${limits.tokens}, ${period}, ${start}, ${text})
        ON CONFLICT (harness, account_id) DO UPDATE SET cost = excluded.cost, tokens = excluded.tokens,
          period = excluded.period, since = excluded.since, last_change = excluded.last_change`;
    }
    return yield* applyAccountBudget({ _tag: "Account", ...ref });
  });

/** Adds credit to an account's cost limit, which must have no period. */
export const addCredit = (ref: AccountRef, amount: number) =>
  Effect.gen(function* () {
    yield* checkRef(ref);
    const sql = yield* SqlClient.SqlClient;
    const row = yield* readAccountBudgetRow(ref);
    if (row === null || row.limits.cost === null || row.period !== null)
      return yield* invalid("Set credits on this account first: a cost limit with no period.");
    const total = Math.round((row.limits.cost + amount) * 100) / 100;
    yield* sql`UPDATE account_budgets SET cost = ${total}, last_change = ${`Credit added: ${costText(amount)}, ${costText(total)} in all`}
      WHERE harness = ${ref.harness} AND account_id = ${ref.accountId ?? ""}`;
    return yield* applyAccountBudget({ _tag: "Account", ...ref });
  });

const remainingOf = (limit: number | null, spent: number) => (limit === null ? null : Math.max(0, limit - spent));

/** Every provider account's use and budget: each harness's own sign-in, then the added accounts. */
export const readAccountBudgets = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const planLimits = yield* PlanLimits;
  const now = yield* Clock.currentTimeMillis;
  const added = yield* sql<{ harness: HarnessName; id: string; label: string }>`
    SELECT id, harness, label FROM accounts ORDER BY created_at`;
  const accounts = harnessNames.flatMap((harness) => [
    { accountId: null, harness, label: ownAccountLabel },
    ...added
      .filter((account) => account.harness === harness)
      .map((account) => ({ accountId: account.id, harness, label: account.label })),
  ]);
  return yield* Effect.forEach(accounts, (account) =>
    Effect.gen(function* () {
      const ref = { accountId: account.accountId, harness: account.harness } satisfies AccountRef;
      const row = yield* readAccountBudgetRow(ref);
      const since = row === null ? 0 : accountStartOf(row, now);
      const spent = yield* accountSpendingOf(ref, since);
      const [use] = yield* sql<ConsumptionRow>`
        SELECT ${sql.literal(consumptionColumns)} FROM usage u
        WHERE u.harness = ${ref.harness} AND u.account_id IS ${ref.accountId} AND u.ended_at >= ${since}`;
      const limits = row?.limits ?? { cost: null, tokens: null };
      return {
        accountId: account.accountId as AccountBudget["accountId"],
        consumption: consumptionOf(use as ConsumptionRow),
        harness: account.harness,
        label: account.label,
        lastChange: row?.lastChange ?? null,
        limits,
        nextStart: row === null ? null : accountNextStartOf(row, now),
        period: row?.period ?? null,
        planLimits: yield* planLimits.latest(ref),
        remaining: { cost: remainingOf(limits.cost, spent.cost), tokens: remainingOf(limits.tokens, spent.tokens) },
        since,
        spent,
      } satisfies AccountBudget;
    }),
  );
});
