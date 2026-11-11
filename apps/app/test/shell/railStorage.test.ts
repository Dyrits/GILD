import { describe, expect, it } from "vitest";
import { clampPaneWidth, clampRailWidth } from "../../src/shell/railStorage";

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

describe("the width the quest panel and Iskios's column can be dragged to", () => {
  it("goes from the pane's own least width up to a quarter of the window", () => {
    expect(clampPaneWidth(900, 2400, 360)).toBe(600);
    expect(clampPaneWidth(450, 2400, 360)).toBe(450);
    expect(clampPaneWidth(100, 2400, 380)).toBe(380);
  });

  it("keeps the pane's least width on a window too narrow for a quarter to reach it", () => {
    expect(clampPaneWidth(500, 1200, 380)).toBe(380);
  });

  it("lets a quarter of a 2176 px window, as the owner's, hold each pane wider than it opens", () => {
    expect(clampPaneWidth(540, 2176, 380)).toBe(540);
    expect(clampPaneWidth(700, 2176, 380)).toBe(544);
  });
});
