import type { FreeRealm, MissionSummary, ThreadId, ThreadSummary, WorkspaceChoice } from "@iskios/contracts";
import { foldThreads } from "../conversation/folding";

/** The sidebar's three placements of quests: each realm and Free Realm with its quests, and the quests outside any realm. */
export interface Placements {
  readonly freeRealms: ReadonlyArray<{
    readonly freeRealm: FreeRealm;
    readonly quests: ReadonlyArray<MissionSummary>;
  }>;
  readonly realmless: ReadonlyArray<MissionSummary>;
  readonly realms: ReadonlyArray<{
    readonly quests: ReadonlyArray<MissionSummary>;
    readonly workspace: WorkspaceChoice;
  }>;
}

/**
 * Sorts every quest into its placement (mission-tracking, Left navigation structure): realms by name, quests of each
 * placement by latest activity. A realm or Free Realm with no quest is kept, so it can be found.
 */
export const placementsOf = (
  missions: ReadonlyArray<MissionSummary>,
  workspaces: ReadonlyArray<WorkspaceChoice>,
  freeRealms: ReadonlyArray<FreeRealm> = [],
): Placements => {
  const latestFirst = [...missions].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  return {
    freeRealms: freeRealms.map((freeRealm) => ({
      freeRealm,
      quests: latestFirst.filter((mission) => mission.freeRealmId === freeRealm.id),
    })),
    realmless: latestFirst.filter((mission) => mission.workspaceId === null && mission.freeRealmId === null),
    realms: [...workspaces]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((workspace) => ({
        quests: latestFirst.filter((mission) => mission.workspaceId === workspace.id),
        workspace,
      })),
  };
};

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
 * not the current one), as the Realmless page lists them.
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

/** A realm or Free Realm whose quests the quest list page shows in full. */
export interface RealmListing {
  readonly id: string;
  readonly kind: "free" | "realm";
  readonly name: string;
}
