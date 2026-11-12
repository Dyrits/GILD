import {
  type AccountBudget,
  type BillingKind,
  type BudgetWindow,
  deletedRealmKey,
  type HarnessName,
  type UsageDay,
  type UsageDimension,
  type UsageFilter,
  type UsageGaps,
  type UsageRecord,
  type UsageRow,
} from "@iskios/contracts";
import { harnessLabels, modelLabelOf } from "../foundation/formatting";
import {
  accountBudgetTextOf,
  budgetUseTextOf,
  countedOf,
  meterLevelOf,
  planLimitsSummaryOf,
} from "../foundation/labels";
import { axisTextOf, metricValueOf, type UsageMetric } from "./usageFormat";

// The words of the usage page (budget-control, Reserves usage page): what its rows, chips, days, turns, notice, and
// allowances are called.

/** What a row or a chip says when the usage did not record it. */
const unrecorded = "Not recorded";

/** What each breakdown is called: the owner's terms, with the model as the Companion. */
export const dimensionNames = {
  Account: "Account",
  Day: "Day",
  Harness: "Harness",
  Model: "Companion (model)",
  Quest: "Quest",
  Realm: "Realm",
} as const satisfies Record<UsageDimension, string>;

/** A harness's name, or "Not recorded" for turns from before harnesses were recorded. */
export const harnessNameOf = (harness: HarnessName | null) => (harness === null ? unrecorded : harnessLabels[harness]);

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** A day as its month and day, such as "Nov 6". */
export const dayLabelOf = (day: string) => {
  const [, month, date] = day.split("-").map(Number);
  return `${months[(month ?? 1) - 1] ?? ""} ${date ?? ""}`;
};

const isHarnessKey = (key: string): key is HarnessName => Object.hasOwn(harnessLabels, key);

/** An account row's name: its harness and the account's own name, or "This computer" for the harness's own sign-in. */
const accountLabelOf = (row: UsageRow) => {
  const [harness = "", account = ""] = row.key.split("/");
  if (row.key === "" || !isHarnessKey(harness)) return unrecorded;
  return `${harnessLabels[harness]} · ${account === "" ? "This computer" : (row.name ?? "Account")}`;
};

/** A realm row's name: the Borderlands for the empty key; Iskios's own quests carry their name from the service. */
const realmLabelOf = (row: UsageRow) => {
  if (row.key === "") return "Borderlands";
  if (row.key === deletedRealmKey) return "Deleted quests";
  return row.name ?? "Realm";
};

/** Each dimension's way of naming a row. */
const rowLabels = {
  Account: accountLabelOf,
  Day: (row) => dayLabelOf(row.key),
  Harness: (row) => (isHarnessKey(row.key) ? harnessLabels[row.key] : unrecorded),
  Model: (row) => (row.key === "" ? unrecorded : modelLabelOf(row.key)),
  Quest: (row) => row.name ?? "Deleted quest",
  Realm: realmLabelOf,
} satisfies Record<UsageDimension, (row: UsageRow) => string>;

/** A row's name as the owner reads it. */
export const rowLabelOf = (dimension: UsageDimension, row: UsageRow): string => rowLabels[dimension](row);

/** A filter with the row's name when it was chosen, so its chip names it even when the period leaves the row without usage. */
export interface ChosenFilter extends UsageFilter {
  readonly label: string;
}

/** A chosen filter's chip: its dimension and the row. */
export const filterTextOf = (filter: ChosenFilter) => `${dimensionNames[filter.dimension]}: ${filter.label}`;

/** Whether a row's filter is among the chosen ones. */
export const isFilterChosen = (chosen: ReadonlyArray<UsageFilter>, filter: UsageFilter) =>
  chosen.some((candidate) => candidate.dimension === filter.dimension && candidate.key === filter.key);

/** The words for turns that count as records with no cost estimate, an unreported count, or the like. */
const recordsOf = (count: number, rest: string) =>
  `${countedOf(count, "record")} ${count === 1 ? rest : rest.replace(/^has/, "have")}`;

/** The partial-data notice, or null when nothing is missing; known totals may understate what was used. */
export const noticeOf = (gaps: UsageGaps) => {
  const unpriced = gaps.unpricedTurns + gaps.earlierTurns;
  const parts = [
    ...(gaps.turnsWithoutUsage === null
      ? ["turns without usage cannot be counted for the selected harness, model, or account"]
      : gaps.turnsWithoutUsage > 0
        ? [
            `${countedOf(gaps.turnsWithoutUsage, "turn")} ${gaps.turnsWithoutUsage === 1 ? "has" : "have"} no reported usage`,
          ]
        : []),
    ...(unpriced > 0 ? [recordsOf(unpriced, "has no cost estimate")] : []),
    ...(gaps.emptyTokenTurns > 0 ? [recordsOf(gaps.emptyTokenTurns, "has incomplete token data")] : []),
  ];
  if (parts.length === 0) return null;
  const isOnlyUnknown = parts.length === 1 && gaps.turnsWithoutUsage === null;
  return `Partial data · ${parts.join("; ")}.${isOnlyUnknown ? "" : " Known totals may understate actual use."}`;
};

/**
 * What a day of the graph says to someone who cannot see it: what each harness used, and where turns have no known cost
 * (`hasGap`), which a day with no usage at all does not have.
 */
export const dayCaptionOf = (day: UsageDay, metric: UsageMetric) => {
  const entries = day.byHarness.map((entry) => ({
    name: harnessNameOf(entry.harness),
    value: metricValueOf(entry.amounts, metric),
  }));
  if (entries.length === 0) return { hasGap: false, text: `${dayLabelOf(day.day)}: no usage` };
  const parts = entries.map((entry) =>
    entry.value === null ? `${entry.name} no known cost` : `${entry.name} ${axisTextOf(entry.value, metric)}`,
  );
  return { hasGap: entries.some((entry) => entry.value === null), text: `${dayLabelOf(day.day)}: ${parts.join(", ")}` };
};

/** How each billing kind reads. */
const billingNames = {
  ApiKey: "API key",
  Subscription: "Subscription",
  Unknown: "Billing unknown",
} as const satisfies Record<BillingKind, string>;

/** The line under a turn record: its harness and model, how it was billed, and which model has no price when it has no cost. */
export const recordDetailOf = (record: UsageRecord) => {
  const model = record.model === null ? null : modelLabelOf(record.model);
  return [
    record.harness === null ? null : harnessLabels[record.harness],
    model,
    record.billing === null ? null : billingNames[record.billing],
    record.cost === null && model !== null ? `no price for ${model}` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
};

/** One allowance of the page: a budget's use, or an account's budget and plan limits. */
export interface AllowanceLine {
  readonly key: string;
  readonly level: "normal" | "warning" | "reached";
  readonly name: string;
  readonly text: string;
}

/**
 * What the owner still has beside what was used (budget-control, Seeing budget use and consumption; Plan limits): each
 * limit of the global budget, and each account's budget and plan limits as its harness reports them. A limit never
 * reported is never guessed. `isGlobalBudgetSet` is null until the global budget is read.
 */
export const allowanceLinesOf = (
  global: BudgetWindow | null,
  accounts: ReadonlyArray<AccountBudget>,
): { readonly isGlobalBudgetSet: boolean | null; readonly lines: ReadonlyArray<AllowanceLine> } => {
  const globalLines =
    global === null
      ? []
      : (["cost", "tokens"] as const).flatMap((unit) => {
          const limit = global.limits[unit];
          return limit === null
            ? []
            : [
                {
                  key: `global-${unit}`,
                  level: meterLevelOf(global.spent[unit], limit),
                  name: `Global · ${global.period?.toLowerCase() ?? "month"}`,
                  text: budgetUseTextOf(unit, global.spent[unit], limit),
                } satisfies AllowanceLine,
              ];
        });
  const accountLines = accounts.map(
    (account): AllowanceLine => ({
      key: `${account.harness}:${account.accountId ?? ""}`,
      level: "normal",
      name: `${harnessLabels[account.harness]} · ${account.label}`,
      text: [
        account.limits.cost === null && account.limits.tokens === null ? null : accountBudgetTextOf(account),
        planLimitsSummaryOf(account.planLimits),
      ]
        .filter((part) => part !== null)
        .join(" · "),
    }),
  );
  return {
    isGlobalBudgetSet: global === null ? null : global.limits.cost !== null || global.limits.tokens !== null,
    lines: [...globalLines, ...accountLines],
  };
};
