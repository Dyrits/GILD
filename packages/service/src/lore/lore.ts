import type {
  LoreEntry,
  LoreEntryId,
  LoreGauge,
  LoreKind,
  LoreOrigin,
  LoreScope,
  MissionId,
  ModelChoice,
} from "@gild/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound, readSettings, tokensOf } from "../core/index.ts";
import { type Fading, readFading, stateOfLoreEntry, strengthOf, summaryOf } from "./loreFading.ts";

// Stored and wire names keep `intel` so existing data and agents still work: table and column names (`intels`, `intel_id`, ...), thread tool names (`save_intel`, ...) and settings keys (`intelHalfLives`, `intelWarningPercent`).

// Scoped lore (scoped-intel): where each lore entry applies, what a thread recalls, and what the owner reads.

/** The most tokens one lore entry holds, so one lore entry holds one fact (scoped-intel, Saving). */
export const loreLimit = 200;

/**
 * A model's context window in tokens. Provisional (work-in-progress, Batch 12): every model of every harness
 * counts 200,000 until the harness reports its model's window (thread panel and context gauge, backlog).
 */
export const contextWindowOf = (_model: ModelChoice) => 200_000;

/** Where a lore entry sits: a thread (the mission's top thread for the whole mission), a workspace, or everywhere. */
export interface Placement {
  readonly scope: LoreScope;
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
      LoreScope,
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

/** One stored lore entry with what its scope label needs. */
export interface LoreEntryRow {
  readonly id: string;
  readonly isPinned: number;
  readonly isTopThread: number;
  readonly kind: LoreKind;
  readonly lastUsedAt: number;
  readonly missionId: string | null;
  readonly missionTitle: string | null;
  readonly originEntry: number | null;
  readonly originExcerpt: string | null;
  readonly originFrom: string | null;
  readonly originKind: LoreOrigin["kind"] | null;
  readonly savedAt: number;
  readonly savedByTitle: string | null;
  readonly scope: LoreScope;
  readonly text: string;
  readonly threadId: string | null;
  readonly threadTitle: string | null;
  readonly updatedAt: number;
  readonly uses: number;
  readonly workspaceId: string | null;
  readonly workspaceName: string | null;
}

/** Selects lore entries with what their scope labels need; callers add the condition and order. */
export const selectLoreEntries = (sql: SqlClient.SqlClient) => sql`
  SELECT i.id, i.scope, i.kind, i.is_pinned AS isPinned, i.uses, i.last_used_at AS lastUsedAt, i.text, i.thread_id AS threadId, i.workspace_id AS workspaceId, i.saved_by_title AS savedByTitle,
    i.origin_kind AS originKind, i.origin_entry AS originEntry, i.origin_from AS originFrom,
    i.origin_excerpt AS originExcerpt, i.saved_at AS savedAt, i.updated_at AS updatedAt, t.title AS threadTitle, t.mission_id AS missionId,
    m.title AS missionTitle, (m.top_thread_id = i.thread_id) AS isTopThread, w.name AS workspaceName
  FROM intels i LEFT JOIN threads t ON t.id = i.thread_id LEFT JOIN missions m ON m.id = t.mission_id
  LEFT JOIN workspaces w ON w.id = i.workspace_id`;

/** The scope of a lore entry or a change in words, for the owner and for threads. */
export const scopeLabelOf = (row: {
  readonly scope: LoreScope;
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

/** What a stored lore entry or change rests on, or null when it records none. */
export const originOf = (row: {
  readonly originEntry: number | null;
  readonly originExcerpt: string | null;
  readonly originFrom: string | null;
  readonly originKind: LoreOrigin["kind"] | null;
}): LoreOrigin | null =>
  row.originKind === null
    ? null
    : { entryNumber: row.originEntry, excerpt: row.originExcerpt ?? "", from: row.originFrom, kind: row.originKind };

/** A lore entry as the owner reads it, with its strength at that time. */
export const loreEntryOf = (row: LoreEntryRow, fading: Fading): LoreEntry => ({
  id: row.id as LoreEntryId,
  isPinned: row.isPinned === 1,
  kind: row.kind,
  lastUsedAt: row.lastUsedAt,
  missionId: row.missionId as MissionId | null,
  origin: originOf(row),
  savedAt: row.savedAt,
  savedByTitle: row.savedByTitle,
  scope: row.scope,
  scopeLabel: scopeLabelOf(row),
  state: stateOfLoreEntry(row, fading),
  strength: strengthOf(row, fading),
  text: row.text,
  tokens: tokensOf(row.text),
  updatedAt: row.updatedAt,
  uses: row.uses,
});

/** The lore in a thread's scope, most specific first: the thread, each thread above, the workspace, then global. */
export const listInScope = (chain: ScopeChain) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<LoreEntryRow>`${selectLoreEntries(sql)}
      WHERE (i.scope = 'Thread' AND i.thread_id IN ${sql.in(chain.threads)})
        OR (i.scope = 'Workspace' AND i.workspace_id = ${chain.workspaceId})
        OR i.scope = 'Global'
      ORDER BY i.saved_at DESC`;
    const rankOf = (row: LoreEntryRow) =>
      row.scope === "Thread" ? chain.threads.indexOf(row.threadId ?? "") : row.scope === "Workspace" ? 1e6 : 2e6;
    // Stable sort: within one scope the newest stays first.
    return rows.toSorted((a, b) => rankOf(a) - rankOf(b));
  });

/** One stored lore entry, or null when it no longer exists. */
export const readLoreEntry = (loreEntryId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<LoreEntryRow>`${selectLoreEntries(sql)} WHERE i.id = ${loreEntryId}`;
    return row ?? null;
  });

/** What a turn's context carries of a thread's lore (scoped-intel, Recall). */
interface Recall {
  /** Dormant lore entries in scope, not listed. */
  readonly dormantCount: number;
  /** Active global lore, oldest first, so a new one is added at the end of the index. */
  readonly index: ReadonlyArray<LoreEntryRow>;
  /** Active thread, mission, and workspace lore, most specific first. */
  readonly inFull: ReadonlyArray<LoreEntryRow>;
}

const recallOf = (rows: ReadonlyArray<LoreEntryRow>, fading: Fading): Recall => {
  const active = rows.filter((row) => stateOfLoreEntry(row, fading) === "Active");
  return {
    dormantCount: rows.filter((row) => stateOfLoreEntry(row, fading) === "Dormant").length,
    index: active.filter((row) => row.scope === "Global").toSorted((a, b) => a.savedAt - b.savedAt),
    inFull: active.filter((row) => row.scope !== "Global"),
  };
};

const agentLabelOf = (row: LoreEntryRow) =>
  ({
    Global: "global",
    Thread: row.isTopThread === 1 ? "mission" : `thread "${row.threadTitle ?? ""}"`,
    Workspace: "workspace",
  })[row.scope];

/** Lore as a thread reads it in full: one line each, with its identifier, scope, and kind. */
export const loreLinesOf = (rows: ReadonlyArray<LoreEntryRow>) =>
  rows.map((row) => `- [${row.id}] (${agentLabelOf(row)}, ${row.kind.toLowerCase()}) ${row.text}`).join("\n");

/** The global index: one line per active global lore entry with its identifier, kind, and a short summary. */
const indexLinesOf = (rows: ReadonlyArray<LoreEntryRow>) =>
  rows.map((row) => `- [${row.id}] (global, ${row.kind.toLowerCase()}) ${summaryOf(row.text)}`).join("\n");

/**
 * What the lore in a thread's scope takes in a turn's context: how many active lore entries, and their tokens in
 * full or as index lines. A thread the owner opens beneath it starts with the same lore.
 */
export const readLoreSize = (threadId: string) =>
  Effect.gen(function* () {
    const recall = recallOf(yield* listInScope(yield* readScopeChain(threadId)), yield* readFading);
    return {
      count: recall.inFull.length + recall.index.length,
      tokens:
        recall.inFull.reduce((sum, row) => sum + tokensOf(row.text), 0) +
        recall.index.reduce((sum, row) => sum + tokensOf(summaryOf(row.text)), 0),
    };
  });

/** How much of its model's context window the lore in a thread's scope takes (scoped-intel, Size warning). */
export const readGauge = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const { count, tokens } = yield* readLoreSize(threadId);
    const [thread] = yield* sql<{ model: ModelChoice }>`SELECT model FROM threads WHERE id = ${threadId}`;
    const { intelWarningPercent } = yield* readSettings;
    const windowTokens = contextWindowOf(thread?.model ?? "default");
    return {
      count,
      isOverWarning: tokens * 100 > windowTokens * intelWarningPercent,
      tokens,
      warningPercent: intelWarningPercent,
      windowTokens,
    } satisfies LoreGauge;
  });

/** How a thread keeps lore; part of its system prompt, the same every turn (scoped-intel). */
export const loreInstructions = [
  "# Lore",
  "Lore is what Gild keeps between threads: rules, preferences, decisions, facts, and temporary notes, each at the scope where it applies. Each of your turns starts with the lore in your scope.",
  `Before saving, check there is something worth keeping: saving nothing is better than a vague or forced lore entry. When you learn something later work should know, save it with save_intel: one fact per lore entry, at most ${loreLimit} tokens. Choose the narrowest scope that fits: thread (you and the threads beneath you), mission (every thread of this mission), workspace (every thread working in this folder, in any mission), or global (everywhere; it waits for the owner's approval).`,
  "Choose its kind: rule (never fades), preference, decision, fact, or temporary (fades in days). Lore nobody uses fades, so search_intel for what you need: reading a lore entry there keeps it alive. When a lore entry from your context shaped what you did, say so with relied_on_intel and its ids; that keeps it alive too.",
  "A save that says the same as a lore entry in its scope or a wider one, or a newer version of it, replaces it: the lore entry keeps its id and takes the new text. When the lore entry rests on a journal entry, give its number as journalEntry; otherwise the message you are answering is recorded as its origin.",
  "When the owner gives you a rule in a chat, such as 'always run the tests before a commit', save it as a lore entry of kind rule without being asked.",
  "Correct a lore entry that turned out wrong with update_intel, and delete one that no longer holds with forget_intel. When a lore entry is not specific to where it was saved, such as a general convention or a preference of the owner, propose a wider scope with update_intel; the owner approves the move.",
  "Where the mission stands belongs in the journal, not in lore.",
].join("\n");

/** A thread's lore for each turn's message: the lore in its scope (scoped-intel, Recall). */
export const loreContextOf = (threadId: string) =>
  Effect.gen(function* () {
    const chain = yield* readScopeChain(threadId);
    const recall = recallOf(yield* listInScope(chain), yield* readFading);
    const count = recall.dormantCount;
    const dormant =
      count === 0
        ? []
        : count === 1
          ? ["1 dormant lore entry in your scope is not listed; search_intel finds it by words."]
          : [`${count} dormant lore entries in your scope are not listed; search_intel finds them by words.`];
    return [
      "# Lore at this turn",
      "The lore in your scope, most specific first; when two conflict, the one listed first wins:",
      recall.inFull.length === 0 ? "(none yet)" : loreLinesOf(recall.inFull),
      "",
      "Global lore, as an index of one line each; read one in full with search_intel and its id:",
      recall.index.length === 0 ? "(none yet)" : indexLinesOf(recall.index),
      ...dormant,
      ...(chain.workspaceId === null ? ["You have no workspace, so workspace lore is not available to you."] : []),
    ].join("\n");
  });
