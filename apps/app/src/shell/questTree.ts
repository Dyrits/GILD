import type { MissionSummary, ThreadId, ThreadSummary, WorkspaceChoice } from "@iskios/contracts";
import { foldThreads } from "../conversation/folding";

/** The sidebar's three placements of quests: each realm with its quests, and the quests outside any realm. */
export interface Placements {
  readonly realmless: ReadonlyArray<MissionSummary>;
  readonly realms: ReadonlyArray<{
    readonly quests: ReadonlyArray<MissionSummary>;
    readonly workspace: WorkspaceChoice;
  }>;
}

/**
 * Sorts every quest into its placement (mission-tracking, Left navigation structure): realms by name, quests of each
 * placement by latest activity. A realm with no quest is kept, so it can be found.
 */
export const placementsOf = (
  missions: ReadonlyArray<MissionSummary>,
  workspaces: ReadonlyArray<WorkspaceChoice>,
): Placements => {
  const latestFirst = [...missions].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  return {
    realmless: latestFirst.filter((mission) => mission.workspaceId === null),
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
