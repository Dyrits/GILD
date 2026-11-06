import { describe, expect, it } from "vitest";
import { deletionQuestionOf, foldedLabelOf } from "../src/labels";

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
