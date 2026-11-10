import { describe, expect, it } from "vitest";
import { nextRunAfter } from "../../src/work/ritualSchedule.ts";

// Dates are built from local fields, as a schedule is read in the computer's local time.
const at = (month: number, day: number, hour = 0, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();

describe("the next run of a Ritual's schedule", () => {
  it("runs a daily Ritual later the same day, or the next day once the time has passed", () => {
    const schedule = { _tag: "Daily", time: "07:00" } as const;
    expect(nextRunAfter(schedule, at(11, 10, 6, 0))).toBe(at(11, 10, 7, 0));
    expect(nextRunAfter(schedule, at(11, 10, 7, 0))).toBe(at(11, 11, 7, 0));
  });

  it("skips the weekend for a weekdays Ritual", () => {
    // 2026-11-13 is a Friday.
    expect(nextRunAfter({ _tag: "Weekdays", time: "09:30" }, at(11, 13, 10, 0))).toBe(at(11, 16, 9, 30));
  });

  it("runs a weekly Ritual on its day, Sunday being 0", () => {
    // 2026-11-10 is a Tuesday; the Sunday after is the 15th.
    expect(nextRunAfter({ _tag: "Weekly", day: 0, time: "08:00" }, at(11, 10, 12, 0))).toBe(at(11, 15, 8, 0));
  });

  it("runs a monthly Ritual on its day of the next month once this month's has passed", () => {
    expect(nextRunAfter({ _tag: "Monthly", day: 28, time: "12:00" }, at(11, 29, 0, 0))).toBe(at(12, 28, 12, 0));
    expect(nextRunAfter({ _tag: "Monthly", day: 28, time: "12:00" }, at(11, 10, 0, 0))).toBe(at(11, 28, 12, 0));
  });

  it("runs an hourly Ritual that many hours after the moment given", () => {
    expect(nextRunAfter({ _tag: "Hourly", hours: 6 }, at(11, 10, 6, 15))).toBe(at(11, 10, 12, 15));
  });
});
