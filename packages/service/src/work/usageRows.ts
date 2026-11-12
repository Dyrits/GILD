import { HarnessName, type UsageAmounts, type UsageDimension, type UsageRow } from "@iskios/contracts";
import { Schema } from "effect";
import { consumptionColumns, pricedTurnsColumn } from "../core/index.ts";
import { type ConsumptionRow, consumptionOf } from "./consumption.ts";

// How the usage page shapes the turns it reads (budget-control, Reserves usage page): the columns that sum them, the names
// the owner gave, and the order of a breakdown's rows.

const isHarness = Schema.is(HarnessName);

/** A harness read from storage, or null for a turn recorded before harnesses were. */
export const harnessOf = (value: string | null) => (value !== null && isHarness(value) ? value : null);

/** The columns of `amountColumns`, as a row. */
export interface AmountRow extends ConsumptionRow {
  readonly pricedTurns: number;
}

/** What a set of turns used: `consumptionColumns` and the turns that have a price. */
export const amountColumns = `${consumptionColumns}, ${pricedTurnsColumn}`;

/** What a row of `amountColumns` says. */
export const amountsOf = (row: AmountRow): UsageAmounts => ({ ...consumptionOf(row), pricedTurns: row.pricedTurns });

/** What no turn used. */
const noAmounts: UsageAmounts = {
  earlierTurns: 0,
  estimated: 0,
  pricedTurns: 0,
  reported: 0,
  tokens: { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 },
  turns: 0,
  unpricedTurns: 0,
};

/** What several sets of turns used together. */
export const sumAmounts = (all: ReadonlyArray<UsageAmounts>): UsageAmounts =>
  all.reduce(
    (sum, amounts) => ({
      earlierTurns: sum.earlierTurns + amounts.earlierTurns,
      estimated: sum.estimated + amounts.estimated,
      pricedTurns: sum.pricedTurns + amounts.pricedTurns,
      reported: sum.reported + amounts.reported,
      tokens: {
        cacheCreation: sum.tokens.cacheCreation + amounts.tokens.cacheCreation,
        cacheRead: sum.tokens.cacheRead + amounts.tokens.cacheRead,
        input: sum.tokens.input + amounts.tokens.input,
        output: sum.tokens.output + amounts.tokens.output,
      },
      turns: sum.turns + amounts.turns,
      unpricedTurns: sum.unpricedTurns + amounts.unpricedTurns,
    }),
    noAmounts,
  );

/** The tokens a row counts on the page: those without cache reads, as the page's totals define them. */
const ownTokensOf = (amounts: UsageAmounts) =>
  amounts.tokens.input + amounts.tokens.output + amounts.tokens.cacheCreation;

/** The known cost of a row, or null when none of its turns has a price: no price is not a price of zero. */
const costOf = (amounts: UsageAmounts) => (amounts.pricedTurns === 0 ? null : amounts.reported + amounts.estimated);

/** Iskios's own quest, in the owner's words. */
const iskiosName = "Iskios (assistant)";

/** The names a breakdown row gets from the owner's own words. */
export const names = {
  Account: "(SELECT a.label FROM accounts a WHERE a.id = u.account_id)",
  Day: "NULL",
  Harness: "NULL",
  Model: "NULL",
  Quest: `CASE WHEN mi.is_guildmaster = 1 THEN '${iskiosName}' ELSE mi.title END`,
  Realm: `CASE WHEN mi.id IS NULL THEN NULL WHEN mi.is_guildmaster = 1 THEN '${iskiosName}' ELSE w.name END`,
} satisfies Record<UsageDimension, string>;

/** Biggest first: rows with a price by cost, then rows with none by tokens; days newest first. */
export const compareRows = (dimension: UsageDimension) => (left: UsageRow, right: UsageRow) => {
  if (dimension === "Day") return right.key.localeCompare(left.key);
  const [leftCost, rightCost] = [costOf(left.amounts), costOf(right.amounts)];
  if (leftCost !== null && rightCost !== null && leftCost !== rightCost) return rightCost - leftCost;
  if ((leftCost === null) !== (rightCost === null)) return leftCost === null ? 1 : -1;
  return ownTokensOf(right.amounts) - ownTokensOf(left.amounts) || left.key.localeCompare(right.key);
};
