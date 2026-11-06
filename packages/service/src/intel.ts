import type { Intel, IntelGauge, IntelId, IntelScope, MissionId, ModelChoice } from "@openmission/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "./errors.ts";
import { tokensOf } from "./journal.ts";
import { readSettings } from "./settings.ts";

// Scoped intel (scoped-intel): where each intel applies, what a thread recalls, and what the owner reads.

/** The most tokens one intel holds, so one intel holds one fact (scoped-intel, Saving). */
export const intelLimit = 200;

/**
 * Each model's context window in tokens. Provisional (work-in-progress, Batch 12): every model counts
 * 200,000 until the harness reports its model's window (thread panel and context gauge, backlog).
 */
export const contextWindows = {
  default: 200_000,
  fable: 200_000,
  haiku: 200_000,
  opus: 200_000,
  sonnet: 200_000,
} as const satisfies Record<ModelChoice, number>;

/** Where an intel sits: a thread (the mission's top thread for the whole mission), a workspace, or everywhere. */
export interface Placement {
  readonly scope: IntelScope;
  readonly threadId: string | null;
  readonly workspaceId: string | null;
}

/** A thread's lookup scope: itself and each thread above it, nearest first, then its workspace. */
export interface ScopeChain {
  readonly missionId: string;
  readonly threads: ReadonlyArray<string>;
  readonly topThreadId: string;
  readonly workspaceId: string | null;
}

/** How wide a placement is, from a thread (0) to the whole mission (1), a workspace (2), and everywhere (3). */
export const widthOf = (placement: Placement, topThreadId: string) =>
  (
    ({ Global: 3, Thread: placement.threadId === topThreadId ? 1 : 0, Workspace: 2 }) satisfies Record<
      IntelScope,
      number
    >
  )[placement.scope];

/** The lookup scope of a thread (scoped-intel, Lookup). */
export const readScopeChain = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string; missionId: string; workspaceId: string | null; depth: number }>`
      WITH RECURSIVE chain(id, depth) AS (
        SELECT id, 0 FROM threads WHERE id = ${threadId}
        UNION ALL SELECT t.parent_id, chain.depth + 1 FROM threads t JOIN chain ON t.id = chain.id
        WHERE t.parent_id IS NOT NULL
      )
      SELECT t.id, t.mission_id AS missionId, t.workspace_id AS workspaceId, chain.depth
      FROM chain JOIN threads t ON t.id = chain.id ORDER BY chain.depth`;
    const [own] = rows;
    if (own === undefined) return yield* notFound("No such thread.");
    return {
      missionId: own.missionId,
      threads: rows.map((row) => row.id),
      topThreadId: rows.at(-1)?.id ?? own.id,
      workspaceId: own.workspaceId,
    } satisfies ScopeChain;
  });

/** One stored intel with what its scope label needs. */
export interface IntelRow {
  readonly id: string;
  readonly isTopThread: number;
  readonly missionId: string | null;
  readonly missionTitle: string | null;
  readonly savedAt: number;
  readonly savedByTitle: string | null;
  readonly scope: IntelScope;
  readonly text: string;
  readonly threadId: string | null;
  readonly threadTitle: string | null;
  readonly updatedAt: number;
  readonly workspaceId: string | null;
  readonly workspaceName: string | null;
}

/** Selects intels with what their scope labels need; callers add the condition and order. */
export const selectIntels = (sql: SqlClient.SqlClient) => sql`
  SELECT i.id, i.scope, i.text, i.thread_id AS threadId, i.workspace_id AS workspaceId, i.saved_by_title AS savedByTitle,
    i.saved_at AS savedAt, i.updated_at AS updatedAt, t.title AS threadTitle, t.mission_id AS missionId,
    m.title AS missionTitle, (m.top_thread_id = i.thread_id) AS isTopThread, w.name AS workspaceName
  FROM intels i LEFT JOIN threads t ON t.id = i.thread_id LEFT JOIN missions m ON m.id = t.mission_id
  LEFT JOIN workspaces w ON w.id = i.workspace_id`;

/** The scope of an intel or a change in words, for the owner and for threads. */
export const scopeLabelOf = (row: {
  readonly scope: IntelScope;
  readonly isTopThread: number;
  readonly missionTitle: string | null;
  readonly threadTitle: string | null;
  readonly workspaceName: string | null;
}) =>
  ({
    Global: "Global",
    Thread:
      row.isTopThread === 1
        ? `Mission "${row.missionTitle ?? ""}"`
        : `Thread "${row.threadTitle ?? "a deleted thread"}"`,
    Workspace: `Workspace ${row.workspaceName ?? ""}`,
  })[row.scope];

/** An intel as the owner reads it. */
export const intelOf = (row: IntelRow): Intel => ({
  id: row.id as IntelId,
  missionId: row.missionId as MissionId | null,
  savedAt: row.savedAt,
  savedByTitle: row.savedByTitle,
  scope: row.scope,
  scopeLabel: scopeLabelOf(row),
  text: row.text,
  tokens: tokensOf(row.text),
  updatedAt: row.updatedAt,
});

/** The intel in a thread's scope, most specific first: the thread, each thread above, the workspace, then global. */
export const listInScope = (chain: ScopeChain) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<IntelRow>`${selectIntels(sql)}
      WHERE (i.scope = 'Thread' AND i.thread_id IN ${sql.in(chain.threads)})
        OR (i.scope = 'Workspace' AND i.workspace_id = ${chain.workspaceId})
        OR i.scope = 'Global'
      ORDER BY i.saved_at DESC`;
    const rankOf = (row: IntelRow) =>
      row.scope === "Thread" ? chain.threads.indexOf(row.threadId ?? "") : row.scope === "Workspace" ? 1e6 : 2e6;
    // Stable sort: within one scope the newest stays first.
    return rows.toSorted((a, b) => rankOf(a) - rankOf(b));
  });

/** One stored intel, or null when it no longer exists. */
export const readIntel = (intelId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<IntelRow>`${selectIntels(sql)} WHERE i.id = ${intelId}`;
    return row ?? null;
  });

/** How much of its model's context window the intel in a thread's scope takes (scoped-intel, Size warning). */
export const readGauge = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const intels = yield* listInScope(yield* readScopeChain(threadId));
    const [thread] = yield* sql<{ model: ModelChoice }>`SELECT model FROM threads WHERE id = ${threadId}`;
    const { intelWarningPercent } = yield* readSettings;
    const windowTokens = contextWindows[thread?.model ?? "default"];
    const tokens = intels.reduce((sum, intel) => sum + tokensOf(intel.text), 0);
    return {
      count: intels.length,
      isOverWarning: tokens * 100 > windowTokens * intelWarningPercent,
      tokens,
      warningPercent: intelWarningPercent,
      windowTokens,
    } satisfies IntelGauge;
  });

const agentLabelOf = (row: IntelRow) =>
  ({
    Global: "global",
    Thread: row.isTopThread === 1 ? "mission" : `thread "${row.threadTitle ?? ""}"`,
    Workspace: "workspace",
  })[row.scope];

/** Intel as a thread reads it: one line each, with its identifier and scope. */
export const intelLinesOf = (rows: ReadonlyArray<IntelRow>) =>
  rows.map((row) => `- [${row.id}] (${agentLabelOf(row)}) ${row.text}`).join("\n");

/** A thread's intel context for each turn: the intel in its scope and how to keep it (scoped-intel, Recall). */
export const intelContextOf = (threadId: string) =>
  Effect.gen(function* () {
    const chain = yield* readScopeChain(threadId);
    const rows = yield* listInScope(chain);
    return [
      "# Intel",
      "Intel is what OpenMission keeps between threads: facts, preferences, and decisions, each at the scope where it applies. The intel in your scope, most specific first; when two conflict, the one listed first wins:",
      rows.length === 0 ? "(none yet)" : intelLinesOf(rows),
      "",
      `When you learn a fact, preference, or decision that later work should know, save it with save_intel: one fact per intel, at most ${intelLimit} tokens. Choose the narrowest scope that fits: thread (you and the threads beneath you), mission (every thread of this mission), workspace (every thread working in this folder, in any mission), or global (everywhere; it waits for the owner's approval).`,
      ...(chain.workspaceId === null ? ["You have no workspace, so workspace intel is not available to you."] : []),
      "When the owner gives you a rule in a chat, such as 'always run the tests before a commit', save it as an intel without being asked.",
      "Correct an intel that turned out wrong with update_intel, and delete one that no longer holds with forget_intel. When an intel is not specific to where it was saved, such as a general convention or a preference of the owner, propose a wider scope with update_intel; the owner approves the move. Call search_intel to look for intel by words.",
      "Where the mission stands belongs in the journal, not in intel.",
    ].join("\n");
  });

/** Erases deleted threads' own intel and their changes, awaiting or done. Callers run it in a transaction. */
export const eraseThreadIntel = (threadIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`DELETE FROM intels WHERE scope = 'Thread' AND thread_id IN ${sql.in(threadIds)}`;
    yield* sql`DELETE FROM intel_changes WHERE thread_id IN ${sql.in(threadIds)}
      OR scope_thread_id IN ${sql.in(threadIds)}`;
  });
