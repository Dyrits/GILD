import { Schema } from "effect";
import { BudgetStopId, MissionId, ThreadId } from "./ids.ts";

// Budgets and spending (budget-control).

/** A budget's two optional limits; null means no limit (budget-control, Budgets). */
export const BudgetLimits = Schema.Struct({
  /** For API-key spending, in the provider's currency. */
  cost: Schema.NullOr(Schema.Number.check(Schema.isGreaterThan(0))),
  /** For subscription spending; tokens are never priced. */
  tokens: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
});
export type BudgetLimits = typeof BudgetLimits.Type;

/**
 * How a turn was billed, from what its harness reports about the sign-in it ran with; it chooses the budget unit
 * the turn counts toward, and Unknown counts as Subscription (budget-control, Billing kind).
 */
export const BillingKind = Schema.Literals(["Subscription", "ApiKey", "Unknown"]);
export type BillingKind = typeof BillingKind.Type;

/** The global budget's period; it starts at local midnight, on Monday for a week, on the 1st for a month. */
export const BudgetPeriod = Schema.Literals(["Day", "Week", "Month"]);
export type BudgetPeriod = typeof BudgetPeriod.Type;

/** Spending in each unit: API-key cost, and subscription tokens. */
export const Spending = Schema.Struct({ cost: Schema.Number, tokens: Schema.Number });
export type Spending = typeof Spending.Type;

/** Token counts in the provider's own unit; never converted to a price. */
export const TokenUsage = Schema.Struct({
  cacheCreation: Schema.Number,
  cacheRead: Schema.Number,
  input: Schema.Number,
  output: Schema.Number,
});
export type TokenUsage = typeof TokenUsage.Type;

/**
 * What a set of turns used, shown rather than counted (budget-control, Estimated cost): tokens by kind; the cost
 * API-key turns reported; the estimated cost of every other priced turn (`≈`); and how many turns have no price,
 * apart from the earlier ones recorded before billing kinds and estimates.
 */
export const Consumption = Schema.Struct({
  /** Turns recorded before billing kinds and estimates, which stay unpriced. */
  earlierTurns: Schema.Number,
  /** Dollars estimated for turns that reported no cost, from the price table or the harness's own figure. */
  estimated: Schema.Number,
  /** Dollars the harness reported for API-key turns. */
  reported: Schema.Number,
  tokens: TokenUsage,
  turns: Schema.Number,
  /** Turns since estimates began whose model has no price. */
  unpricedTurns: Schema.Number,
});
export type Consumption = typeof Consumption.Type;

/** Where the model price table in use came from: the public table, or the snapshot shipped with Gild. */
export const PriceStatus = Schema.Struct({
  /** When the table was read (or the snapshot made), in milliseconds. */
  at: Schema.Number,
  /** Whether Gild reads the public table at all (the Charter switch). */
  isFetching: Schema.Boolean,
  /** How many models carry a price. */
  models: Schema.Number,
  source: Schema.Literals(["Fetched", "Snapshot"]),
});
export type PriceStatus = typeof PriceStatus.Type;

/** A budget's limits with what is spent against them. */
export const BudgetUse = Schema.Struct({ limits: BudgetLimits, spent: Spending });
export type BudgetUse = typeof BudgetUse.Type;

/** Which budget a stop or a budget window is about: a mission's, or the global one. */
export const BudgetScope = Schema.Literals(["Mission", "Global"]);
export type BudgetScope = typeof BudgetScope.Type;

/** A budget reached and not yet answered: the mission's, or the global one (budget-control, Reaching a limit). */
export const BudgetStop = Schema.Struct({
  id: BudgetStopId,
  /** Null for the global budget. */
  missionId: Schema.NullOr(MissionId),
  missionTitle: Schema.NullOr(Schema.String),
  reachedAt: Schema.Number,
  scope: BudgetScope,
  /** The thread that holds the question. */
  threadId: ThreadId,
});
export type BudgetStop = typeof BudgetStop.Type;

/** A line recording a budget change or a stop at a limit, shown in the mission's top thread. */
export const BudgetEvent = Schema.Struct({ at: Schema.Number, id: Schema.String, text: Schema.String });
export type BudgetEvent = typeof BudgetEvent.Type;

/** What one part spent: a thread of a mission, or a mission under the global budget. */
export const BudgetPart = Schema.Struct({
  consumption: Consumption,
  id: Schema.String,
  spent: Spending,
  title: Schema.String,
});
export type BudgetPart = typeof BudgetPart.Type;

/** The budget window: used of limit, the split, and for the global budget its period. */
export const BudgetWindow = Schema.Struct({
  /** The same use split by the harness each turn ran on, then by its model; turns before models were recorded are one part. */
  byHarness: Schema.Array(BudgetPart),
  byModel: Schema.Array(BudgetPart),
  /** What the covered turns used, with the estimated cost (budget-control, Seeing budget use and consumption). */
  consumption: Consumption,
  limits: BudgetLimits,
  /** When the global period starts over; null for a mission. */
  nextStart: Schema.NullOr(Schema.Number),
  parts: Schema.Array(BudgetPart),
  period: Schema.NullOr(BudgetPeriod),
  periodStart: Schema.NullOr(Schema.Number),
  spent: Spending,
  /** The open stop in this scope, or null. */
  stop: Schema.NullOr(BudgetStop),
});
export type BudgetWindow = typeof BudgetWindow.Type;
