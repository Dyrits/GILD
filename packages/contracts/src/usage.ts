import { Schema } from "effect";
import { BillingKind, Consumption, TokenUsage } from "./budgets.ts";
import { HarnessName } from "./harnesses.ts";

// The Reserves usage page (budget-control, Reserves usage page): what Iskios's turns used, shown by harness, model, realm,
// and quest over a period of local calendar days, with the gaps in what is known.

/** The longest range of days a usage read covers: the graph shows a bar for each. */
export const maxUsageDays = 366;

/** The realm key of Iskios's own quest, which is in no realm. */
export const iskiosRealmKey = "~iskios";

/** The realm key of quests deleted after they spent. */
export const deletedRealmKey = "~deleted";

/** A local calendar day as `YYYY-MM-DD`. */
export const DayText = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/));
export type DayText = typeof DayText.Type;

/** The days a usage read covers: the last 7 or 30 days counting today, or a range with both its days included. */
export const UsagePeriod = Schema.Union([
  Schema.TaggedStruct("Days", { days: Schema.Literals([7, 30]) }),
  Schema.TaggedStruct("Range", { from: DayText, to: DayText }),
]);
export type UsagePeriod = typeof UsagePeriod.Type;

/** What a breakdown divides the usage by, and so what a filter selects. */
export const UsageDimension = Schema.Literals(["Harness", "Model", "Realm", "Quest", "Account", "Day"]);
export type UsageDimension = typeof UsageDimension.Type;

/**
 * One selected row of a breakdown, by its key: the harness name, the model identifier, the realm's id, the quest's id,
 * `harness/accountId`, or the day. An empty key is what was not recorded (or, for a realm, the Borderlands); a realm
 * can also be `iskiosRealmKey` or `deletedRealmKey`.
 */
export const UsageFilter = Schema.Struct({ dimension: UsageDimension, key: Schema.String });
export type UsageFilter = typeof UsageFilter.Type;

/**
 * What a set of turns used. `reported` and `estimated` are the dollars of the turns that have a price, kept apart; a
 * turn with neither is counted in `unpricedTurns` or `earlierTurns`, and `pricedTurns` counts those that have one, so a
 * group with none has no known cost, which is not a known zero.
 */
export const UsageAmounts = Schema.Struct({ ...Consumption.fields, pricedTurns: Schema.Number });
export type UsageAmounts = typeof UsageAmounts.Type;

/** One row of a breakdown. */
export const UsageRow = Schema.Struct({
  amounts: UsageAmounts,
  /** The one harness every turn of the row ran on, else null. */
  harness: Schema.NullOr(HarnessName),
  key: Schema.String,
  /** The name the owner gave (a realm, a quest, an account), null when the row has none to give. */
  name: Schema.NullOr(Schema.String),
});
export type UsageRow = typeof UsageRow.Type;

/**
 * The rows of one breakdown, biggest first, how many smaller ones are left out, and what all its rows used, left-out ones
 * included: the amount shares are shares of.
 */
export const UsageBreakdown = Schema.Struct({
  dimension: UsageDimension,
  hiddenRows: Schema.Number,
  rows: Schema.Array(UsageRow),
  total: UsageAmounts,
});
export type UsageBreakdown = typeof UsageBreakdown.Type;

/** One day of the graph: what each harness used on it. A day with no turns has no rows. */
export const UsageDay = Schema.Struct({
  byHarness: Schema.Array(Schema.Struct({ amounts: UsageAmounts, harness: Schema.NullOr(HarnessName) })),
  day: DayText,
});
export type UsageDay = typeof UsageDay.Type;

/** One turn behind the numbers. */
export const UsageRecord = Schema.Struct({
  billing: Schema.NullOr(BillingKind),
  /** The turn's cost, null when it has no price. */
  cost: Schema.NullOr(Schema.Number),
  endedAt: Schema.Number,
  harness: Schema.NullOr(HarnessName),
  /** Whether the cost is the one the harness reported, rather than an estimate. */
  isReported: Schema.Boolean,
  model: Schema.NullOr(Schema.String),
  /** The quest's title; null when the quest was deleted afterwards. */
  questName: Schema.NullOr(Schema.String),
  threadTitle: Schema.NullOr(Schema.String),
  tokens: TokenUsage,
  turnId: Schema.String,
});
export type UsageRecord = typeof UsageRecord.Type;

/** What the partial-data notice counts; a count that cannot be attributed under the filters is null. */
export const UsageGaps = Schema.Struct({
  earlierTurns: Schema.Number,
  /** Turns whose token records are empty: the harness reported no usable counts. */
  emptyTokenTurns: Schema.Number,
  /** Finished turns that left no usage record; null while a harness, model, or account filter hides which they were. */
  turnsWithoutUsage: Schema.NullOr(Schema.Number),
  unpricedTurns: Schema.Number,
});
export type UsageGaps = typeof UsageGaps.Type;

/** The usage page's data for one period and filters. */
export const UsageReport = Schema.Struct({
  amounts: UsageAmounts,
  breakdowns: Schema.Array(UsageBreakdown),
  /** One entry for each local day of the period, oldest first. */
  days: Schema.Array(UsageDay),
  gaps: UsageGaps,
  /** Completed assistant replies and sent user messages in the period; null while a harness, model, or account filter hides which they were. */
  messages: Schema.NullOr(Schema.Struct({ assistant: Schema.Number, user: Schema.Number })),
  /** The period: its first and last local day, and the millisecond bounds, the end excluded. */
  period: Schema.Struct({ firstDay: DayText, from: Schema.Number, lastDay: DayText, to: Schema.Number }),
  quests: Schema.Number,
  /** The turns behind the numbers, newest first, and how many older ones are left out. */
  records: Schema.Struct({ hiddenCount: Schema.Number, rows: Schema.Array(UsageRecord) }),
  /** When the first usage was recorded and when the latest was, over all time and filters. */
  startedAt: Schema.NullOr(Schema.Number),
  threads: Schema.Number,
  updatedAt: Schema.NullOr(Schema.Number),
});
export type UsageReport = typeof UsageReport.Type;
