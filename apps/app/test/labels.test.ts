import { describe, expect, it } from "vitest";
import {
  briefingSizeOf,
  budgetUseTextOf,
  contextLevelOf,
  contextPartLabels,
  contextUseTextOf,
  deletionQuestionOf,
  foldedLabelOf,
  intelChangeLineOf,
  intelFadingLabelOf,
  intelGaugeLabelOf,
  intelHistoryLineOf,
  intelOriginLabelOf,
  intelProposalLineOf,
  journalAuthorOf,
  meterLevelOf,
  promptQuestionOf,
  raisedLimitsOf,
  startingContextPartsOf,
  startingContextWarningOf,
  suggestionLabels,
  threadCountOf,
  threadSpendingTextOf,
} from "../src/labels";

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

  it("raises each set limit by the factor and leaves an empty one empty", () => {
    expect(raisedLimitsOf({ cost: 2, tokens: null }, 1.5)).toEqual({ cost: 3, tokens: null });
    expect(raisedLimitsOf({ cost: null, tokens: 1000 }, 1.25)).toEqual({ cost: null, tokens: 1250 });
  });
});

describe("intel labels", () => {
  const change = { kind: "Save", previousText: null, scopeLabel: "Global", status: "Done", text: "A fact." } as const;

  it("names each kind of change with its scope and status", () => {
    expect(intelChangeLineOf(change)).toBe("Save lore to Global");
    expect(intelChangeLineOf({ ...change, status: "Awaiting" })).toBe("Save lore to Global · awaiting your approval");
    expect(intelChangeLineOf({ ...change, kind: "Forget", status: "Declined" })).toBe(
      "Delete lore from Global · declined",
    );
    expect(intelChangeLineOf({ ...change, kind: "Update", previousText: "Old.", status: "Approved" })).toBe(
      "Correct lore in Global · approved",
    );
    expect(intelChangeLineOf({ ...change, kind: "Update", previousText: "A fact." })).toBe("Move lore to Global");
    expect(intelChangeLineOf({ ...change, kind: "Replace", previousText: "Old.", status: "Awaiting" })).toBe(
      "Replace lore in Global · awaiting your approval",
    );
  });

  it("names what an intel rests on", () => {
    expect(intelOriginLabelOf(null)).toBeNull();
    expect(intelOriginLabelOf({ entryNumber: 4, excerpt: "Chose Effect.", from: null, kind: "JournalEntry" })).toBe(
      "From journal entry 4: Chose Effect.",
    );
    expect(intelOriginLabelOf({ entryNumber: null, excerpt: "Use Bun.", from: null, kind: "Message" })).toBe(
      "From your message: Use Bun.",
    );
    expect(intelOriginLabelOf({ entryNumber: null, excerpt: "Done.", from: "Build", kind: "Message" })).toBe(
      'From a message by "Build": Done.',
    );
  });

  it("gives the intel count and its share of the context window", () => {
    expect(intelGaugeLabelOf({ count: 0, tokens: 0, windowTokens: 200_000 })).toBe("Lore · 0 · 0%");
    expect(intelGaugeLabelOf({ count: 2, tokens: 100, windowTokens: 200_000 })).toBe("Lore · 2 · <0.1%");
    expect(intelGaugeLabelOf({ count: 9, tokens: 21_000, windowTokens: 200_000 })).toBe("Lore · 9 · 10.5%");
  });

  it("names an intel's kind, state, strength, uses, and pin", () => {
    const intel = { isPinned: false, kind: "Preference", state: "Active", strength: 0.816, uses: 0 } as const;
    expect(intelFadingLabelOf(intel)).toBe("Preference · active · strength 82% · not used yet");
    expect(intelFadingLabelOf({ ...intel, uses: 1 })).toBe("Preference · active · strength 82% · used once");
    expect(intelFadingLabelOf({ ...intel, isPinned: true, strength: 1, uses: 3 })).toBe(
      "Preference · active · strength 100% · used 3 times · pinned",
    );
  });
});

describe("intel history lines", () => {
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
    expect(intelHistoryLineOf(entry)).toBe('Saved by "Build"');
    expect(intelHistoryLineOf({ ...entry, approvedAt: 1 })).toBe('Saved by "Build" · approved by you');
    expect(intelHistoryLineOf({ ...entry, kind: "Replaced" })).toBe('Replaced by a save from "Build"');
    expect(intelHistoryLineOf({ ...entry, kind: "Widened" })).toBe('Moved to Global by "Build"');
    expect(intelHistoryLineOf({ ...entry, actor: "Owner", actorTitle: null, kind: "Deleted" })).toBe("Deleted by you");
  });

  it("says a fading step was fading, and names what an undo undid", () => {
    expect(intelHistoryLineOf({ ...entry, actor: "Fading", actorTitle: null, kind: "Dormant" })).toBe(
      "Became dormant by fading",
    );
    expect(intelHistoryLineOf({ ...entry, actor: "Owner", actorTitle: null, kind: "Undone", undid: "Deleted" })).toBe(
      "You undid: deleted",
    );
    expect(intelHistoryLineOf({ ...entry, undoneAt: 2 })).toBe('Saved by "Build" · undone');
  });

  it("says where an approved proposal moved or merged an intel", () => {
    const owner = { ...entry, actor: "Owner", actorTitle: null } as const;
    expect(intelHistoryLineOf({ ...owner, kind: "Narrowed", scopeLabel: "Workspace alpha" })).toBe(
      "Moved to Realm alpha by you",
    );
    expect(intelHistoryLineOf({ ...owner, kind: "Merged" })).toBe("Merged into one global lore entry by you");
  });
});

describe("intel proposal labels", () => {
  it("says what a widening merges and why a narrowing moves an intel", () => {
    const widen = { halfLifeDays: null, intels: [{}, {}], kind: "Widen", scopeLabel: "Global", uses: null } as const;
    expect(intelProposalLineOf(widen)).toBe("Saved separately in 2 realms: make it one global lore entry");
    expect(
      intelProposalLineOf({ halfLifeDays: 45, intels: [{}], kind: "Narrow", scopeLabel: "Workspace alpha", uses: 1 }),
    ).toBe("Used only in Realm alpha for 45 days, once: move it there");
    expect(
      intelProposalLineOf({ halfLifeDays: 45, intels: [{}], kind: "Narrow", scopeLabel: "Workspace alpha", uses: 3 }),
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
      intel: 20,
      journal: 50,
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

  it("says what a thread spent in the units it used, leaving out an unused one", () => {
    expect(threadSpendingTextOf({ spending: { cost: 1.5, tokens: 0 }, turnCount: 1 })).toBe("1 turn · $1.50");
    expect(threadSpendingTextOf({ spending: { cost: 0, tokens: 12_000 }, turnCount: 3 })).toBe(
      "3 turns · 12,000 tokens",
    );
    expect(threadSpendingTextOf({ spending: { cost: 0, tokens: 0 }, turnCount: 0 })).toBe("0 turns");
  });
});
