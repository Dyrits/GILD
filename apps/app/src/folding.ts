import type { ThreadId, ThreadSummary } from "@canopy/contracts";

/** One visible tree row, with the hidden descendants folded into it. */
export interface FoldedThread {
  readonly depth: number;
  foldedCount: number;
  readonly thread: ThreadSummary;
}

/** Projects folding without changing the tree; urgent and owner-opened threads always remain reachable. */
export const foldThreads = (
  threads: ReadonlyArray<ThreadSummary>,
  shouldShowAgentThreads: boolean,
  unfolded: ReadonlySet<string>,
): FoldedThread[] => {
  const rows: FoldedThread[] = [];
  const visible = new Map<ThreadId, FoldedThread>();
  const parents = new Map(threads.map((thread) => [thread.id, thread]));
  for (const thread of threads) {
    let parent = thread.parentId;
    let opener: FoldedThread | null = null;
    let isUnfolded = shouldShowAgentThreads;
    while (parent !== null) {
      isUnfolded ||= unfolded.has(parent);
      opener ??= visible.get(parent) ?? null;
      parent = parents.get(parent)?.parentId ?? null;
    }
    const isUrgent = thread.state === "Attention" || thread.state === "Failed";
    if (!isUnfolded && thread.isOpenedByAgent && !isUrgent && opener !== null) {
      opener.foldedCount++;
    } else {
      const row = { depth: opener === null ? 0 : opener.depth + 1, foldedCount: 0, thread };
      rows.push(row);
      visible.set(thread.id, row);
    }
  }
  return rows;
};
