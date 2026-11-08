import { describe, expect, it } from "vitest";
import { menuPlacementOf } from "../src/menuPlacement";

const window = { height: 800, width: 1200 };

describe("placing a menu's open list", () => {
  it("opens below its button, aligned with its left edge", () => {
    expect(menuPlacementOf({ height: 24, width: 90, x: 40, y: 100 }, window, 200)).toEqual({
      left: 40,
      maxHeight: 320,
      minWidth: 200,
      top: 128,
    });
  });

  it("is at least as wide as its button, so a drop-down field's list lines up with it", () => {
    expect(menuPlacementOf({ height: 30, width: 300, x: 40, y: 100 }, window, 200).minWidth).toBe(300);
  });

  it("opens above its button when there is more room above than below", () => {
    expect(menuPlacementOf({ height: 24, width: 90, x: 40, y: 700 }, window, 200)).toEqual({
      bottom: 104,
      left: 40,
      maxHeight: 320,
      minWidth: 200,
    });
  });

  it("shrinks to the room left when neither side has the full height", () => {
    const placement = menuPlacementOf({ height: 24, width: 90, x: 40, y: 100 }, { height: 300, width: 1200 }, 200);
    expect(placement.maxHeight).toBe(300 - 128 - 8);
  });

  it("stays inside the window's right edge", () => {
    expect(menuPlacementOf({ height: 24, width: 90, x: 1150, y: 100 }, window, 200).left).toBe(1200 - 200 - 8);
  });
});
