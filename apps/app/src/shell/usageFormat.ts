import type { TokenUsage, UsageAmounts, UsageRow } from "@iskios/contracts";

// How the usage page writes its numbers (budget-control, Reserves usage page): amounts shortened for reading, costs marked as
// reported, estimated, or unavailable, and shares among the known amounts of a breakdown.

/** What the graph and the shares measure. */
export type UsageMetric = "Cost" | "Tokens";

/** What each metric is called in a sentence. */
export const metricNames = { Cost: "cost", Tokens: "tokens" } as const satisfies Record<UsageMetric, string>;

/** What no turn used. */
export const emptyAmounts: UsageAmounts = {
  earlierTurns: 0,
  estimated: 0,
  pricedTurns: 0,
  reported: 0,
  tokens: { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 },
  turns: 0,
  unpricedTurns: 0,
};

/** The tokens a total shows: those without cache reads, those processed with them, and the parts. */
export const tokenTotalsOf = (tokens: TokenUsage) => {
  const withoutCacheReads = tokens.input + tokens.output + tokens.cacheCreation;
  return {
    cacheCreation: tokens.cacheCreation,
    cachedInput: tokens.cacheRead,
    output: tokens.output,
    processed: withoutCacheReads + tokens.cacheRead,
    uncachedInput: tokens.input,
    withoutCacheReads,
  };
};

/** The tokens without cache reads of a set of turns, which is what the page's token columns and shares count. */
export const ownTokensOf = (amounts: UsageAmounts) => tokenTotalsOf(amounts.tokens).withoutCacheReads;

/** A count shortened for reading, such as `25.08M`; its exact value belongs in the element's accessible label. */
export const compactCountOf = (count: number): string => {
  const units = [
    { at: 1e9, suffix: "B" },
    { at: 1e6, suffix: "M" },
    { at: 1e3, suffix: "K" },
  ] as const;
  const unit = units.find(({ at }) => Math.abs(count) >= at);
  if (unit === undefined) return String(Math.round(count));
  const shortened = (count / unit.at).toFixed(2);
  // 999,999 rounds to 1000.00K: it reads as 1.00M.
  if (Number(shortened) >= 1000 && unit.suffix !== "B") return compactCountOf(unit.at * 1000);
  return `${shortened}${unit.suffix}`;
};

/** A count with thousands separators, for an element's accessible label. */
export const exactCountOf = (count: number) => Math.round(count).toLocaleString("en-US");

/** The known cost of a set of turns: null when it has turns and none has a price, which is not a price of zero. */
const knownCostOf = (amounts: UsageAmounts) =>
  amounts.turns > 0 && amounts.pricedTurns === 0 ? null : amounts.reported + amounts.estimated;

/** What the graph and shares count for a set of turns, or null when it has no known cost. */
export const metricValueOf = (amounts: UsageAmounts, metric: UsageMetric) =>
  metric === "Tokens" ? ownTokensOf(amounts) : knownCostOf(amounts);

/** A cost in dollars, marked ≈ when estimated; under half a cent it does not read as nothing. */
export const dollarsTextOf = (cost: number, isEstimate: boolean) =>
  `${isEstimate ? "≈ " : ""}${cost > 0 && cost < 0.005 ? "< $0.01" : `$${cost.toFixed(2)}`}`;

/**
 * A set of turns' cost as the owner should read it: `$1.20` as the harness reported it, `≈ $1.20` when any of it is
 * estimated, "Unavailable" for turns with no price, and "No usage" for none, which is not a known zero.
 */
export const usageCostTextOf = (amounts: UsageAmounts) => {
  if (amounts.turns === 0) return "No usage";
  const cost = knownCostOf(amounts);
  return cost === null ? "Unavailable" : dollarsTextOf(cost, amounts.estimated > 0);
};

/** Where a total's cost comes from, for the line under it; null when no cost is known to come from anywhere. */
export const costBasisOf = (amounts: UsageAmounts) => {
  if (amounts.pricedTurns === 0) return null;
  if (amounts.reported > 0 && amounts.estimated > 0) return "Reported and estimated";
  return amounts.reported > 0 ? "Reported" : "API estimate";
};

/** A row's share of its breakdown's total, among the known amounts; "Unavailable" for a row with none. */
export const shareTextOf = (row: UsageRow, total: UsageAmounts, metric: UsageMetric) => {
  const value = metricValueOf(row.amounts, metric);
  if (value === null) return "Unavailable";
  const whole = metricValueOf(total, metric) ?? 0;
  const share = whole > 0 ? (value / whole) * 100 : 0;
  return share > 0 && share < 0.1 ? "< 0.1%" : `${share.toFixed(1)}%`;
};

/** The line under a harness: its share of the known cost (or of the tokens) and its tokens; "No known cost" for turns with no price. */
export const shareCaptionOf = (row: UsageRow, total: UsageAmounts, metric: UsageMetric) => {
  const tokens = `${compactCountOf(ownTokensOf(row.amounts))} tokens`;
  const share = shareTextOf(row, total, metric);
  if (share === "Unavailable") return `No known cost · ${tokens}`;
  return `${share} of ${metric === "Cost" ? "known cost" : "tokens"} · ${tokens}`;
};

/** A value on the graph's value axis. */
export const axisTextOf = (value: number, metric: UsageMetric) =>
  metric === "Cost" ? `$${value.toFixed(2)}` : compactCountOf(value);

/** When collection started, as a date. */
export const startedTextOf = (millis: number) => new Date(millis).toLocaleDateString("en-US");

/** When the usage was last updated, as a date and time. */
export const updatedTextOf = (millis: number) => new Date(millis).toLocaleString("en-US");
