import { describe, expect, it } from "vitest";
import { currentWindowsOf, leftPercentOf, resetsInTextOf, ringStackOf } from "../../src/editors/planRings";

const fiveHour = { label: "5-hour", resetsAt: 1_000, usedPercent: 0 };
const weekly = { label: "Weekly", resetsAt: 9_000, usedPercent: 11 };

describe("laying plan limits out as rings", () => {
  it("puts the window that resets last outermost and the first inner, shrinking each ring by a stroke and a gap", () => {
    const { rings } = ringStackOf([fiveHour, weekly], 44, 4, 2);
    expect(rings.map((ring) => ring.window.label)).toEqual(["Weekly", "5-hour"]);
    expect(rings.map((ring) => ring.radius)).toEqual([20, 14]);
  });

  it("fills the share left of each circumference", () => {
    const { rings } = ringStackOf([weekly], 44, 4, 2);
    expect(rings[0]?.filled).toBeCloseTo((rings[0]?.circumference ?? 0) * 0.89);
  });

  it("keeps a reading outside 0 to 100 inside one ring, empty past the limit and full when unused", () => {
    const { rings } = ringStackOf(
      [
        { ...fiveHour, usedPercent: 140 },
        { ...weekly, usedPercent: -5 },
      ],
      44,
      4,
      2,
    );
    expect(rings[1]?.filled).toBe(0);
    expect(rings[0]?.filled).toBeCloseTo(rings[0]?.circumference ?? 0);
  });

  it("colors by how full it is: normal, warning from 80, reached at 100", () => {
    const levels = [50, 80, 100].map(
      (usedPercent) => ringStackOf([{ ...weekly, usedPercent }], 44, 4, 2).rings[0]?.level,
    );
    expect(levels).toEqual(["normal", "warning", "reached"]);
  });

  it("leaves a logo room inside the innermost ring, bigger when there are fewer rings", () => {
    const two = ringStackOf([fiveHour, weekly], 44, 4, 2).logoSize;
    const one = ringStackOf([weekly], 44, 4, 2).logoSize;
    expect(two).toBeGreaterThan(0);
    expect(one).toBeGreaterThan(two);
  });
});

describe("windows that have reset", () => {
  it("read as unused once their reset time has passed, and are kept otherwise", () => {
    const [soon, later] = currentWindowsOf(
      [
        { ...fiveHour, usedPercent: 60 },
        { ...weekly, usedPercent: 40 },
      ],
      5_000,
    );
    expect(soon?.usedPercent).toBe(0);
    expect(later?.usedPercent).toBe(40);
  });
});

describe("the hover card's figures", () => {
  it("writes the time to a reset in its two largest units", () => {
    const hour = 3_600_000;
    expect(resetsInTextOf(4 * hour + 57 * 60_000)).toBe("4h 57m");
    expect(resetsInTextOf(6 * 24 * hour + 9 * hour + 5_000)).toBe("6d 9h");
    expect(resetsInTextOf(90_000)).toBe("1m");
    expect(resetsInTextOf(10_000)).toBe("1m");
    expect(resetsInTextOf(0)).toBe("reset");
    expect(resetsInTextOf(-5)).toBe("reset");
  });

  it("gives the share left, kept between 0 and 100", () => {
    expect(leftPercentOf({ ...weekly, usedPercent: 11 })).toBe(89);
    expect(leftPercentOf({ ...weekly, usedPercent: 140 })).toBe(0);
    expect(leftPercentOf({ ...weekly, usedPercent: -3 })).toBe(100);
  });
});
