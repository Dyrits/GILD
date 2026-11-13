import type { AccountBudget, BudgetWindow, UsageDay, UsageGaps, UsageRecord, UsageRow } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { emptyAmounts } from "../../src/shell/usageFormat";
import {
  allowanceLinesOf,
  dayCaptionOf,
  dayLabelOf,
  filterTextOf,
  isFilterChosen,
  noticeOf,
  recordDetailOf,
  rowLabelOf,
} from "../../src/shell/usageLabels";

const row = (key: string, name: string | null = null): UsageRow => ({
  amounts: emptyAmounts,
  harness: null,
  key,
  name,
});

describe("naming breakdown rows", () => {
  it("names harnesses, the Borderlands, Iskios, deleted quests, and what was not recorded", () => {
    expect(rowLabelOf("Harness", row("claude"))).toBe("Claude Code");
    expect(rowLabelOf("Harness", row(""))).toBe("Not recorded");
    expect(rowLabelOf("Realm", row(""))).toBe("Borderlands");
    expect(rowLabelOf("Realm", row("~iskios", "Iskios (assistant)"))).toBe("Iskios (assistant)");
    expect(rowLabelOf("Realm", row("~deleted"))).toBe("Deleted quests");
    expect(rowLabelOf("Realm", row("realm-1", "Atlas"))).toBe("Atlas");
    expect(rowLabelOf("Quest", row("m1", "Port the parser"))).toBe("Port the parser");
    expect(rowLabelOf("Quest", row("m2"))).toBe("Deleted quest");
    expect(rowLabelOf("Model", row(""))).toBe("Not recorded");
  });

  it("names an account by its harness and its own name, or the computer's name the service sends", () => {
    expect(rowLabelOf("Account", row("codex/acct-1", "Work"))).toBe("Codex · Work");
    expect(rowLabelOf("Account", row("claude/", "Studio"))).toBe("Claude Code · Studio");
    expect(rowLabelOf("Account", row("claude/"))).toBe("Claude Code · This computer");
    expect(rowLabelOf("Account", row(""))).toBe("Not recorded");
  });

  it("names a day by its month and day", () => {
    expect(dayLabelOf("2026-11-06")).toBe("Nov 6");
    expect(rowLabelOf("Day", row("2026-11-12"))).toBe("Nov 12");
  });
});

describe("naming a chosen filter", () => {
  it("writes the dimension, with the model's as Companion, and the label chosen with it", () => {
    expect(filterTextOf({ dimension: "Realm", key: "r", label: "Atlas" })).toBe("Realm: Atlas");
    expect(filterTextOf({ dimension: "Model", key: "m", label: "Opus 5.5" })).toBe("Companion (model): Opus 5.5");
  });

  it("finds a row's filter among the chosen ones", () => {
    const chosen = [{ dimension: "Harness", key: "claude", label: "Claude Code" }] as const;
    expect(isFilterChosen(chosen, { dimension: "Harness", key: "claude" })).toBe(true);
    expect(isFilterChosen(chosen, { dimension: "Harness", key: "codex" })).toBe(false);
    expect(isFilterChosen(chosen, { dimension: "Realm", key: "claude" })).toBe(false);
  });
});

describe("warning of partial data", () => {
  const gaps = (partial: Partial<UsageGaps> = {}): UsageGaps => ({
    earlierTurns: 0,
    emptyTokenTurns: 0,
    turnsWithoutUsage: 0,
    unpricedTurns: 0,
    ...partial,
  });

  it("counts the turns without usage, the records without a price, and the records with no tokens", () => {
    expect(noticeOf(gaps({ emptyTokenTurns: 2, turnsWithoutUsage: 17, unpricedTurns: 1 }))).toBe(
      "Partial data · 17 turns have no reported usage; 1 record has no cost estimate; 2 records have incomplete token data. Known totals may understate actual use.",
    );
  });

  it("counts earlier turns, which were never priced, with the records that have no estimate", () => {
    expect(noticeOf(gaps({ earlierTurns: 3, unpricedTurns: 1 }))).toContain("4 records have no cost estimate");
  });

  it("says so when a filter hides how many turns left no usage", () => {
    expect(noticeOf(gaps({ turnsWithoutUsage: null, unpricedTurns: 1 }))).toContain(
      "turns without usage cannot be counted for the selected harness, model, or account",
    );
  });

  it("is absent when nothing is missing", () => {
    expect(noticeOf(gaps())).toBeNull();
  });
});

describe("captioning a day of the graph", () => {
  const day = (entries: UsageDay["byHarness"]): UsageDay => ({ byHarness: entries, day: "2026-11-06" });
  const priced = { ...emptyAmounts, estimated: 12.3, pricedTurns: 1, turns: 1 };
  const unpriced = {
    ...emptyAmounts,
    pricedTurns: 0,
    tokens: { cacheCreation: 0, cacheRead: 0, input: 5000, output: 0 },
    turns: 2,
  };

  it("says a day had no usage", () => {
    expect(dayCaptionOf(day([]), "Cost")).toEqual({ hasGap: false, text: "Nov 6: no usage" });
  });

  it("gives what each harness used, and marks a harness with turns but no known cost", () => {
    const entries = [
      { amounts: priced, harness: "claude" },
      { amounts: unpriced, harness: "opencode" },
    ] as const;
    expect(dayCaptionOf(day(entries), "Cost")).toEqual({
      hasGap: true,
      text: "Nov 6: Claude Code $12.30, OpenCode no known cost",
    });
    // The same day by tokens has no gap: tokens are known.
    expect(dayCaptionOf(day(entries), "Tokens").hasGap).toBe(false);
  });

  it("tells a day of unpriced turns apart from a day with none", () => {
    expect(dayCaptionOf(day([{ amounts: unpriced, harness: "opencode" }]), "Cost")).toEqual({
      hasGap: true,
      text: "Nov 6: OpenCode no known cost",
    });
  });
});

describe("describing a turn record", () => {
  const record = (partial: Partial<UsageRecord> = {}): UsageRecord => ({
    billing: "Subscription",
    cost: 0.4,
    endedAt: 0,
    harness: "claude",
    isReported: false,
    model: "claude-sonnet-5-5",
    questName: "Port the parser",
    threadTitle: null,
    tokens: { cacheCreation: 0, cacheRead: 0, input: 1, output: 1 },
    turnId: "t",
    ...partial,
  });

  it("names the harness, the model, and how the turn was billed", () => {
    expect(recordDetailOf(record())).toBe("Claude Code · Sonnet 5.5 · Subscription");
    expect(recordDetailOf(record({ billing: "ApiKey" }))).toBe("Claude Code · Sonnet 5.5 · API key");
    expect(recordDetailOf(record({ billing: null }))).toBe("Claude Code · Sonnet 5.5");
  });

  it("says which model has no price when the turn has no cost", () => {
    expect(recordDetailOf(record({ cost: null }))).toBe(
      "Claude Code · Sonnet 5.5 · Subscription · no price for Sonnet 5.5",
    );
  });
});

describe("listing the allowances", () => {
  const global = (partial: Partial<BudgetWindow> = {}) =>
    ({
      limits: { cost: null, tokens: null },
      period: "Month",
      spent: { cost: 0, tokens: 0 },
      ...partial,
    }) as BudgetWindow;
  const account = (partial: Partial<AccountBudget> = {}) =>
    ({
      accountId: null,
      consumption: emptyAmounts,
      harness: "codex",
      label: "This computer",
      lastChange: null,
      limits: { cost: null, tokens: null },
      nextStart: null,
      period: null,
      planLimits: null,
      remaining: { cost: null, tokens: null },
      since: 0,
      spent: { cost: 0, tokens: 0 },
      ...partial,
    }) as AccountBudget;

  it("says so when no global budget is set, and shows each account with its plan limits or that none are reported", () => {
    expect(allowanceLinesOf(global(), [account()])).toEqual({
      isGlobalBudgetSet: false,
      lines: [{ key: "codex:", level: "normal", name: "Codex · This computer", text: "Limits not reported" }],
    });
  });

  it("shows a global limit with what is spent against it, orange from 80% and red when reached", () => {
    const view = allowanceLinesOf(global({ limits: { cost: 10, tokens: null }, spent: { cost: 8.5, tokens: 0 } }), []);
    expect(view.isGlobalBudgetSet).toBe(true);
    expect(view.lines).toEqual([
      { key: "global-cost", level: "warning", name: "Global · month", text: "$8.50 of $10.00" },
    ]);
    expect(
      allowanceLinesOf(global({ limits: { cost: 10, tokens: null }, spent: { cost: 10, tokens: 0 } }), []).lines[0]
        ?.level,
    ).toBe("reached");
  });
});
