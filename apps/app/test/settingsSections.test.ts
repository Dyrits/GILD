import { describe, expect, it } from "vitest";
import { activeSectionOf } from "../src/settingsSections";

const tops = { accounts: 700, defaults: 120, harnesses: 400, limits: 1400, messaging: 1000, permissions: 0 };

describe("marking the Workshop section in view", () => {
  it("marks the first section at the top of the page", () => {
    expect(activeSectionOf({ isAtEnd: false, scrollTop: 0, tops })).toBe("permissions");
  });

  it("marks the last section whose top has been scrolled to", () => {
    expect(activeSectionOf({ isAtEnd: false, scrollTop: 710, tops })).toBe("accounts");
  });

  it("marks a section a little before its top reaches the view", () => {
    expect(activeSectionOf({ isAtEnd: false, scrollTop: 370, tops })).toBe("harnesses");
  });

  it("marks the last section at the foot of the page, though it never reaches the top", () => {
    expect(activeSectionOf({ isAtEnd: true, scrollTop: 900, tops })).toBe("limits");
  });

  it("marks the first section while no section is measured", () => {
    expect(activeSectionOf({ isAtEnd: false, scrollTop: 300, tops: {} })).toBe("permissions");
  });
});
