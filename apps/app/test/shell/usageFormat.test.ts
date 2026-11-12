import type { UsageAmounts } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import {
  axisTextOf,
  compactCountOf,
  costBasisOf,
  emptyAmounts,
  metricValueOf,
  shareCaptionOf,
  shareTextOf,
  tokenTotalsOf,
  usageCostTextOf,
} from "../../src/shell/usageFormat";

const amounts = (partial: Partial<UsageAmounts> = {}): UsageAmounts => ({ ...emptyAmounts, ...partial });
const tokens = (input: number, output = 0, cacheRead = 0, cacheCreation = 0) => ({
  cacheCreation,
  cacheRead,
  input,
  output,
});

describe("totalling tokens", () => {
  it("tells the tokens without cache reads from those processed, as the specification's example does", () => {
    const totals = tokenTotalsOf({ cacheCreation: 20, cacheRead: 1000, input: 100, output: 30 });
    expect(totals.withoutCacheReads).toBe(150);
    expect(totals.processed).toBe(1150);
    expect(totals).toMatchObject({ cacheCreation: 20, cachedInput: 1000, output: 30, uncachedInput: 100 });
  });
});

describe("shortening counts", () => {
  it("keeps small counts whole and shortens thousands, millions, and billions with two decimals", () => {
    expect(compactCountOf(0)).toBe("0");
    expect(compactCountOf(999)).toBe("999");
    expect(compactCountOf(753_340)).toBe("753.34K");
    expect(compactCountOf(25_080_000)).toBe("25.08M");
    expect(compactCountOf(1_230_000_000)).toBe("1.23B");
  });

  it("rolls a count that rounds up to the next unit into it", () => {
    expect(compactCountOf(999_999)).toBe("1.00M");
  });
});

describe("writing a cost", () => {
  it("shows a reported cost plainly and any estimate with ≈", () => {
    expect(usageCostTextOf(amounts({ pricedTurns: 1, reported: 1.2, turns: 1 }))).toBe("$1.20");
    expect(usageCostTextOf(amounts({ estimated: 304.11, pricedTurns: 3, turns: 3 }))).toBe("≈ $304.11");
    expect(usageCostTextOf(amounts({ estimated: 1, pricedTurns: 2, reported: 2, turns: 2 }))).toBe("≈ $3.00");
  });

  it("tells no usage, a known zero, and turns with no price apart", () => {
    expect(usageCostTextOf(amounts())).toBe("No usage");
    expect(usageCostTextOf(amounts({ pricedTurns: 1, turns: 1 }))).toBe("$0.00");
    expect(usageCostTextOf(amounts({ pricedTurns: 0, turns: 2 }))).toBe("Unavailable");
  });

  it("does not round a few cents' fraction down to nothing", () => {
    expect(usageCostTextOf(amounts({ estimated: 0.002, pricedTurns: 1, turns: 1 }))).toBe("≈ < $0.01");
  });

  it("says where the cost comes from only when there is one", () => {
    expect(costBasisOf(amounts({ pricedTurns: 1, reported: 1, turns: 1 }))).toBe("Reported");
    expect(costBasisOf(amounts({ estimated: 1, pricedTurns: 1, turns: 1 }))).toBe("API estimate");
    expect(costBasisOf(amounts({ estimated: 1, pricedTurns: 2, reported: 2, turns: 2 }))).toBe(
      "Reported and estimated",
    );
    expect(costBasisOf(amounts({ pricedTurns: 0, turns: 3 }))).toBeNull();
    expect(costBasisOf(amounts())).toBeNull();
  });
});

describe("reading a metric", () => {
  it("reads a cost, null without a price, or the tokens without cache reads", () => {
    const value = amounts({ estimated: 2, pricedTurns: 1, tokens: tokens(10, 3, 99, 5), turns: 1 });
    expect(metricValueOf(value, "Cost")).toBe(2);
    expect(metricValueOf(value, "Tokens")).toBe(18);
    expect(metricValueOf(amounts({ turns: 1 }), "Cost")).toBeNull();
  });

  it("writes a value on the graph's axis", () => {
    expect(axisTextOf(100, "Cost")).toBe("$100.00");
    expect(axisTextOf(25_000, "Tokens")).toBe("25.00K");
  });
});

describe("sharing a breakdown among its rows", () => {
  // The breakdown's total counts every row, the ones left out of the list included.
  const total = amounts({ estimated: 200, pricedTurns: 4, tokens: tokens(1000), turns: 5 });
  const claude = {
    amounts: amounts({ estimated: 75, pricedTurns: 2, tokens: tokens(100), turns: 2 }),
    harness: null,
    key: "a",
    name: null,
  };
  const opencode = { amounts: amounts({ tokens: tokens(500), turns: 1 }), harness: null, key: "b", name: null };

  it("shares known cost of the whole breakdown, so rows left out of the list still count", () => {
    expect(shareTextOf(claude, total, "Cost")).toBe("37.5%");
  });

  it("gives a row with no price no share", () => {
    expect(shareTextOf(opencode, total, "Cost")).toBe("Unavailable");
  });

  it("shares tokens without cache reads, which is what the tokens column shows", () => {
    expect(shareTextOf(claude, total, "Tokens")).toBe("10.0%");
    expect(shareTextOf(opencode, total, "Tokens")).toBe("50.0%");
  });

  it("shows a share under a tenth of a percent as less than a tenth, not as zero", () => {
    const small = { ...claude, amounts: amounts({ estimated: 0.01, pricedTurns: 1, turns: 1 }) };
    expect(shareTextOf(small, total, "Cost")).toBe("< 0.1%");
  });

  it("gives a known zero a share of zero", () => {
    expect(shareTextOf({ ...claude, amounts: amounts({ pricedTurns: 1, turns: 1 }) }, total, "Cost")).toBe("0.0%");
  });

  it("captions a harness with its share and tokens, or says it has no known cost", () => {
    expect(shareCaptionOf(claude, total, "Cost")).toBe("37.5% of known cost · 100 tokens");
    expect(shareCaptionOf(claude, total, "Tokens")).toBe("10.0% of tokens · 100 tokens");
    expect(shareCaptionOf(opencode, total, "Cost")).toBe("No known cost · 500 tokens");
  });
});
