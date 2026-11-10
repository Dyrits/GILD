import type { RitualRunState, RitualSchedule } from "@gild/contracts";

// How Rituals read in the interface: schedules and next runs in words, and the choices a schedule form offers.

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** The kinds of schedule a form offers, in the order it lists them. */
export const scheduleKinds = ["Daily", "Weekdays", "Weekly", "Monthly", "Hourly"] as const;
export type ScheduleKind = (typeof scheduleKinds)[number];

/** How each kind of schedule is named in the form's list. */
export const scheduleKindLabels = {
  Daily: "Every day",
  Hourly: "Every few hours",
  Monthly: "Every month",
  Weekdays: "Weekdays",
  Weekly: "Every week",
} as const satisfies Record<ScheduleKind, string>;

/** A weekday's name, Sunday being 0. */
export const weekdayLabelOf = (day: number) => weekdayNames[day] ?? "Sunday";

/** A run's state as the owner reads it; Done reads like a fulfilled quest. */
export const runStateLabels = {
  Done: "Fulfilled",
  Failed: "Failed",
  Interrupted: "Interrupted",
  Underway: "Underway",
} as const satisfies Record<RitualRunState, string>;

const ordinalOf = (day: number) => {
  const suffix =
    day % 100 >= 11 && day % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10];
  return `${day}${suffix ?? "th"}`;
};

/** A schedule in words, such as "Every day at 07:00". */
export const scheduleLabelOf = (schedule: RitualSchedule): string => {
  if (schedule._tag === "Hourly") return schedule.hours === 1 ? "Every hour" : `Every ${schedule.hours} hours`;
  if (schedule._tag === "Daily") return `Every day at ${schedule.time}`;
  if (schedule._tag === "Weekdays") return `Weekdays at ${schedule.time}`;
  if (schedule._tag === "Weekly") return `Every ${weekdayLabelOf(schedule.day)} at ${schedule.time}`;
  return `Monthly on the ${ordinalOf(schedule.day)} at ${schedule.time}`;
};

/** The schedule of a kind chosen in the form, keeping the time already typed when the new kind has one. */
export const scheduleOfKind = (kind: ScheduleKind, current: RitualSchedule): RitualSchedule => {
  const time = current._tag === "Hourly" ? "07:00" : current.time;
  if (kind === "Hourly") return { _tag: "Hourly", hours: current._tag === "Hourly" ? current.hours : 6 };
  if (kind === "Weekly") return { _tag: "Weekly", day: current._tag === "Weekly" ? current.day : 1, time };
  if (kind === "Monthly") return { _tag: "Monthly", day: current._tag === "Monthly" ? current.day : 1, time };
  return { _tag: kind, time };
};

/** Whether text is a time of day on a 24-hour clock, "07:00". */
export const isTimeValid = (text: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(text);

const startOfDay = (millis: number) => {
  const date = new Date(millis);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};
const dayMillis = 24 * 60 * 60 * 1000;
const clockOf = (millis: number) =>
  new Date(millis).toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, minute: "2-digit" });

/** When the Ritual next runs, in words relative to now, or "Off" when it has none. */
export const nextRunLabelOf = (nextRunAt: number | null, now: number): string => {
  if (nextRunAt === null) return "Off";
  const days = Math.round((startOfDay(nextRunAt) - startOfDay(now)) / dayMillis);
  const when =
    days <= 0
      ? "today"
      : days === 1
        ? "tomorrow"
        : days < 7
          ? new Date(nextRunAt).toLocaleDateString("en-GB", { weekday: "short" })
          : new Date(nextRunAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `Next run ${when} ${clockOf(nextRunAt)}`;
};
