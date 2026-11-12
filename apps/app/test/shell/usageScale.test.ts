import type { UsageFilter } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import {
  chartScaleOf,
  periodOfChoice,
  periodOfRange,
  rangeChoiceOf,
  toggledFiltersOf,
} from "../../src/shell/usageScale";

describe("scaling the graph", () => {
  it("rounds the top up to a tidy step and gives evenly spaced ticks from zero", () => {
    expect(chartScaleOf(97)).toEqual({ ticks: [0, 50, 100], top: 100 });
    expect(chartScaleOf(310.54)).toEqual({ ticks: [0, 100, 200, 300, 400], top: 400 });
    expect(chartScaleOf(4)).toEqual({ ticks: [0, 1, 2, 3, 4], top: 4 });
  });

  it("gives a small chart a scale when there is no usage", () => {
    expect(chartScaleOf(0)).toEqual({ ticks: [0, 1], top: 1 });
  });
});

describe("typing a custom range", () => {
  it("makes a period from two real dates, the first not after the second", () => {
    expect(periodOfRange("2026-11-01", "2026-11-12")).toEqual({ _tag: "Range", from: "2026-11-01", to: "2026-11-12" });
    expect(periodOfRange(" 2026-11-12 ", "2026-11-12")).toEqual({
      _tag: "Range",
      from: "2026-11-12",
      to: "2026-11-12",
    });
  });

  it("refuses dates that are not real, or run backwards", () => {
    expect(periodOfRange("2026-02-30", "2026-03-02")).toBeNull();
    expect(periodOfRange("11/01/2026", "2026-11-12")).toBeNull();
    expect(periodOfRange("2026-11-12", "2026-11-01")).toBeNull();
    expect(periodOfRange("", "")).toBeNull();
  });

  it("refuses a range longer than the year the service reads, so no refused range is sent", () => {
    expect(periodOfRange("2025-11-12", "2026-11-12")).not.toBeNull();
    expect(periodOfRange("2025-11-11", "2026-11-12")).toBeNull();
    expect(periodOfRange("2024-01-01", "2026-11-12")).toBeNull();
  });
});

describe("choosing the period", () => {
  it("turns 7 days and 30 days into periods, and a period back into its choice", () => {
    expect(periodOfChoice("7 days")).toEqual({ _tag: "Days", days: 7 });
    expect(periodOfChoice("30 days")).toEqual({ _tag: "Days", days: 30 });
    expect(rangeChoiceOf({ _tag: "Days", days: 7 }, false)).toBe("7 days");
    expect(rangeChoiceOf({ _tag: "Days", days: 30 }, false)).toBe("30 days");
  });

  it("keeps Custom while the owner types a range, even when the period on show is a preset", () => {
    expect(rangeChoiceOf({ _tag: "Days", days: 30 }, true)).toBe("Custom");
    expect(rangeChoiceOf({ _tag: "Range", from: "2026-11-01", to: "2026-11-02" }, false)).toBe("Custom");
  });
});

describe("choosing rows", () => {
  type Chosen = UsageFilter & { readonly label: string };
  const claude: Chosen = { dimension: "Harness", key: "claude", label: "Claude Code" };
  const atlas: Chosen = { dimension: "Realm", key: "realm-atlas", label: "Atlas" };

  it("adds a row's filter beside the filters of other dimensions", () => {
    expect(toggledFiltersOf([claude], atlas)).toEqual([claude, atlas]);
  });

  it("replaces the filter of the same dimension, so a dimension is narrowed to one row", () => {
    const codex: Chosen = { dimension: "Harness", key: "codex", label: "Codex" };
    expect(toggledFiltersOf([claude, atlas], codex)).toEqual([atlas, codex]);
  });

  it("lets go of the row chosen again, leaving the others", () => {
    expect(toggledFiltersOf([claude, atlas], claude)).toEqual([atlas]);
    expect(toggledFiltersOf([claude], claude)).toEqual([]);
  });
});
