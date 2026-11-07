import { describe, expect, it } from "vitest";
import {
  briefingSizeOf,
  budgetUseTextOf,
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
} from "../src/labels";

describe("tree and deletion labels", () => {
  it("names one folded thread in the singular", () => {
    expect(foldedLabelOf(1)).toBe("+1 thread");
    expect(foldedLabelOf(3)).toBe("+3 threads");
  });

  it("asks about the threads beneath, naming running ones only when some run", () => {
    expect(deletionQuestionOf({ descendantCount: 0, runningCount: 0 })).toBe("Delete this thread?");
    expect(deletionQuestionOf({ descendantCount: 0, runningCount: 1 })).toBe("Delete this thread (running)?");
    expect(deletionQuestionOf({ descendantCount: 1, runningCount: 0 })).toBe(
      "Delete this thread and 1 thread beneath it?",
    );
    expect(deletionQuestionOf({ descendantCount: 5, runningCount: 2 })).toBe(
      "Delete this thread and 5 threads beneath it (2 running)?",
    );
  });
});

describe("journal labels", () => {
  it("names the owner as You and a thread by its title", () => {
    expect(journalAuthorOf({ authorKind: "user", authorTitle: null })).toBe("You");
    expect(journalAuthorOf({ authorKind: "thread", authorTitle: "Count files" })).toBe('Thread "Count files"');
  });

  it("shows the briefing's size against its limit, and when it is over", () => {
    expect(briefingSizeOf(120, 2000)).toBe("About 120 of 2,000 tokens");
    expect(briefingSizeOf(2100, 2000)).toBe("About 2,100 of 2,000 tokens: over the limit");
  });
});

describe("dashboard labels", () => {
  it("counts a mission's threads, naming running ones only when some run", () => {
    expect(threadCountOf({ runningCount: 0, threadCount: 1 })).toBe("1 thread");
    expect(threadCountOf({ runningCount: 2, threadCount: 5 })).toBe("5 threads · 2 running");
  });

  it("asks Mark as done after a result, and about inactivity in days", () => {
    expect(promptQuestionOf("MarkDone", 14)).toBe("Mark as done?");
    expect(promptQuestionOf("Inactive", 14)).toBe("No activity for 14 days. Archive it or mark it as done?");
    expect(promptQuestionOf("Inactive", 1)).toBe("No activity for 1 day. Archive it or mark it as done?");
  });
});

describe("off-topic suggestion lines", () => {
  it("says where the off-topic message went", () => {
    expect(suggestionLabels.Continued).toBe("Continued in mission");
    expect(suggestionLabels.MovedToMission).toBe("Moved to mission");
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
    expect(intelChangeLineOf(change)).toBe("Save intel to Global");
    expect(intelChangeLineOf({ ...change, status: "Awaiting" })).toBe("Save intel to Global · awaiting your approval");
    expect(intelChangeLineOf({ ...change, kind: "Forget", status: "Declined" })).toBe(
      "Delete intel from Global · declined",
    );
    expect(intelChangeLineOf({ ...change, kind: "Update", previousText: "Old.", status: "Approved" })).toBe(
      "Correct intel in Global · approved",
    );
    expect(intelChangeLineOf({ ...change, kind: "Update", previousText: "A fact." })).toBe("Move intel to Global");
    expect(intelChangeLineOf({ ...change, kind: "Replace", previousText: "Old.", status: "Awaiting" })).toBe(
      "Replace intel in Global · awaiting your approval",
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
    expect(intelGaugeLabelOf({ count: 0, tokens: 0, windowTokens: 200_000 })).toBe("Intel · 0 · 0%");
    expect(intelGaugeLabelOf({ count: 2, tokens: 100, windowTokens: 200_000 })).toBe("Intel · 2 · <0.1%");
    expect(intelGaugeLabelOf({ count: 9, tokens: 21_000, windowTokens: 200_000 })).toBe("Intel · 9 · 10.5%");
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
      "Moved to Workspace alpha by you",
    );
    expect(intelHistoryLineOf({ ...owner, kind: "Merged" })).toBe("Merged into one global intel by you");
  });
});

describe("intel proposal labels", () => {
  it("says what a widening merges and why a narrowing moves an intel", () => {
    const widen = { halfLifeDays: null, intels: [{}, {}], kind: "Widen", scopeLabel: "Global", uses: null } as const;
    expect(intelProposalLineOf(widen)).toBe("Saved separately in 2 workspaces: make it one global intel");
    expect(
      intelProposalLineOf({ halfLifeDays: 45, intels: [{}], kind: "Narrow", scopeLabel: "Workspace alpha", uses: 1 }),
    ).toBe("Used only in Workspace alpha for 45 days, once: move it there");
    expect(
      intelProposalLineOf({ halfLifeDays: 45, intels: [{}], kind: "Narrow", scopeLabel: "Workspace alpha", uses: 3 }),
    ).toBe("Used only in Workspace alpha for 45 days, 3 times: move it there");
  });
});

describe("starting context labels", () => {
  const context = {
    isOverWarning: true,
    largerModels: [],
    parts: { intel: 20, journal: 50, openerMessages: 74_830, request: 100 },
    tokens: 75_000,
    warningPercent: 25,
    windowTokens: 200_000,
  } as const;

  it("says how much of the context window a new thread would start with", () => {
    expect(startingContextWarningOf(context)).toBe(
      "This thread would start with about 75,000 tokens, 38% of the model's 200,000-token context window; the warning is at 25%.",
    );
  });

  it("lists each part of the starting context with its tokens", () => {
    expect(startingContextPartsOf(context.parts)).toBe(
      "Request 100 · Journal 50 · Intel 20 · Opener's messages 74,830 tokens",
    );
  });
});
