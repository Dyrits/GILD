import type {
  DeletedIntel,
  IntelHistory,
  IntelHistoryEntry,
  IntelHistoryEntryId,
  IntelId,
} from "@openmission/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "./errors.ts";
import { type Placement, type ScopeChain, scopeLabelOf } from "./intel.ts";
import { readFading } from "./intelFading.ts";
import {
  type EntryRow,
  fadingEntryIdOf,
  readSnapshot,
  type Snapshot,
  selectEntries,
  stateOf,
  unrecordedStepsOf,
} from "./intelHistory.ts";

// What the owner reads of intel history (scoped-intel, History and undo): an intel's entries and deleted intel.

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

/** An intel's history, newest first, with the fading steps it took and that are not stored yet. */
export const readIntelHistory = (intelId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const current = yield* readSnapshot(intelId);
    const rows = yield* sql<EntryRow>`${selectEntries(sql)} WHERE intel_id = ${intelId} ORDER BY rowid`;
    if (rows.length === 0 && current === null) return yield* notFound("No such intel.");
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
            id: fadingEntryIdOf(intelId, step.kind, step.at),
            intelId,
            kind: step.kind,
            undid: null,
            undoneAt: null,
          }));
    // Stored in the order made; a fading step is stored later than it happened, so order by time, then by
    // the order stored.
    const ordered = [...rows.map((row, order) => ({ order, row })), ...pending.map((row) => ({ order: -1, row }))]
      .toSorted((a, b) => b.row.at - a.row.at || b.order - a.order)
      .map(({ row }) => row);
    const entries: Array<IntelHistoryEntry> = [];
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
        id: row.id as IntelHistoryEntryId,
        intelId: intelId as IntelId,
        kind: row.kind,
        previousText: before?.text ?? null,
        scopeLabel: placed === null ? "" : yield* scopeLabelOfState(placed),
        text: after?.text ?? null,
        undid: row.undid,
        undoneAt: row.undoneAt,
      });
    }
    return { entries, intelId: intelId as IntelId, isDeleted: current === null } satisfies IntelHistory;
  });

/** Whether a placement is in a thread's lookup scope. */
const isInChain = (placement: Placement, chain: ScopeChain) =>
  placement.scope === "Global" ||
  (placement.scope === "Workspace" && placement.workspaceId === chain.workspaceId) ||
  (placement.scope === "Thread" && chain.threads.includes(placement.threadId ?? ""));

/**
 * Deleted intel, newest deletion first, each with the entry that deleted it; only intel in the thread's
 * scope when a chain is given.
 */
export const listDeletedIntel = (chain: ScopeChain | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // An intel whose latest change left it absent is deleted: nothing else happens to it until an undo
    // brings it back, and that undo is then its latest change.
    const rows = yield* sql<{ at: number; beforeState: string; id: string }>`
      SELECT h.id, h.at, h.before_state AS beforeState FROM intel_history h
      WHERE h.after_state IS NULL AND h.before_state IS NOT NULL
        AND h.rowid = (SELECT MAX(rowid) FROM intel_history WHERE intel_id = h.intel_id AND actor != 'Fading')
      ORDER BY h.at DESC, h.rowid DESC`;
    const deleted: Array<DeletedIntel> = [];
    for (const row of rows) {
      const state = stateOf(row.beforeState);
      if (state === null || (chain !== null && !isInChain(state, chain))) continue;
      deleted.push({
        deletedAt: row.at,
        entryId: row.id as IntelHistoryEntryId,
        id: state.id as IntelId,
        kind: state.kind,
        scope: state.scope,
        scopeLabel: yield* scopeLabelOfState(state),
        text: state.text,
      });
    }
    return deleted;
  });
