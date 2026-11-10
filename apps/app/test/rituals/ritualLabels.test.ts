import { describe, expect, it } from "vitest";
import {
  isTimeValid,
  nextRunLabelOf,
  runStateLabels,
  scheduleLabelOf,
  scheduleOfKind,
} from "../../src/rituals/ritualLabels";

// Local-field dates, as the schedule itself is read.
const at = (month: number, day: number, hour: number, minute: number) =>
  new Date(2026, month - 1, day, hour, minute).getTime();

describe("a schedule in words", () => {
  it("names each preset", () => {
    expect(scheduleLabelOf({ _tag: "Daily", time: "07:00" })).toBe("Every day at 07:00");
    expect(scheduleLabelOf({ _tag: "Weekdays", time: "09:30" })).toBe("Weekdays at 09:30");
    expect(scheduleLabelOf({ _tag: "Weekly", day: 0, time: "08:00" })).toBe("Every Sunday at 08:00");
    expect(scheduleLabelOf({ _tag: "Monthly", day: 28, time: "12:00" })).toBe("Monthly on the 28th at 12:00");
    expect(scheduleLabelOf({ _tag: "Hourly", hours: 1 })).toBe("Every hour");
    expect(scheduleLabelOf({ _tag: "Hourly", hours: 6 })).toBe("Every 6 hours");
  });

  it("takes a preset's default, keeping the time already chosen", () => {
    expect(scheduleOfKind("Weekly", { _tag: "Daily", time: "06:15" })).toEqual({
      _tag: "Weekly",
      day: 1,
      time: "06:15",
    });
    expect(scheduleOfKind("Hourly", { _tag: "Daily", time: "06:15" })).toEqual({ _tag: "Hourly", hours: 6 });
    expect(scheduleOfKind("Daily", { _tag: "Hourly", hours: 2 })).toEqual({ _tag: "Daily", time: "07:00" });
  });
});

describe("the next run in words", () => {
  const now = at(11, 10, 12, 0);
  it("gives the time today or tomorrow, else the weekday, and says when a Ritual is off", () => {
    expect(nextRunLabelOf(at(11, 10, 18, 5), now)).toBe("Next run today 18:05");
    expect(nextRunLabelOf(at(11, 11, 7, 0), now)).toBe("Next run tomorrow 07:00");
    expect(nextRunLabelOf(at(11, 13, 7, 0), now)).toBe("Next run Fri 07:00");
    expect(nextRunLabelOf(null, now)).toBe("Off");
  });
});

describe("a time of day typed in a form", () => {
  it("accepts only HH:MM on a 24-hour clock", () => {
    expect(isTimeValid("07:00")).toBe(true);
    expect(isTimeValid("23:59")).toBe(true);
    expect(isTimeValid("24:00")).toBe(false);
    expect(isTimeValid("7:00")).toBe(false);
    expect(isTimeValid("07:60")).toBe(false);
  });
});

describe("a run's state", () => {
  it("reads in the guild's words", () => {
    expect(runStateLabels.Done).toBe("Fulfilled");
    expect(runStateLabels.Underway).toBe("Underway");
  });
});
