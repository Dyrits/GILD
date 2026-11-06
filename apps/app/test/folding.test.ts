import { ThreadSummary } from "@openmission/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { foldThreads } from "../src/folding";

const thread = (id: string, parentId: string | null, depth: number, isOpenedByAgent = true, state = "Idle") =>
  Schema.decodeUnknownSync(ThreadSummary)({
    depth,
    id,
    isAside: false,
    isOpenedByAgent,
    parentId,
    state,
    title: id,
    waitingCount: 0,
  });
const tree = [
  thread("top", null, 0, false),
  thread("agent", "top", 1),
  thread("deep", "agent", 2),
  thread("owner", "agent", 2, false),
  thread("urgent", "deep", 3, true, "Attention"),
  thread("failed", "deep", 3, true, "Failed"),
];
describe("projecting the folded side tree", () => {
  it("counts folded threads at every depth and keeps owner-opened and urgent threads visible", () => {
    const folded = foldThreads(tree, false, new Set());
    expect(folded.map((row) => row.thread.id)).toEqual(["top", "owner", "urgent", "failed"]);
    expect(folded[0]?.foldedCount).toBe(2);
    expect(folded.map((row) => row.depth)).toEqual([0, 1, 1, 1]);
  });
  it("unfolds the selected opener's whole hidden branch", () => {
    expect(foldThreads(tree, false, new Set(["top"])).map((row) => row.thread.id)).toEqual(tree.map((t) => t.id));
    expect(foldThreads(tree, true, new Set()).every((row) => row.foldedCount === 0)).toBe(true);
  });
});
