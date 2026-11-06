import { describe, expect, it } from "vitest";
import {
  briefingSizeOf,
  budgetUseTextOf,
  deletionQuestionOf,
  foldedLabelOf,
  journalAuthorOf,
  meterLevelOf,
  promptQuestionOf,
  raisedLimitsOf,
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
