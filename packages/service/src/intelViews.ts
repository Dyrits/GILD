import type { IntelChange, IntelScope, IntelStateFilter, IntelView } from "@canopy/contracts";
import { Clock, Effect } from "effect";
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
import { readFading, stateOfIntel } from "./intelFading.ts";
import { recordFadingStepsOf } from "./intelHistory.ts";
import { listDeletedIntel } from "./intelHistoryViews.ts";
import { listIntelProposals } from "./intelProposals.ts";
import { wordsOf } from "./matching.ts";

// What the owner and threads read of intel: the panel, a thread's changes, and search_intel.

/** The most intels `search_intel` answers with. */
const searchLimit = 20;
/** A word found in this many intels or fewer, such as a name, counts more in search (scoped-intel, External contract). */
const rareWordLimit = 3;
const rareWordWeight = 3;

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

/**
 * The intel panel: one thread's scope or all intel, filtered by scope and state, and every change awaiting
 * approval.
 */
export const readIntelView = (scope: IntelScope | null, state: IntelStateFilter | null, threadId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const fading = yield* readFading;
    const chain = threadId === null ? null : yield* readScopeChain(threadId);
    const rows =
      state === "Deleted"
        ? []
        : chain === null
          ? yield* sql<IntelRow>`${selectIntels(sql)} ORDER BY i.saved_at DESC`
          : yield* listInScope(chain);
    const deleted = state === "Deleted" ? yield* listDeletedIntel(chain) : [];
    const isOfState = (row: IntelRow) =>
      state === null || (state === "Pinned" ? row.isPinned === 1 : stateOfIntel(row, fading) === state);
    return {
      awaiting: yield* listAwaitingChanges,
      deleted: deleted.filter((intel) => scope === null || intel.scope === scope),
      gauge: threadId === null ? null : yield* readGauge(threadId),
      intels: rows
        .filter((row) => (scope === null || row.scope === scope) && isOfState(row))
        .map((row) => intelOf(row, fading)),
      proposals: yield* listIntelProposals,
    } satisfies IntelView;
  });

const isOfToolScope = (row: IntelRow, scope: ToolScope) =>
  ({
    global: row.scope === "Global",
    mission: row.scope === "Thread" && row.isTopThread === 1,
    thread: row.scope === "Thread",
    workspace: row.scope === "Workspace",
  })[scope];

/** Ranks intels by the query's words they share, a rare word counting more; ties keep the scope order. */
const rankByWords = (rows: ReadonlyArray<IntelRow>, query: string) => {
  const wanted = wordsOf(query);
  const wordsByIntel = new Map(rows.map((row) => [row.id, wordsOf(row.text)]));
  const intelsWith = (word: string) => rows.filter((row) => wordsByIntel.get(row.id)?.has(word)).length;
  const weights = new Map([...wanted].map((word) => [word, intelsWith(word) <= rareWordLimit ? rareWordWeight : 1]));
  return rows
    .map((row) => {
      const words = wordsByIntel.get(row.id) ?? new Set<string>();
      let score = 0;
      for (const [word, weight] of weights) if (words.has(word)) score += weight;
      return { row, score };
    })
    .filter(({ score }) => score > 0)
    .toSorted((a, b) => b.score - a.score)
    .map(({ row }) => row);
};

/** Counts one use of each intel: it fades slower, and a dormant one is active again (scoped-intel, Fading). */
const countUses = (threadId: string, intelIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    // A use resets fading, so the steps it took so far are stored first (scoped-intel, History and undo).
    yield* recordFadingStepsOf(intelIds);
    yield* sql`UPDATE intels SET uses = uses + 1, last_used_at = ${now} WHERE id IN ${sql.in(intelIds)}`;
    // Where each use happened is the evidence for narrowing (scoped-intel, Widening and narrowing).
    for (const intelId of intelIds) {
      yield* sql`INSERT INTO intel_uses (intel_id, at, workspace_id)
        SELECT ${intelId}, ${now}, workspace_id FROM threads WHERE id = ${threadId}`;
    }
  });

/** The thread's intel that search reads: in its scope and not archived. */
const searchableOf = (threadId: string) =>
  Effect.gen(function* () {
    const fading = yield* readFading;
    return (yield* listInScope(yield* readScopeChain(threadId))).filter(
      (row) => stateOfIntel(row, fading) !== "Archived",
    );
  });

/**
 * `relied_on_intel`: a thread says intels shaped what it did, which counts one use of each (scoped-intel,
 * Fading). Only intel in its scope and not archived counts. Callers run it in a transaction.
 */
export const relyOnIntel = (threadId: string, ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const counted = (yield* searchableOf(threadId)).filter((row) => ids.includes(row.id)).map((row) => row.id);
    const missed = [...new Set(ids)].filter((id) => !counted.includes(id));
    const missedNote = missed.length === 0 ? "" : ` Not in your scope, or archived: ${missed.join(", ")}.`;
    if (counted.length === 0) return { isError: true, text: `No use counted.${missedNote}` };
    yield* countUses(threadId, counted);
    return {
      isError: false,
      text: `Counted ${counted.length === 1 ? "1 use" : `${counted.length} uses`}.${missedNote}`,
    };
  });

/**
 * `search_intel`: the active and dormant intel in the thread's scope read by identifier or matching the
 * query's words, best match first. Each intel returned counts as a use, so it fades slower and a dormant one
 * becomes active again (scoped-intel, Fading). Callers run it in a transaction.
 */
export const searchIntelText = (
  threadId: string,
  query: string | null,
  ids: ReadonlyArray<string>,
  scope: ToolScope | null,
) =>
  Effect.gen(function* () {
    const rows = (yield* searchableOf(threadId)).filter((row) => scope === null || isOfToolScope(row, scope));
    const named = rows.filter((row) => ids.includes(row.id));
    const matched = query === null ? [] : rankByWords(rows, query).filter((row) => !ids.includes(row.id));
    const found = [...named, ...matched].slice(0, searchLimit);
    if (found.length === 0) {
      return "No intel matches. Your context already lists the active intel in your scope, and global intel as an index.";
    }
    yield* countUses(
      threadId,
      found.map((row) => row.id),
    );
    return `Intel found, best match first; when two conflict, the more specific scope wins:\n${intelLinesOf(found)}`;
  });
