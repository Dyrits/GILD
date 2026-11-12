import { describe, expect, it } from "vitest";
import { planLimitsOf } from "../../src/harness/claude.ts";

// The event as Claude Code 2.1.322 sent it (probe of 2026-11-12).
const event = {
  rate_limit_info: {
    rateLimitType: "seven_day",
    resetsAt: 1794837600,
    status: "allowed_warning",
    unifiedWindows: {
      five_hour: { resetsAt: 1794481800, status: "allowed", utilization: 0.06 },
      seven_day: { resetsAt: 1794837600, status: "allowed_warning", utilization: 0.76 },
    },
    utilization: 0.76,
  },
  type: "rate_limit_event",
};

describe("plan limits from Claude Code's rate limit event", () => {
  it("reads the 5-hour and weekly windows as a used percent with a reset time in seconds", () => {
    expect(planLimitsOf(event, "Subscription")).toEqual({
      billing: "Subscription",
      windows: [
        { resetsAtSeconds: 1794481800, usedPercent: 6, windowMinutes: 300 },
        { resetsAtSeconds: 1794837600, usedPercent: 76, windowMinutes: 10_080 },
      ],
    });
  });

  it("keeps the window that is reported when the other is missing", () => {
    const only = { rate_limit_info: { unifiedWindows: { five_hour: event.rate_limit_info.unifiedWindows.five_hour } } };
    expect(planLimitsOf(only, "Subscription")?.windows.map((window) => window.windowMinutes)).toEqual([300]);
  });

  it("reports nothing for an event without windows or with unreadable ones", () => {
    expect(planLimitsOf({ rate_limit_info: { status: "allowed" } }, "Subscription")).toBeNull();
    expect(
      planLimitsOf({ rate_limit_info: { unifiedWindows: { five_hour: { utilization: "x" } } } }, "Unknown"),
    ).toBeNull();
    expect(planLimitsOf(null, "Unknown")).toBeNull();
  });
});
