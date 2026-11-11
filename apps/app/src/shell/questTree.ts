import type { MissionSummary, ThreadId, ThreadSummary, WorkspaceChoice } from "@iskios/contracts";
import { foldThreads } from "../conversation/folding";

/** The sidebar's two placements of quests (CHG-0161): each realm with its quests, and the Borderlands' quests. */
export interface Placements {
  /** The quests of no realm: autonomous, with no workspace and no shared lore. */
  readonly borderlands: ReadonlyArray<MissionSummary>;
  readonly realms: ReadonlyArray<{
    readonly quests: ReadonlyArray<MissionSummary>;
    readonly workspace: WorkspaceChoice;
  }>;
}

/**
 * Sorts every quest into its placement (mission-tracking, Left navigation structure): realms by name, whether tied to a
 * folder or not, and quests of each placement by latest activity. A realm with no quest is kept, so it can be found.
 */
export const placementsOf = (
  missions: ReadonlyArray<MissionSummary>,
  workspaces: ReadonlyArray<WorkspaceChoice>,
): Placements => {
  const latestFirst = [...missions].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  return {
    borderlands: latestFirst.filter((mission) => mission.workspaceId === null),
    realms: [...workspaces]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((workspace) => ({
        quests: latestFirst.filter((mission) => mission.workspaceId === workspace.id),
        workspace,
      })),
  };
};

/** What the scroll after a realm's name says on hover: its full path; null where no icon shows, for a realm tied to no folder. */
export const scrollCueOf = (realm: Pick<WorkspaceChoice, "path">): string | null =>
  realm.path === null ? null : `Tied to ${realm.path}`;

/**
 * The folded ids after the owner presses a heading, a chevron, or a realm's row: a folded one unfolds, an unfolded one
 * folds, and the others stay as they were. Realms, Borderlands, and The Keep fold this same way (CHG-0161).
 */
export const toggledFold = (folded: ReadonlySet<string>, id: string): ReadonlySet<string> => {
  const next = new Set(folded);
  if (!next.delete(id)) next.add(id);
  return next;
};

/**
 * Whether a sidebar row shows its hover marks (a heading's fold arrow; overview, new quest, new realm): only while the
 * pointer is over it, or while a keyboard focus is inside it so they stay reachable. The focus a click leaves does not
 * count. Otherwise they keep their place, unseen.
 */
export const areActionsShown = (row: {
  readonly hasKeyboardFocusWithin: boolean;
  readonly isHovered: boolean;
}): boolean => row.isHovered || row.hasKeyboardFocusWithin;

/** One side-quest row of the sidebar: how deep it sits beneath its quest, and what it hides. */
export interface SideQuestRow {
  /** Levels beneath the quest: 1 for a quest's own side-quests. */
  readonly depth: number;
  /** Threads the agents opened that the setting folds into this row. */
  readonly foldedCount: number;
  /** Whether it has side-quests beneath it, so it can expand and collapse. */
  readonly hasChildren: boolean;
  readonly thread: ThreadSummary;
}

/**
 * The side-quests of one quest as the sidebar lists them: its tree in order, the quest itself left out, and the
 * descendants of a collapsed side-quest hidden. Threads the owner chose to fold away stay folded into their opener.
 */
export const sideQuestRowsOf = (
  threads: ReadonlyArray<ThreadSummary>,
  options: { readonly collapsed: ReadonlySet<string>; readonly shouldShowAgentThreads: boolean },
): ReadonlyArray<SideQuestRow> => {
  const rows = foldThreads(threads, options.shouldShowAgentThreads, new Set());
  const visible: SideQuestRow[] = [];
  let hiddenBelow: number | null = null;
  rows.forEach((row, index) => {
    if (hiddenBelow !== null && row.depth > hiddenBelow) return;
    hiddenBelow = null;
    const hasChildren = (rows[index + 1]?.depth ?? 0) > row.depth;
    if (options.collapsed.has(row.thread.id)) hiddenBelow = row.depth;
    if (row.depth > 0)
      visible.push({ depth: row.depth, foldedCount: row.foldedCount, hasChildren, thread: row.thread });
  });
  return visible;
};

/** One row of the full quest list: the quest at depth 0, or one of its side-quests beneath it. */
export interface QuestListRow {
  readonly depth: number;
  /** Whether it has side-quests beneath it, so it can expand and collapse. */
  readonly hasChildren: boolean;
  /** The quest's id for the quest's row, the thread's for a side-quest's. */
  readonly id: string;
  /** The side-quest, or null for the quest's own row. */
  readonly thread: ThreadSummary | null;
}

/**
 * The rows the full quest list shows for one quest: the quest, then its side-quests nested as the sidebar nests them
 * (`sideQuestRowsOf`, with the same setting for agents' threads), unless the quest is collapsed. Its tree is null until read.
 */
export const questListRowsOf = (
  quest: Pick<MissionSummary, "id" | "threadCount">,
  threads: ReadonlyArray<ThreadSummary> | null,
  collapsed: ReadonlySet<string>,
  shouldShowAgentThreads = true,
): ReadonlyArray<QuestListRow> => {
  const own: QuestListRow = { depth: 0, hasChildren: quest.threadCount > 1, id: quest.id, thread: null };
  if (threads === null || collapsed.has(quest.id)) return [own];
  return [
    own,
    ...sideQuestRowsOf(threads, { collapsed, shouldShowAgentThreads }).map(
      ({ depth, hasChildren, thread }): QuestListRow => ({ depth, hasChildren, id: thread.id, thread }),
    ),
  ];
};

/** The threads above a thread, nearest first, so the sidebar can open the path to the one selected. */
export const ancestorIdsOf = (threads: ReadonlyArray<ThreadSummary>, id: ThreadId): ReadonlyArray<ThreadId> => {
  const parents = new Map(threads.map((thread) => [thread.id, thread.parentId]));
  const path: ThreadId[] = [];
  for (let parent = parents.get(id) ?? null; parent !== null; parent = parents.get(parent) ?? null) path.push(parent);
  return path;
};

/** A run of quests that were last active in the same stretch of time, under one heading. */
export interface RecencyGroup {
  readonly heading: string;
  readonly quests: ReadonlyArray<MissionSummary>;
}

const dayMillis = 24 * 60 * 60 * 1000;

/**
 * Groups quests, latest first, under Today, Yesterday, This week, then one heading per month (with the year when it is
 * not the current one), as the quest list pages list them.
 */
export const recencyGroupsOf = (missions: ReadonlyArray<MissionSummary>, now: number): ReadonlyArray<RecencyGroup> => {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const thisYear = new Date(now).getFullYear();
  const headingOf = (millis: number) => {
    if (millis >= startOfToday) return "Today";
    if (millis >= startOfToday - dayMillis) return "Yesterday";
    if (millis >= startOfToday - 6 * dayMillis) return "This week";
    const date = new Date(millis);
    const month = date.toLocaleString("en", { month: "long" });
    return date.getFullYear() === thisYear ? month : `${month} ${date.getFullYear()}`;
  };
  const groups: Array<{ heading: string; quests: MissionSummary[] }> = [];
  for (const mission of [...missions].sort((a, b) => b.lastActivityAt - a.lastActivityAt)) {
    const heading = headingOf(mission.lastActivityAt);
    const last = groups[groups.length - 1];
    if (last?.heading === heading) last.quests.push(mission);
    else groups.push({ heading, quests: [mission] });
  }
  return groups;
};

/** How long ago something happened, in the coarsest unit that fits: "just now", "8 minutes ago", "3 days ago". */
export const agoOf = (millis: number, now: number): string => {
  const minutes = Math.floor(Math.max(0, now - millis) / 60000);
  if (minutes < 1) return "just now";
  const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? "" : "s"} ago`;
  if (minutes < 60) return unit(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return unit(hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return unit(days, "day");
  if (days < 60) return unit(Math.floor(days / 7), "week");
  return unit(Math.floor(days / 30), "month");
};

/** A realm whose quests the quest list page shows in full. */
export interface RealmListing {
  readonly id: string;
  readonly name: string;
}
