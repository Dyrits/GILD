import { describe, expect, it } from "vitest";
import {
  accountBudgetTextOf,
  briefingSizeOf,
  budgetUseTextOf,
  consumptionDetailsOf,
  contextLevelOf,
  contextPartLabels,
  contextUseTextOf,
  costTextOf,
  countedOf,
  deletionQuestionOf,
  foldedLabelOf,
  journalAuthorOf,
  loreChangeLineOf,
  loreFadingLabelOf,
  loreGaugeLabelOf,
  loreHistoryLineOf,
  loreOriginLabelOf,
  loreProposalLineOf,
  meterLevelOf,
  planLimitsSummaryOf,
  planLimitTextOf,
  priceStatusTextOf,
  promptQuestionOf,
  raisedLimitsOf,
  replyUsageTextOf,
  reserveOf,
  startingContextPartsOf,
  startingContextWarningOf,
  suggestionLabels,
  threadCountOf,
  threadSpendingTextOf,
  usedTextOf,
} from "../../src/foundation/labels";

describe("counted nouns", () => {
  it("names one in the singular", () => {
    expect(countedOf(1, "step")).toBe("1 step");
  });

  it("names none or many in the plural", () => {
    expect(countedOf(0, "step")).toBe("0 steps");
    expect(countedOf(3, "step")).toBe("3 steps");
  });
});

describe("tree and deletion labels", () => {
  it("names one folded side-quest in the singular", () => {
    expect(foldedLabelOf(1)).toBe("+1 side-quest");
    expect(foldedLabelOf(3)).toBe("+3 side-quests");
  });

  it("names the top-level work as a quest in deletion confirmation", () => {
    expect(deletionQuestionOf({ descendantCount: 1, isMission: true, runningCount: 0 })).toBe(
      "Delete this quest and 1 side-quest beneath it?",
    );
  });

  it("asks about the side-quests beneath, naming running ones only when some run", () => {
    expect(deletionQuestionOf({ descendantCount: 0, isMission: false, runningCount: 0 })).toBe(
      "Delete this side-quest?",
    );
    expect(deletionQuestionOf({ descendantCount: 0, isMission: false, runningCount: 1 })).toBe(
      "Delete this side-quest (running)?",
    );
    expect(deletionQuestionOf({ descendantCount: 1, isMission: false, runningCount: 0 })).toBe(
      "Delete this side-quest and 1 side-quest beneath it?",
    );
    expect(deletionQuestionOf({ descendantCount: 5, isMission: false, runningCount: 2 })).toBe(
      "Delete this side-quest and 5 side-quests beneath it (2 running)?",
    );
  });
});

describe("journal labels", () => {
  it("names the owner as You and work by its title", () => {
    expect(journalAuthorOf({ authorKind: "user", authorTitle: null })).toBe("You");
    expect(journalAuthorOf({ authorKind: "thread", authorTitle: "Count files" })).toBe('"Count files"');
  });

  it("shows the briefing's size against its limit, and when it is over", () => {
    expect(briefingSizeOf(120, 2000)).toBe("About 120 of 2,000 tokens");
    expect(briefingSizeOf(2100, 2000)).toBe("About 2,100 of 2,000 tokens: over the limit");
  });
});

describe("dashboard labels", () => {
  it("counts a quest and its side-quests, naming running ones only when some run", () => {
    expect(threadCountOf({ runningCount: 0, threadCount: 1 })).toBe("1 quest · 0 side-quests");
    expect(threadCountOf({ runningCount: 2, threadCount: 5 })).toBe("1 quest · 4 side-quests · 2 running");
  });

  it("asks Mark as done after a result, and about inactivity in days", () => {
    expect(promptQuestionOf("MarkDone", 14)).toBe("Mark as done?");
    expect(promptQuestionOf("Inactive", 14)).toBe("No activity for 14 days. Archive it or mark it as done?");
    expect(promptQuestionOf("Inactive", 1)).toBe("No activity for 1 day. Archive it or mark it as done?");
  });
});

describe("off-topic suggestion lines", () => {
  it("says where the off-topic message went", () => {
    expect(suggestionLabels.Continued).toBe("Continued in quest");
    expect(suggestionLabels.MovedToMission).toBe("Moved to quest");
    expect(suggestionLabels.KeptAsAside).toBe("Kept as aside");
  });
});

describe("budget meters", () => {
  it("turns orange from 80% and red at 100%", () => {
    expect(meterLevelOf(79, 100)).toBe("normal");
    expect(meterLevelOf(80, 100)).toBe("warning");
    expect(meterLevelOf(100, 100)).toBe("reached");
  });

  it("says a limit's use in its own unit, never pricing tokens", () => {
    expect(budgetUseTextOf("cost", 1.2, 5)).toBe("$1.20 of $5.00");
    expect(budgetUseTextOf("tokens", 12000, 50000)).toBe("12,000 of 50,000 tokens");
  });

  it("says what a limit leaves, never below nothing", () => {
    expect(reserveOf("cost", 2.4, 15)).toEqual({ fraction: 0.84, text: "$12.60 left" });
    expect(reserveOf("tokens", 62, 100)).toEqual({ fraction: 0.38, text: "38% left" });
    expect(reserveOf("cost", 20, 15)).toEqual({ fraction: 0, text: "$0.00 left" });
  });

  it("raises each set limit by the factor and leaves an empty one empty", () => {
    expect(raisedLimitsOf({ cost: 2, tokens: null }, 1.5)).toEqual({ cost: 3, tokens: null });
    expect(raisedLimitsOf({ cost: null, tokens: 1000 }, 1.25)).toEqual({ cost: null, tokens: 1250 });
  });
});

describe("lore labels", () => {
  const change = { kind: "Save", previousText: null, scopeLabel: "Global", status: "Done", text: "A fact." } as const;

  it("names each kind of change with its scope and status", () => {
    expect(loreChangeLineOf(change)).toBe("Save lore to Global");
    expect(loreChangeLineOf({ ...change, status: "Awaiting" })).toBe("Save lore to Global · awaiting your approval");
    expect(loreChangeLineOf({ ...change, kind: "Forget", status: "Declined" })).toBe(
      "Delete lore from Global · declined",
    );
    expect(loreChangeLineOf({ ...change, kind: "Update", previousText: "Old.", status: "Approved" })).toBe(
      "Correct lore in Global · approved",
    );
    expect(loreChangeLineOf({ ...change, kind: "Update", previousText: "A fact." })).toBe("Move lore to Global");
    expect(loreChangeLineOf({ ...change, kind: "Replace", previousText: "Old.", status: "Awaiting" })).toBe(
      "Replace lore in Global · awaiting your approval",
    );
  });

  it("names what a lore entry rests on", () => {
    expect(loreOriginLabelOf(null)).toBeNull();
    expect(loreOriginLabelOf({ entryNumber: 4, excerpt: "Chose Effect.", from: null, kind: "JournalEntry" })).toBe(
      "From journal entry 4: Chose Effect.",
    );
    expect(loreOriginLabelOf({ entryNumber: null, excerpt: "Use Bun.", from: null, kind: "Message" })).toBe(
      "From your message: Use Bun.",
    );
    expect(loreOriginLabelOf({ entryNumber: null, excerpt: "Done.", from: "Build", kind: "Message" })).toBe(
      'From a message by "Build": Done.',
    );
  });

  it("gives the lore count and its share of the context window", () => {
    expect(loreGaugeLabelOf({ count: 0, tokens: 0, windowTokens: 200_000 })).toBe("Lore · 0 · 0%");
    expect(loreGaugeLabelOf({ count: 2, tokens: 100, windowTokens: 200_000 })).toBe("Lore · 2 · <0.1%");
    expect(loreGaugeLabelOf({ count: 9, tokens: 21_000, windowTokens: 200_000 })).toBe("Lore · 9 · 10.5%");
  });

  it("names a lore entry's kind, state, strength, uses, and pin", () => {
    const loreEntry = { isPinned: false, kind: "Preference", state: "Active", strength: 0.816, uses: 0 } as const;
    expect(loreFadingLabelOf(loreEntry)).toBe("Preference · active · strength 82% · not used yet");
    expect(loreFadingLabelOf({ ...loreEntry, uses: 1 })).toBe("Preference · active · strength 82% · used once");
    expect(loreFadingLabelOf({ ...loreEntry, isPinned: true, strength: 1, uses: 3 })).toBe(
      "Preference · active · strength 100% · used 3 times · pinned",
    );
  });
});

describe("lore history lines", () => {
  const entry = {
    actor: "Thread",
    actorTitle: "Build",
    approvedAt: null,
    kind: "Saved",
    scopeLabel: "Global",
    undid: null,
    undoneAt: null,
  } as const;

  it("names who made each entry, and the owner's approval", () => {
    expect(loreHistoryLineOf(entry)).toBe('Saved by "Build"');
    expect(loreHistoryLineOf({ ...entry, approvedAt: 1 })).toBe('Saved by "Build" · approved by you');
    expect(loreHistoryLineOf({ ...entry, kind: "Replaced" })).toBe('Replaced by a save from "Build"');
    expect(loreHistoryLineOf({ ...entry, kind: "Widened" })).toBe('Moved to Global by "Build"');
    expect(loreHistoryLineOf({ ...entry, actor: "Owner", actorTitle: null, kind: "Deleted" })).toBe("Deleted by you");
  });

  it("says a fading step was fading, and names what an undo undid", () => {
    expect(loreHistoryLineOf({ ...entry, actor: "Fading", actorTitle: null, kind: "Dormant" })).toBe(
      "Became dormant by fading",
    );
    expect(loreHistoryLineOf({ ...entry, actor: "Owner", actorTitle: null, kind: "Undone", undid: "Deleted" })).toBe(
      "You undid: deleted",
    );
    expect(loreHistoryLineOf({ ...entry, undoneAt: 2 })).toBe('Saved by "Build" · undone');
  });

  it("says where an approved proposal moved or merged a lore entry", () => {
    const owner = { ...entry, actor: "Owner", actorTitle: null } as const;
    expect(loreHistoryLineOf({ ...owner, kind: "Narrowed", scopeLabel: "Workspace alpha" })).toBe(
      "Moved to Realm alpha by you",
    );
    expect(loreHistoryLineOf({ ...owner, kind: "Merged" })).toBe("Merged into one global lore entry by you");
  });
});

describe("lore proposal labels", () => {
  it("says what a widening merges and why a narrowing moves a lore entry", () => {
    const widen = {
      halfLifeDays: null,
      kind: "Widen",
      loreEntries: [{}, {}],
      scopeLabel: "Global",
      uses: null,
    } as const;
    expect(loreProposalLineOf(widen)).toBe("Saved separately in 2 realms: make it one global lore entry");
    expect(
      loreProposalLineOf({
        halfLifeDays: 45,
        kind: "Narrow",
        loreEntries: [{}],
        scopeLabel: "Workspace alpha",
        uses: 1,
      }),
    ).toBe("Used only in Realm alpha for 45 days, once: move it there");
    expect(
      loreProposalLineOf({
        halfLifeDays: 45,
        kind: "Narrow",
        loreEntries: [{}],
        scopeLabel: "Workspace alpha",
        uses: 3,
      }),
    ).toBe("Used only in Realm alpha for 45 days, 3 times: move it there");
  });
});

describe("starting context labels", () => {
  const context = {
    isOverWarning: true,
    largerModels: [],
    parts: {
      budget: 30,
      instructions: 2_400,
      journal: 50,
      lore: 20,
      openerMessages: 71_800,
      position: 20,
      request: 100,
      workspace: 580,
    },
    tokens: 75_000,
    warningPercent: 25,
    windowTokens: 200_000,
  } as const;

  it("says how much of the context window a new side-quest would start with", () => {
    expect(startingContextWarningOf(context)).toBe(
      "This side-quest would start with about 75,000 tokens, 38% of the model's 200,000-token context window; the warning is at 25%.",
    );
  });

  it("lists each part of the starting context with its tokens", () => {
    expect(startingContextPartsOf(context.parts)).toBe(
      "Request 100 · Journal 50 · Lore 20 · Opener's messages 71,800 · Realm 580 · Instructions 2,400 · Title and budget 50 tokens",
    );
  });
});

describe("thread panel labels", () => {
  it("turns the context gauge orange from 80% and red from 95%", () => {
    expect(contextLevelOf(159_999, 200_000)).toBe("normal");
    expect(contextLevelOf(160_000, 200_000)).toBe("warning");
    expect(contextLevelOf(189_999, 200_000)).toBe("warning");
    expect(contextLevelOf(190_000, 200_000)).toBe("reached");
  });

  it("says the gauge against the window with its share", () => {
    expect(contextUseTextOf({ tokens: 75_000, windowTokens: 200_000 })).toBe("75,000 of 200,000 tokens · 37.5%");
  });

  it("names the part that holds tool calls and their results in words", () => {
    expect(contextPartLabels.ToolsAndResults).toBe("Tools and results");
  });

  it("says what a thread used with its cost marked as reported or estimated, leaving out an unused part", () => {
    const tokens = { cacheCreation: 0, cacheRead: 0, input: 12_000, output: 0 };
    const none = { earlierTurns: 0, estimated: 0, reported: 0, unpricedTurns: 0 };
    expect(threadSpendingTextOf({ consumption: { ...none, reported: 1.5, tokens, turns: 1 } })).toBe(
      "1 turn · $1.50 · 12,000 tokens",
    );
    expect(threadSpendingTextOf({ consumption: { ...none, estimated: 0.8, tokens, turns: 3 } })).toBe(
      "3 turns · ≈ $0.80 · 12,000 tokens",
    );
    expect(threadSpendingTextOf({ consumption: { ...none, tokens: { ...tokens, input: 0 }, turns: 0 } })).toBe(
      "0 turns",
    );
  });
});

describe("a cost marked as reported or estimated", () => {
  it("shows a cost the harness reported as it is", () => {
    expect(costTextOf({ estimated: 0, reported: 1.2 })).toBe("$1.20");
  });

  it("marks an estimate, and a total that holds any estimate, with ≈", () => {
    expect(costTextOf({ estimated: 1.2, reported: 0 })).toBe("≈ $1.20");
    expect(costTextOf({ estimated: 0.8, reported: 2 })).toBe("≈ $2.80");
  });

  it("shows a cost under half a cent as less than a cent, never as $0.00", () => {
    expect(costTextOf({ estimated: 0.0008, reported: 0 })).toBe("≈ < $0.01");
    expect(costTextOf({ estimated: 0, reported: 0.001 })).toBe("< $0.01");
  });

  it("shows no cost when nothing is priced", () => {
    expect(costTextOf({ estimated: 0, reported: 0 })).toBeNull();
  });

  it("says in the details how much was reported and how much estimated, and what is not priced", () => {
    const tokens = { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 };
    expect(
      consumptionDetailsOf({ earlierTurns: 5, estimated: 0.8, reported: 2, tokens, turns: 9, unpricedTurns: 2 }),
    ).toBe("$2.00 reported · ≈ $0.80 estimated · 2 turns without a price · 5 earlier turns not priced");
    expect(
      consumptionDetailsOf({ earlierTurns: 0, estimated: 0, reported: 0, tokens, turns: 1, unpricedTurns: 0 }),
    ).toBe("");
  });
});

describe("what a set of turns used in one line", () => {
  const tokens = { cacheCreation: 0, cacheRead: 0, input: 12_000, output: 0 };
  const none = { earlierTurns: 0, estimated: 0, reported: 0, turns: 1, unpricedTurns: 0 };

  it("says the tokens first and the marked cost after", () => {
    expect(usedTextOf({ ...none, estimated: 1.2, tokens })).toBe("12,000 tokens · ≈ $1.20");
    expect(usedTextOf({ ...none, reported: 1.2, tokens })).toBe("12,000 tokens · $1.20");
  });

  it("says only the tokens when no turn is priced", () => {
    expect(usedTextOf({ ...none, tokens })).toBe("12,000 tokens");
  });
});

describe("the line saying where the model prices come from", () => {
  const at = new Date(2026, 10, 10, 14, 2).getTime();

  it("names the public table and when it was read", () => {
    expect(priceStatusTextOf({ at, isFetching: true, models: 300, source: "Fetched" })).toBe(
      "Prices from models.dev · fetched 10 Nov",
    );
  });

  it("names the snapshot shipped with Gild and when it was made", () => {
    expect(priceStatusTextOf({ at, isFetching: false, models: 300, source: "Snapshot" })).toBe(
      "Prices from the snapshot of 10 Nov",
    );
  });
});

describe("an account's budget in one line", () => {
  const tokens = { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 };
  const consumption = { earlierTurns: 0, estimated: 0, reported: 0, tokens, turns: 0, unpricedTurns: 0 };
  const budget = {
    consumption,
    limits: { cost: null, tokens: null },
    period: null,
    remaining: { cost: null, tokens: null },
    spent: { cost: 0, tokens: 0 },
  };

  it("says there is none when no limit is set", () => {
    expect(accountBudgetTextOf(budget)).toBe("No budget · counted by Gild");
  });

  it("says what is left of credits", () => {
    expect(
      accountBudgetTextOf({
        ...budget,
        limits: { cost: 50, tokens: null },
        remaining: { cost: 37.5, tokens: null },
        spent: { cost: 12.5, tokens: 0 },
      }),
    ).toBe("$12.50 of $50.00 · $37.50 left · counted by Gild");
  });

  it("marks what is left with ≈ when some of the spending was estimated", () => {
    expect(
      accountBudgetTextOf({
        ...budget,
        consumption: { ...consumption, estimated: 1 },
        limits: { cost: 50, tokens: null },
        remaining: { cost: 31, tokens: null },
        spent: { cost: 19, tokens: 0 },
      }),
    ).toBe("$19.00 of $50.00 · ≈ $31.00 left · counted by Gild");
  });

  it("says the tokens used of a token limit and the share left in its period", () => {
    expect(
      accountBudgetTextOf({
        ...budget,
        limits: { cost: null, tokens: 10_000 },
        period: "Month",
        remaining: { cost: null, tokens: 8_000 },
        spent: { cost: 0, tokens: 2_000 },
      }),
    ).toBe("2,000 of 10,000 tokens · 80% left this month · counted by Gild");
  });
});

describe("a plan's limits in words", () => {
  const at = new Date(2026, 10, 10, 14, 2).getTime();
  const reset = new Date(2026, 10, 10, 19, 30).getTime();

  it("says a window's use and when it resets", () => {
    expect(planLimitTextOf({ label: "5-hour", resetsAt: reset, usedPercent: 40 })).toBe(
      "5-hour · 40% used · resets 19:30",
    );
  });

  it("sums a plan up as its windows with the time of the reading", () => {
    expect(
      planLimitsSummaryOf({
        readAt: at,
        windows: [
          { label: "5-hour", resetsAt: reset, usedPercent: 40 },
          { label: "Weekly", resetsAt: reset, usedPercent: 93 },
        ],
      }),
    ).toBe("5-hour 40% · Weekly 93% · as of 14:02");
  });

  it("says the limits are not reported, never guessing them", () => {
    expect(planLimitsSummaryOf(null)).toBe("Limits not reported");
  });
});

describe("the line under an agent reply", () => {
  const tokens = { cacheCreation: 200, cacheRead: 800, input: 100, output: 140 };

  it("says every token of the call and an estimate marked with ≈", () => {
    expect(replyUsageTextOf({ estimated: 0.02, reported: null, tokens })).toBe("1,240 tokens · ≈ $0.02");
  });

  it("says a cost the turn reported as it is", () => {
    expect(replyUsageTextOf({ estimated: null, reported: 1.25, tokens })).toBe("1,240 tokens · $1.25");
  });

  it("says only the tokens when no price is known", () => {
    expect(replyUsageTextOf({ estimated: null, reported: null, tokens })).toBe("1,240 tokens");
  });
});
