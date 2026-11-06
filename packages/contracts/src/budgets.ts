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

/** The global budget's period; it starts at local midnight, on Monday for a week, on the 1st for a month. */
export const BudgetPeriod = Schema.Literals(["Day", "Week", "Month"]);
export type BudgetPeriod = typeof BudgetPeriod.Type;

/** Spending in each unit: API-key cost, and subscription tokens. */
export const Spending = Schema.Struct({ cost: Schema.Number, tokens: Schema.Number });
export type Spending = typeof Spending.Type;

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
export const BudgetPart = Schema.Struct({ id: Schema.String, spent: Spending, title: Schema.String });
export type BudgetPart = typeof BudgetPart.Type;

/** The budget window: used of limit, the split, and for the global budget its period. */
export const BudgetWindow = Schema.Struct({
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
