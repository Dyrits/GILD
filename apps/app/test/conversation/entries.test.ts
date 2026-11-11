import type { MissionDetail, ThreadSummary } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { entriesOf, workingLabelOf } from "../../src/conversation/entries";

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

describe("links from the Guildmaster's conversation, beside its replies", () => {
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
    isRitual: false,
    outcome: "MovedToMission",
    resolvedAt: 16,
    targetMissionId: "quest-1",
    targetTitle: "Fix login",
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
  const shapeOf = (entries: ReturnType<typeof entriesOf>) => entries.map((entry) => entry.key);

  it("stands what the Guildmaster opened as a card just after its confirmation, not before it", () => {
    const entries = entriesOf(guildmasterDetail([owner(10), reply(30)], [opened()]));
    expect(shapeOf(entries)).toEqual(["owner", "reply", "opened"]);
    expect(entries.at(-1)).toMatchObject({
      _tag: "QuestLink",
      label: "Opened quest",
      missionId: "quest-1",
      title: "Fix login",
    });
  });

  it("names a quest it continued and a Ritual it created as such", () => {
    const labelOf = (extra: object) => {
      const last = entriesOf(guildmasterDetail([owner(10), reply(30)], [opened(extra)])).at(-1);
      return last?._tag === "QuestLink" ? last.label : null;
    };
    expect(labelOf({ outcome: "Continued" })).toBe("Continued in quest");
    expect(labelOf({ isRitual: true })).toBe("Created Ritual");
  });

  it("shows the card where it happened until the confirmation is written", () => {
    const entries = entriesOf(guildmasterDetail([owner(10)], [opened()]));
    expect(shapeOf(entries)).toEqual(["owner", "opened"]);
    expect(entries.at(-1)).toMatchObject({ _tag: "QuestLink", label: "Opened quest", missionId: "quest-1" });
  });

  it("leaves an open question where it was asked, and another thread's suggestions where they were made", () => {
    const open = opened({ outcome: null, resolvedAt: null });
    expect(shapeOf(entriesOf(guildmasterDetail([owner(10), reply(30)], [open])))).toEqual(["owner", "opened", "reply"]);
    const ordinary = opened({ isFromGuildmaster: false });
    expect(shapeOf(entriesOf(guildmasterDetail([owner(10), reply(30)], [ordinary])))).toEqual([
      "owner",
      "opened",
      "reply",
    ]);
  });

  it("gives a report from a quest its own button", () => {
    const entries = entriesOf(guildmasterDetail([report(10), reply(30)]));
    expect(shapeOf(entries)).toEqual(["report-10", "reply"]);
    expect(entries[0]).toMatchObject({ fromQuest: "quest-1" });
  });

  it("gives a report a button only when it names a quest of its own", () => {
    const entries = entriesOf(guildmasterDetail([report(10), report(40, null)]));
    expect(entries.map((entry) => (entry._tag === "Message" ? entry.fromQuest : "other"))).toEqual(["quest-1", null]);
  });
});

describe("a turn's actions, folded as steps while messages stay visible", () => {
  const turn = (messages: ReadonlyArray<object>) =>
    ({
      budgetEvents: [],
      handovers: [],
      loreChanges: [],
      messages: messages.map((entry, sequence) => ({ sequence, ...entry })),
      questions: [],
      suggestions: [],
      thread: { id: "top" },
      threads: [],
    }) as unknown as MissionDetail;
  const owner = (sentAt: number) => ({ id: `owner-${sentAt}`, sender: "user", sentAt, text: "Go" });
  const agent = (sentAt: number) => ({ id: `agent-${sentAt}`, sender: "agent", sentAt, text: "Step" });

  it("keeps every reply of a finished turn as a normal message", () => {
    const entries = entriesOf(turn([owner(0), agent(4000), agent(16000), agent(20000)]));
    expect(entries.map((entry) => entry.key)).toEqual(["owner-0", "agent-4000", "agent-16000", "agent-20000"]);
    expect(entries.every((entry) => entry._tag === "Message")).toBe(true);
  });

  it("keeps every reply visible while the thread still works", () => {
    const entries = entriesOf(turn([owner(0), agent(4000), agent(9000)]), true);
    expect(entries.map((entry) => entry._tag)).toEqual(["Message", "Message", "Message"]);
  });

  it("folds the actions a turn ran into its steps, keeping a denial visible", () => {
    const question = (id: string, askedAt: number, outcome: string) => ({ askedAt, id, outcome, summary: `Ran ${id}` });
    const detail = turn([owner(0), agent(1000), agent(20000)]);
    const entries = entriesOf({
      ...detail,
      questions: [question("a", 2000, "AllowedAutomatically"), question("b", 3000, "Denied")],
    } as unknown as MissionDetail);
    expect(entries.map((entry) => entry.key)).toEqual(["owner-0", "agent-1000", "steps:a", "b", "agent-20000"]);
    expect(entries[2]).toMatchObject({ _tag: "Steps", seconds: 2, steps: [{ _tag: "Action", id: "a" }] });
  });

  it("does not present a settled approval as current work after a reply", () => {
    const detail = turn([owner(0), agent(1000), agent(4000)]);
    const questions = [
      { askedAt: 2000, id: "install", outcome: "Allowed", summary: "May I install the project dependencies?" },
    ];
    const entries = entriesOf({ ...detail, questions } as unknown as MissionDetail, true);
    expect(workingLabelOf(entries)).toBe("Working…");
  });

  it("leaves a lone reply of a finished turn as it is", () => {
    expect(entriesOf(turn([owner(0), agent(4000)])).map((entry) => entry._tag)).toEqual(["Message", "Message"]);
  });
});
