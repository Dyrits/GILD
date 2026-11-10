import { Schema } from "effect";
import { RitualId } from "./ids.ts";

// A Ritual's schedule and what the board shows of it (rituals). Kept apart from `rituals.ts` because the mission summary,
// in `records.ts`, carries the card and `rituals.ts` reads `records.ts`.

/** A local time of day, "07:00". */
const TimeOfDay = Schema.String.check(Schema.isPattern(/^([01]\d|2[0-3]):[0-5]\d$/));

/**
 * When a Ritual runs, in the computer's local time: a preset, never a cron expression. Weekly days count from
 * Sunday as 0; monthly days stop at 28 so every month has one.
 */
export const RitualSchedule = Schema.Union([
  Schema.TaggedStruct("Daily", { time: TimeOfDay }),
  Schema.TaggedStruct("Weekdays", { time: TimeOfDay }),
  Schema.TaggedStruct("Weekly", {
    day: Schema.Int.check(Schema.isBetween({ maximum: 6, minimum: 0 })),
    time: TimeOfDay,
  }),
  Schema.TaggedStruct("Monthly", {
    day: Schema.Int.check(Schema.isBetween({ maximum: 28, minimum: 1 })),
    time: TimeOfDay,
  }),
  Schema.TaggedStruct("Hourly", { hours: Schema.Int.check(Schema.isBetween({ maximum: 168, minimum: 1 })) }),
]);
export type RitualSchedule = typeof RitualSchedule.Type;

/** How the last run of a Ritual stands: underway, finished, interrupted, or failed with every Companion. */
export const RitualRunState = Schema.Literals(["Underway", "Done", "Interrupted", "Failed"]);
export type RitualRunState = typeof RitualRunState.Type;

/** What a Ritual's card on the board shows. */
export const RitualCard = Schema.Struct({
  id: RitualId,
  isOn: Schema.Boolean,
  lastRunAt: Schema.NullOr(Schema.Number),
  lastRunState: Schema.NullOr(RitualRunState),
  /** The next scheduled run, or null while the Ritual is off. */
  nextRunAt: Schema.NullOr(Schema.Number),
  schedule: RitualSchedule,
});
export type RitualCard = typeof RitualCard.Type;
