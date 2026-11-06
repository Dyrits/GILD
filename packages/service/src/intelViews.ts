import type { IntelChange, IntelScope, IntelView } from "@openmission/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import {
  type IntelRow,
  intelLinesOf,
  intelOf,
  listInScope,
  readGauge,
  readScopeChain,
  scopeLabelOf,
  selectIntels,
} from "./intel.ts";
import type { ToolScope } from "./intelChanges.ts";
import { wordsOf } from "./matching.ts";

// What the owner and threads read of intel: the panel, a thread's changes, and search_intel.

/** The most intels `search_intel` answers with. */
const searchLimit = 20;

const selectChanges = (sql: SqlClient.SqlClient) => sql`
  SELECT c.id, c.thread_id AS threadId, t.title AS threadTitle, c.kind, c.status, c.intel_id AS intelId, c.scope,
    c.text, c.previous_text AS previousText, c.at, c.resolved_at AS resolvedAt, s.title AS scopeThreadTitle,
    m.title AS missionTitle, (m.top_thread_id = c.scope_thread_id) AS isTopThread, w.name AS workspaceName
  FROM intel_changes c JOIN threads t ON t.id = c.thread_id LEFT JOIN threads s ON s.id = c.scope_thread_id
  LEFT JOIN missions m ON m.id = s.mission_id LEFT JOIN workspaces w ON w.id = c.scope_workspace_id`;

type ChangeRow = Omit<IntelChange, "scopeLabel"> & {
  scopeThreadTitle: string | null;
  missionTitle: string | null;
  isTopThread: number;
  workspaceName: string | null;
};

const changeOf = ({ scopeThreadTitle, missionTitle, isTopThread, workspaceName, ...row }: ChangeRow) =>
  ({
    ...row,
    scopeLabel: scopeLabelOf({
      isTopThread,
      missionTitle,
      scope: row.scope,
      threadTitle: scopeThreadTitle,
      workspaceName,
    }),
  }) as IntelChange;

/** Every change awaiting the owner's approval, oldest first. */
export const listAwaitingChanges = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<ChangeRow>`${selectChanges(sql)} WHERE c.status = 'Awaiting' ORDER BY c.at`;
  return rows.map(changeOf);
});

/** A thread's changes to intel, in the order made, as its conversation shows them. */
export const listThreadIntelChanges = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<ChangeRow>`${selectChanges(sql)} WHERE c.thread_id = ${threadId} ORDER BY c.at, c.rowid`;
    return rows.map(changeOf);
  });

/** The intel panel: one thread's scope or all intel, filtered by scope, and every change awaiting approval. */
export const readIntelView = (scope: IntelScope | null, threadId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows =
      threadId === null
        ? yield* sql<IntelRow>`${selectIntels(sql)} ORDER BY i.saved_at DESC`
        : yield* listInScope(yield* readScopeChain(threadId));
    return {
      awaiting: yield* listAwaitingChanges,
      gauge: threadId === null ? null : yield* readGauge(threadId),
      intels: rows.filter((row) => scope === null || row.scope === scope).map(intelOf),
    } satisfies IntelView;
  });

const isOfToolScope = (row: IntelRow, scope: ToolScope) =>
  ({
    global: row.scope === "Global",
    mission: row.scope === "Thread" && row.isTopThread === 1,
    thread: row.scope === "Thread",
    workspace: row.scope === "Workspace",
  })[scope];

/** `search_intel`: the intel in the thread's scope sharing words with the query, most specific first. */
export const searchIntelText = (threadId: string, query: string, scope: ToolScope | null) =>
  Effect.gen(function* () {
    const wanted = wordsOf(query);
    const rows = yield* listInScope(yield* readScopeChain(threadId));
    const found = rows
      .filter((row) => scope === null || isOfToolScope(row, scope))
      .filter((row) => {
        const words = wordsOf(row.text);
        return [...wanted].some((word) => words.has(word));
      })
      .slice(0, searchLimit);
    return found.length === 0
      ? "No intel matches. Your starting context already lists all the intel in your scope."
      : `Intel matching, most specific first; when two conflict, the one listed first wins:\n${intelLinesOf(found)}`;
  });
