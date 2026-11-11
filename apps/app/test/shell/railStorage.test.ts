import { describe, expect, it } from "vitest";
import { clampRailWidth } from "../../src/shell/railStorage";

describe("the width the open sidebar can be dragged to", () => {
  it("goes up to a quarter of the window", () => {
    expect(clampRailWidth(900, 2000)).toBe(500);
    expect(clampRailWidth(450, 2000)).toBe(450);
  });

  it("never goes below the least width that keeps Borderlands whole with its buttons", () => {
    expect(clampRailWidth(120, 2000)).toBe(284);
  });

  it("keeps the least width on a window too narrow for a quarter to reach it", () => {
    expect(clampRailWidth(400, 1000)).toBe(284);
  });

  it("brings a remembered width back within a quarter of a narrower window", () => {
    expect(clampRailWidth(500, 1600)).toBe(400);
  });
});
