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

describe("links from the Guildmaster's conversation, after its replies", () => {
  const guildmasterDetail = (messages: ReadonlyArray<object>, suggestions: ReadonlyArray<object> = []) =>
    ({
      budgetEvents: [],
      handovers: [],
      loreChanges: [],
      messages,
      mission: { id: "guildmaster" },
      questions: [],
      suggestions,
      thread: { id: "top" },
      threads: [summary("top", null, 0)],
    }) as unknown as MissionDetail;
  const owner = (sentAt: number) => ({ id: "owner", sender: "user", sentAt, text: "Fix it" });
  const reply = (sentAt: number) => ({ id: "reply", sender: "agent", sentAt, text: "I opened a quest" });
  const opened = (extra: object = {}) => ({
    askedAt: 15,
    id: "opened",
    isFromGuildmaster: true,
    outcome: "MovedToMission",
    resolvedAt: 16,
    ...extra,
  });
  const report = (sentAt: number, fromMissionId: string | null = "quest-1") => ({
    fromMissionId,
    fromTitle: "Delete a ritual",
    id: `report-${sentAt}`,
    sender: "thread",
    sentAt,
    text: "Quest failed",
  });

  it("puts what the Guildmaster opened after its confirmation, not before", () => {
    const entries = entriesOf(guildmasterDetail([owner(10), reply(30)], [opened()]));
    expect(entries.map((entry) => entry.key)).toEqual(["owner", "reply", "opened"]);
  });

  it("keeps it where it happened until the confirmation is written", () => {
    const entries = entriesOf(guildmasterDetail([owner(10)], [opened()]));
    expect(entries.map((entry) => entry.key)).toEqual(["owner", "opened"]);
  });

  it("leaves an open question where it was asked, and another thread's suggestions where they were made", () => {
    const open = opened({ outcome: null, resolvedAt: null });
    expect(entriesOf(guildmasterDetail([owner(10), reply(30)], [open])).map((entry) => entry.key)).toEqual([
      "owner",
      "opened",
      "reply",
    ]);
    const ordinary = opened({ isFromGuildmaster: false });
    expect(entriesOf(guildmasterDetail([owner(10), reply(30)], [ordinary])).map((entry) => entry.key)).toEqual([
      "owner",
      "opened",
      "reply",
    ]);
  });

  it("follows each report from a quest with a link to that quest, after the Guildmaster's reply to it", () => {
    const entries = entriesOf(guildmasterDetail([report(10), reply(30)]));
    expect(entries.map((entry) => entry.key)).toEqual(["report-10", "reply", "link:report-10"]);
    expect(entries.at(-1)).toMatchObject({ _tag: "QuestLink", missionId: "quest-1", title: "Delete a ritual" });
  });

  it("links a later report after the reply to that one, and none for a message with no quest of its own", () => {
    const entries = entriesOf(
      guildmasterDetail([
        report(10),
        { ...reply(30), id: "reply-1" },
        report(40),
        { ...reply(60), id: "reply-2" },
        report(70, null),
      ]),
    );
    expect(entries.map((entry) => entry.key)).toEqual([
      "report-10",
      "reply-1",
      "link:report-10",
      "report-40",
      "reply-2",
      "link:report-40",
      "report-70",
    ]);
  });
});
