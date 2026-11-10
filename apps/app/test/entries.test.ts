import type { MissionDetail, ThreadSummary } from "@gild/contracts";
import { describe, expect, it } from "vitest";
import { entriesOf } from "../src/entries";

const summary = (id: string, parentId: string | null, openedAt: number, isAside = false) =>
  ({
    depth: parentId === null ? 0 : 1,
    id,
    isAside,
    isOpenedByAgent: false,
    openedAt,
    parentId,
    state: "Idle",
    title: id,
    waitingCount: 0,
  }) as ThreadSummary;

const message = (id: string, sentAt: number) => ({ id, sender: "user", sentAt, text: id });

const detailOf = (
  threads: ReadonlyArray<ThreadSummary>,
  selectedId: string,
  handovers: ReadonlyArray<{ at: number; id: string; text: string }> = [],
) =>
  ({
    budgetEvents: [],
    handovers,
    loreChanges: [],
    messages: [message("first", 10), message("second", 30)],
    questions: [],
    suggestions: [],
    thread: { id: selectedId },
    threads,
  }) as unknown as MissionDetail;

describe("the threads opened beneath, in their opener's conversation", () => {
  it("places each thread opened beneath where it was opened, leaving out asides and deeper threads", () => {
    const threads = [
      summary("top", null, 0),
      summary("child", "top", 20),
      summary("aside", "top", 25, true),
      { ...summary("grandchild", "child", 26), depth: 2 },
    ];
    expect(entriesOf(detailOf(threads, "top")).map((entry) => entry.key)).toEqual(["first", "opened:child", "second"]);
  });
  it("shows no opening in a thread with nothing beneath it", () => {
    const threads = [summary("top", null, 0), summary("child", "top", 20)];
    expect(entriesOf(detailOf(threads, "child")).some((entry) => entry._tag === "ThreadOpened")).toBe(false);
  });
});

describe("handovers, in the conversation they changed", () => {
  it("places each handover line between the messages around it", () => {
    const handovers = [{ at: 20, id: "handover-1", text: "Handed over to Codex · default model · default effort" }];
    const entries = entriesOf(detailOf([summary("top", null, 0)], "top", handovers));
    expect(entries.map((entry) => entry.key)).toEqual(["first", "handover-1", "second"]);
  });
});
