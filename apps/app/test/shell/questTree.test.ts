import { type MissionSummary, ThreadSummary, type WorkspaceChoice } from "@iskios/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  agoOf,
  ancestorIdsOf,
  areActionsShown,
  placementsOf,
  questListRowsOf,
  recencyGroupsOf,
  scrollCueOf,
  sideQuestRowsOf,
  toggledFold,
} from "../../src/shell/questTree";

const thread = (id: string, parentId: string | null, depth: number, isOpenedByAgent = false) =>
  Schema.decodeUnknownSync(ThreadSummary)({
    depth,
    harness: "claude",
    id,
    isAside: false,
    isOpenedByAgent,
    lastActivityAt: 0,
    model: "default",
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

const quest = (id: string, workspaceId: string | null, lastActivityAt: number) =>
  ({ id, lastActivityAt, workspaceId }) as unknown as MissionSummary;
const realm = (id: string, name: string, path: string | null = `/${name}`) =>
  ({ crest: null, id, name, path }) as unknown as WorkspaceChoice;

describe("the placements of quests", () => {
  const placements = placementsOf(
    [quest("q1", "w2", 1), quest("q2", null, 5), quest("q3", "w2", 9), quest("q4", null, 2), quest("q5", "w3", 3)],
    [realm("w2", "Zeta"), realm("w1", "Alpha"), realm("w3", "Middle", null)],
  );

  it("puts the quests of no realm in the Borderlands, latest first", () => {
    expect(placements.borderlands.map((each) => each.id)).toEqual(["q2", "q4"]);
  });

  it("lists realms by name, with or without a folder, with their own quests latest first, and keeps a realm with none", () => {
    expect(placements.realms.map((each) => [each.workspace.name, each.quests.map((q) => q.id)])).toEqual([
      ["Alpha", []],
      ["Middle", ["q5"]],
      ["Zeta", ["q3", "q1"]],
    ]);
  });
});

describe("the scroll cue beside a realm's name", () => {
  it("shows for a realm tied to a folder, naming the folder's full path", () => {
    expect(scrollCueOf(realm("w1", "App", "/Users/owner/Code/app"))).toBe("Tied to /Users/owner/Code/app");
  });

  it("does not show for a realm tied to no folder", () => {
    expect(scrollCueOf(realm("w2", "Ideas", null))).toBeNull();
  });
});

describe("the quest list page's groups", () => {
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

describe("folding the sidebar's sections", () => {
  it("folds Realms on a press and unfolds it on the next, leaving Borderlands and The Keep as they were", () => {
    const folded = toggledFold(new Set(["Keep"]), "Realms");
    expect([...folded].sort()).toEqual(["Keep", "Realms"]);
    expect([...toggledFold(folded, "Realms")]).toEqual(["Keep"]);
  });

  it("folds Borderlands and The Keep the same way", () => {
    const both = toggledFold(toggledFold(new Set(), "Borderlands"), "Keep");
    expect([...both].sort()).toEqual(["Borderlands", "Keep"]);
    expect([...toggledFold(both, "Borderlands")]).toEqual(["Keep"]);
  });
});

describe("the actions of a sidebar row", () => {
  it("show while the pointer is over the row or a keyboard focus is inside it", () => {
    expect(areActionsShown({ hasKeyboardFocusWithin: false, isHovered: true })).toBe(true);
    expect(areActionsShown({ hasKeyboardFocusWithin: true, isHovered: false })).toBe(true);
  });

  it("stay hidden otherwise, including after a click left the focus inside the row", () => {
    expect(areActionsShown({ hasKeyboardFocusWithin: false, isHovered: false })).toBe(false);
  });
});

describe("the full quest list's rows", () => {
  const top = { id: "q1", threadCount: 5 } as unknown as MissionSummary;

  it("lists a quest, then its side-quests beneath it at every depth, indented by level", () => {
    const rows = questListRowsOf(top, tree, none);
    expect(rows.map((row) => [row.id, row.depth, row.hasChildren])).toEqual([
      ["q1", 0, true],
      ["a", 1, true],
      ["a1", 2, true],
      ["a1x", 3, false],
      ["b", 1, false],
    ]);
  });

  it("hides the side-quests of a collapsed quest, and what lies beneath a collapsed side-quest", () => {
    expect(questListRowsOf(top, tree, new Set(["q1"])).map((row) => row.id)).toEqual(["q1"]);
    expect(questListRowsOf(top, tree, new Set(["a"])).map((row) => row.id)).toEqual(["q1", "a", "b"]);
  });

  it("lists the quest alone while its tree is not read yet, or when it has no side-quest", () => {
    expect(questListRowsOf(top, null, none).map((row) => [row.id, row.hasChildren])).toEqual([["q1", true]]);
    const single = { id: "q2", threadCount: 1 } as unknown as MissionSummary;
    expect(questListRowsOf(single, [thread("top", null, 0)], none).map((row) => [row.id, row.hasChildren])).toEqual([
      ["q2", false],
    ]);
  });
});
