import { type FreeRealm, type MissionSummary, ThreadSummary, type WorkspaceChoice } from "@iskios/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { agoOf, ancestorIdsOf, placementsOf, recencyGroupsOf, sideQuestRowsOf } from "../../src/shell/questTree";

const thread = (id: string, parentId: string | null, depth: number, isOpenedByAgent = false) =>
  Schema.decodeUnknownSync(ThreadSummary)({
    depth,
    id,
    isAside: false,
    isOpenedByAgent,
    openedAt: 0,
    parentId,
    state: "Idle",
    title: id,
    waitingCount: 0,
  });

const tree = [
  thread("top", null, 0),
  thread("a", "top", 1),
  thread("a1", "a", 2),
  thread("a1x", "a1", 3),
  thread("b", "top", 1),
];
const none = new Set<string>();

describe("the side-quests a quest lists in the sidebar", () => {
  it("lists every level beneath the quest, in order, without the quest itself", () => {
    const rows = sideQuestRowsOf(tree, { collapsed: none, shouldShowAgentThreads: true });
    expect(rows.map((row) => [row.thread.id, row.depth])).toEqual([
      ["a", 1],
      ["a1", 2],
      ["a1x", 3],
      ["b", 1],
    ]);
  });

  it("marks the rows that have side-quests beneath them", () => {
    const rows = sideQuestRowsOf(tree, { collapsed: none, shouldShowAgentThreads: true });
    expect(rows.map((row) => row.hasChildren)).toEqual([true, true, false, false]);
  });

  it("hides what lies beneath a collapsed side-quest at any depth and shows the rest", () => {
    const rows = sideQuestRowsOf(tree, { collapsed: new Set(["a"]), shouldShowAgentThreads: true });
    expect(rows.map((row) => row.thread.id)).toEqual(["a", "b"]);
    const inner = sideQuestRowsOf(tree, { collapsed: new Set(["a1"]), shouldShowAgentThreads: true });
    expect(inner.map((row) => row.thread.id)).toEqual(["a", "a1", "b"]);
  });

  it("lists nothing for a quest with no side-quest", () => {
    expect(sideQuestRowsOf([thread("top", null, 0)], { collapsed: none, shouldShowAgentThreads: true })).toEqual([]);
  });

  it("folds threads the agents opened into their opener when the setting says so", () => {
    const agents = [thread("top", null, 0), thread("x", "top", 1, true), thread("y", "top", 1)];
    const rows = sideQuestRowsOf(agents, { collapsed: none, shouldShowAgentThreads: false });
    expect(rows.map((row) => row.thread.id)).toEqual(["y"]);
  });
});

describe("the path to a thread", () => {
  it("lists its ancestors, nearest first", () => {
    expect(ancestorIdsOf(tree, "a1x" as never)).toEqual(["a1", "a", "top"]);
    expect(ancestorIdsOf(tree, "top" as never)).toEqual([]);
  });
});

const quest = (id: string, workspaceId: string | null, lastActivityAt: number, freeRealmId: string | null = null) =>
  ({ freeRealmId, id, lastActivityAt, workspaceId }) as unknown as MissionSummary;
const realm = (id: string, name: string) => ({ crest: null, id, name, path: `/${name}` }) as unknown as WorkspaceChoice;

describe("the placements of quests", () => {
  const placements = placementsOf(
    [
      quest("q1", "w2", 1),
      quest("q2", null, 5),
      quest("q3", "w2", 9),
      quest("q4", null, 2),
      quest("q5", null, 3, "f1"),
    ],
    [realm("w2", "Zeta"), realm("w1", "Alpha")],
    [
      { crest: null, id: "f1", name: "Free" },
      { crest: null, id: "f2", name: "Empty" },
    ] as unknown as FreeRealm[],
  );

  it("puts quests outside any realm apart, latest first", () => {
    expect(placements.realmless.map((each) => each.id)).toEqual(["q2", "q4"]);
  });

  it("places a quest in its Free Realm, keeps a Free Realm with none, and leaves it out of the realmless", () => {
    expect(placements.freeRealms.map((each) => [each.freeRealm.name, each.quests.map((q) => q.id)])).toEqual([
      ["Free", ["q5"]],
      ["Empty", []],
    ]);
  });

  it("lists realms by name with their own quests, latest first, and keeps a realm with none", () => {
    expect(placements.realms.map((each) => [each.workspace.name, each.quests.map((q) => q.id)])).toEqual([
      ["Alpha", []],
      ["Zeta", ["q3", "q1"]],
    ]);
  });
});

describe("the Realmless page's groups", () => {
  const now = new Date(2026, 10, 11, 15, 0).getTime();
  const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).getTime();

  it("groups quests latest first under Today, Yesterday, This week, and the months", () => {
    const groups = recencyGroupsOf(
      [
        quest("old", null, at(9, 3)),
        quest("today", null, at(10, 11, 9)),
        quest("week", null, at(10, 7)),
        quest("yesterday", null, at(10, 10)),
        quest("earlier", null, at(10, 1)),
        quest("also-old", null, at(9, 20)),
      ],
      now,
    );
    expect(groups.map((group) => [group.heading, group.quests.map((each) => each.id)])).toEqual([
      ["Today", ["today"]],
      ["Yesterday", ["yesterday"]],
      ["This week", ["week"]],
      ["November", ["earlier"]],
      ["October", ["also-old", "old"]],
    ]);
  });

  it("names the year of a month in another year", () => {
    const groups = recencyGroupsOf([quest("a", null, new Date(2025, 11, 5).getTime())], now);
    expect(groups.map((group) => group.heading)).toEqual(["December 2025"]);
  });

  it("says how long ago in the coarsest fitting unit", () => {
    const minute = 60000;
    expect(agoOf(now, now)).toBe("just now");
    expect(agoOf(now - 8 * minute, now)).toBe("8 minutes ago");
    expect(agoOf(now - 60 * minute, now)).toBe("1 hour ago");
    expect(agoOf(now - 3 * 24 * 60 * minute, now)).toBe("3 days ago");
    expect(agoOf(now - 14 * 24 * 60 * minute, now)).toBe("2 weeks ago");
  });
});
