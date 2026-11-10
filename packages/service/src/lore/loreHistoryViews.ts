import type { DeletedLoreEntry, LoreEntryId, LoreHistory, LoreHistoryEntry, LoreHistoryEntryId } from "@gild/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "../core/index.ts";
import { type Placement, type ScopeChain, scopeLabelOf } from "./lore.ts";
import { readFading } from "./loreFading.ts";
import {
  type EntryRow,
  fadingEntryIdOf,
  readSnapshot,
  type Snapshot,
  selectEntries,
  stateOf,
  unrecordedStepsOf,
} from "./loreHistory.ts";

// Stored and wire names keep `intel` so existing data and agents still work: table and column names (`intels`, `intel_id`, ...).

// What the owner reads of lore history (scoped-intel, History and undo): a lore entry's entries and deleted lore.

/** The scope of a stored state in words, as the panel shows it. */
const scopeLabelOfState = (state: Pick<Snapshot, "scope" | "threadId" | "workspaceId">) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [thread] = yield* sql<{ isTopThread: number; missionTitle: string | null; threadTitle: string | null }>`
      SELECT t.title AS threadTitle, m.title AS missionTitle, (m.top_thread_id = t.id) AS isTopThread
      FROM threads t JOIN missions m ON m.id = t.mission_id WHERE t.id = ${state.threadId}`;
    const [workspace] = yield* sql<{ name: string }>`SELECT name FROM workspaces WHERE id = ${state.workspaceId}`;
    return scopeLabelOf({
      isTopThread: thread?.isTopThread ?? 0,
      missionTitle: thread?.missionTitle ?? null,
      scope: state.scope,
      threadTitle: thread?.threadTitle ?? null,
      workspaceName: workspace?.name ?? null,
    });
  });

/** A lore entry's history, newest first, with the fading steps it took and that are not stored yet. */
export const readLoreHistory = (loreEntryId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const current = yield* readSnapshot(loreEntryId);
    const rows = yield* sql<EntryRow>`${selectEntries(sql)} WHERE intel_id = ${loreEntryId} ORDER BY rowid`;
    if (rows.length === 0 && current === null) return yield* notFound("No such lore entry.");
    const pending: ReadonlyArray<EntryRow> =
      current === null
        ? []
        : (yield* unrecordedStepsOf(current, yield* readFading)).map((step) => ({
            actor: "Fading",
            actorTitle: null,
            afterState: null,
            approvedAt: null,
            at: step.at,
            beforeState: null,
            id: fadingEntryIdOf(loreEntryId, step.kind, step.at),
            kind: step.kind,
            loreEntryId,
            undid: null,
            undoneAt: null,
          }));
    // Stored in the order made; a fading step is stored later than it happened, so order by time, then by
    // the order stored.
    const ordered = [...rows.map((row, order) => ({ order, row })), ...pending.map((row) => ({ order: -1, row }))]
      .toSorted((a, b) => b.row.at - a.row.at || b.order - a.order)
      .map(({ row }) => row);
    const entries: Array<LoreHistoryEntry> = [];
    for (const row of ordered) {
      const before = stateOf(row.beforeState);
      const after = stateOf(row.afterState);
      const placed = after ?? before ?? current;
      entries.push({
        actor: row.actor,
        actorTitle: row.actorTitle,
        approvedAt: row.approvedAt,
        at: row.at,
        canUndo: row.actor !== "Fading" && row.undoneAt === null,
        id: row.id as LoreHistoryEntryId,
        kind: row.kind,
        loreEntryId: loreEntryId as LoreEntryId,
        previousText: before?.text ?? null,
        scopeLabel: placed === null ? "" : yield* scopeLabelOfState(placed),
        text: after?.text ?? null,
        undid: row.undid,
        undoneAt: row.undoneAt,
      });
    }
    return { entries, isDeleted: current === null, loreEntryId: loreEntryId as LoreEntryId } satisfies LoreHistory;
  });

/** Whether a placement is in a thread's lookup scope. */
const isInChain = (placement: Placement, chain: ScopeChain) =>
  placement.scope === "Global" ||
  (placement.scope === "Workspace" && placement.workspaceId === chain.workspaceId) ||
  (placement.scope === "Thread" && chain.threads.includes(placement.threadId ?? ""));

/**
 * Deleted lore, newest deletion first, each with the entry that deleted it; only lore in the thread's
 * scope when a chain is given, and only one workspace's own lore when a workspace is given.
 */
export const listDeletedLore = (chain: ScopeChain | null, workspaceId: string | null = null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // A lore entry whose latest change left it absent is deleted: nothing else happens to it until an undo
    // brings it back, and that undo is then its latest change.
    const rows = yield* sql<{ at: number; beforeState: string; id: string }>`
      SELECT h.id, h.at, h.before_state AS beforeState FROM intel_history h
      WHERE h.after_state IS NULL AND h.before_state IS NOT NULL
        AND h.rowid = (SELECT MAX(rowid) FROM intel_history WHERE intel_id = h.intel_id AND actor != 'Fading')
      ORDER BY h.at DESC, h.rowid DESC`;
    const deleted: Array<DeletedLoreEntry> = [];
    for (const row of rows) {
      const state = stateOf(row.beforeState);
      if (state === null || (chain !== null && !isInChain(state, chain))) continue;
      if (workspaceId !== null && !(state.scope === "Workspace" && state.workspaceId === workspaceId)) continue;
      deleted.push({
        deletedAt: row.at,
        entryId: row.id as LoreHistoryEntryId,
        id: state.id as LoreEntryId,
        kind: state.kind,
        scope: state.scope,
        scopeLabel: yield* scopeLabelOfState(state),
        text: state.text,
      });
    }
    return deleted;
  });
