import { type RitualRunState, RitualSchedule } from "@iskios/contracts";
import { Schema } from "effect";

// When a Ritual is next due (rituals). Schedules are read in the computer's local time.

const hourMillis = 60 * 60 * 1000;
/** The furthest ahead a day-based schedule looks for its next day: a month's day (28) always occurs within it. */
const searchDays = 62;

/** The days of the week a day-based schedule allows, Sunday as 0; null for any day. */
const weekdaysOf = (schedule: Exclude<RitualSchedule, { _tag: "Hourly" }>): ReadonlyArray<number> | null =>
  schedule._tag === "Weekdays" ? [1, 2, 3, 4, 5] : schedule._tag === "Weekly" ? [schedule.day] : null;

/** The first moment strictly after `after` at which the schedule is due. */
export const nextRunAfter = (schedule: RitualSchedule, after: number): number => {
  if (schedule._tag === "Hourly") return after + schedule.hours * hourMillis;
  const [hour = 0, minute = 0] = schedule.time.split(":").map(Number);
  const weekdays = weekdaysOf(schedule);
  const start = new Date(after);
  for (let offset = 0; offset <= searchDays; offset++) {
    // Built from local fields so a change of clock for daylight saving keeps the time of day.
    const candidate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset, hour, minute, 0, 0);
    const isDay =
      (weekdays === null || weekdays.includes(candidate.getDay())) &&
      (schedule._tag !== "Monthly" || candidate.getDate() === schedule.day);
    if (isDay && candidate.getTime() > after) return candidate.getTime();
  }
  // Unreachable: every schedule has a day within the search.
  return after + 24 * hourMillis;
};

/** A stored schedule, written as JSON by this module. */
export const scheduleOf = (stored: string): RitualSchedule =>
  Schema.decodeUnknownSync(RitualSchedule)(JSON.parse(stored));

/**
 * How the Ritual's latest run stands. A run recorded as underway whose thread was stopped ended without the harness
 * reporting it, so it reads as interrupted; a run the service lost by stopping reads the same, at startup.
 */
export const runStateOf = (stored: string | null, threadState: string): RitualRunState | null =>
  stored === null
    ? null
    : stored === "Underway" && threadState === "Stopped"
      ? "Interrupted"
      : (stored as RitualRunState);
