import type { IntelActor, IntelHistoryKind, IntelKind, IntelOrigin, IntelScope } from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type Fading, fadingStepsOf, readFading } from "./intelFading.ts";

// An intel's history (scoped-intel, History and undo): every save, replacement, change, widening, deletion,
// and fading step, with who or what made it and when, and each change's state before and after so it can
// be undone.

/** An intel's stored state, kept with each history entry so the owner can undo the change. */
export interface Snapshot {
  readonly id: string;
  readonly isPinned: number;
  readonly kind: IntelKind;
  readonly lastUsedAt: number;
  readonly originEntry: number | null;
  readonly originExcerpt: string | null;
  readonly originFrom: string | null;
  readonly originKind: IntelOrigin["kind"] | null;
  readonly savedAt: number;
  readonly savedByThreadId: string | null;
  readonly savedByTitle: string | null;
  readonly scope: IntelScope;
  readonly text: string;
  readonly threadId: string | null;
  readonly updatedAt: number;
  readonly uses: number;
  readonly workspaceId: string | null;
}

/** Who made a change: a thread, or the owner. */
export type Actor = { readonly kind: "Thread"; readonly threadId: string } | { readonly kind: "Owner" };

export const owner: Actor = { kind: "Owner" };
export const threadActor = (threadId: string): Actor => ({ kind: "Thread", threadId });

/** An intel's stored state, or null when it does not exist. */
export const readSnapshot = (intelId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<Snapshot>`
      SELECT id, scope, kind, thread_id AS threadId, workspace_id AS workspaceId, text,
        saved_by_thread_id AS savedByThreadId, saved_by_title AS savedByTitle, saved_at AS savedAt,
        updated_at AS updatedAt, last_used_at AS lastUsedAt, uses, is_pinned AS isPinned,
        origin_kind AS originKind, origin_entry AS originEntry, origin_from AS originFrom,
        origin_excerpt AS originExcerpt
      FROM intels WHERE id = ${intelId}`;
    return row ?? null;
  });

/** Stores an intel's state, creating or overwriting it. Callers run it in a transaction. */
export const writeSnapshot = (state: Snapshot) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT OR REPLACE INTO intels (id, scope, kind, thread_id, workspace_id, text, saved_by_thread_id,
        saved_by_title, saved_at, updated_at, last_used_at, uses, is_pinned, origin_kind, origin_entry, origin_from,
        origin_excerpt)
      VALUES (${state.id}, ${state.scope}, ${state.kind}, ${state.threadId}, ${state.workspaceId}, ${state.text},
        ${state.savedByThreadId}, ${state.savedByTitle}, ${state.savedAt}, ${state.updatedAt}, ${state.lastUsedAt},
        ${state.uses}, ${state.isPinned}, ${state.originKind}, ${state.originEntry}, ${state.originFrom},
        ${state.originExcerpt})`;
  });

interface EntryRecord {
  readonly actor: Actor;
  readonly after: Snapshot | null;
  readonly approvedAt: number | null;
  readonly before: Snapshot | null;
  readonly intelId: string;
  readonly kind: IntelHistoryKind;
  readonly undid: { readonly id: string; readonly kind: IntelHistoryKind } | null;
}

/** Adds one entry made by a thread or the owner. Callers run it in a transaction. */
export const insertEntry = (entry: EntryRecord) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const threadId = entry.actor.kind === "Thread" ? entry.actor.threadId : null;
    const state = entry.after ?? entry.before;
    yield* sql`INSERT INTO intel_history (id, intel_id, kind, actor, actor_thread_id, actor_title, at, approved_at,
        before_state, after_state, scope_thread_id, undid, undo_of)
      VALUES (${crypto.randomUUID()}, ${entry.intelId}, ${entry.kind}, ${entry.actor.kind}, ${threadId},
        (SELECT title FROM threads WHERE id = ${threadId}), ${now}, ${entry.approvedAt},
        ${entry.before === null ? null : JSON.stringify(entry.before)},
        ${entry.after === null ? null : JSON.stringify(entry.after)}, ${state?.threadId ?? null},
        ${entry.undid?.kind ?? null}, ${entry.undid?.id ?? null})`;
  });

/** A fading step's identifier: one per intel, step, and time, so a step shown before it is stored keeps it. */
export const fadingEntryIdOf = (intelId: string, kind: string, at: number) => `${intelId}:${kind}:${at}`;

/** Whether an identifier names a fading step, which has no Undo. */
export const isFadingEntryId = (entryId: string) => /:(Dormant|Archived):\d+$/.test(entryId);

/** The fading steps an intel took since its last use and that are not stored yet. */
export const unrecordedStepsOf = (state: Snapshot, fading: Fading) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const steps = fadingStepsOf(state, fading);
    if (steps.length === 0) return [];
    const stored = yield* sql<{ id: string }>`SELECT id FROM intel_history
      WHERE id IN ${sql.in(steps.map((step) => fadingEntryIdOf(state.id, step.kind, step.at)))}`;
    return steps.filter((step) => !stored.some((row) => row.id === fadingEntryIdOf(state.id, step.kind, step.at)));
  });

/**
 * Stores the fading steps an intel took since its last use, before something resets its fading (a use, a
 * restore, a replacement, a pin, a deletion), so they stay in its history. Callers run it in a transaction.
 */
export const recordFadingSteps = (state: Snapshot) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    for (const step of yield* unrecordedStepsOf(state, yield* readFading)) {
      yield* sql`INSERT INTO intel_history (id, intel_id, kind, actor, at, scope_thread_id)
        VALUES (${fadingEntryIdOf(state.id, step.kind, step.at)}, ${state.id}, ${step.kind}, 'Fading', ${step.at},
          ${state.threadId})`;
    }
  });

/** Stores the fading steps of each intel before its uses are counted. Callers run it in a transaction. */
export const recordFadingStepsOf = (intelIds: ReadonlyArray<string>) =>
  Effect.forEach(intelIds, (intelId) =>
    readSnapshot(intelId).pipe(Effect.flatMap((state) => (state === null ? Effect.void : recordFadingSteps(state)))),
  );

/**
 * Runs a change to one intel and records it in its history with the state before and after. Fading steps up
 * to now are stored first. Callers run it in a transaction.
 */
export const trackChange = <A, E, R>(
  intelId: string,
  kind: IntelHistoryKind,
  actor: Actor,
  change: Effect.Effect<A, E, R>,
  approvedAt: number | null = null,
) =>
  Effect.gen(function* () {
    const before = yield* readSnapshot(intelId);
    if (before !== null) yield* recordFadingSteps(before);
    const result = yield* change;
    const after = yield* readSnapshot(intelId);
    yield* insertEntry({ actor, after, approvedAt, before, intelId, kind, undid: null });
    return result;
  });

/** Records a new intel's save, by a thread, approved by the owner when the time is given. */
export const recordSaved = (intelId: string, actor: Actor, approvedAt: number | null = null) =>
  Effect.gen(function* () {
    const after = yield* readSnapshot(intelId);
    yield* insertEntry({ actor, after, approvedAt, before: null, intelId, kind: "Saved", undid: null });
  });

/** One stored history entry, its states still as JSON. */
export interface EntryRow {
  readonly actor: IntelActor;
  readonly actorTitle: string | null;
  readonly afterState: string | null;
  readonly approvedAt: number | null;
  readonly at: number;
  readonly beforeState: string | null;
  readonly id: string;
  readonly intelId: string;
  readonly kind: IntelHistoryKind;
  readonly undid: IntelHistoryKind | null;
  readonly undoneAt: number | null;
}

/** A state stored as JSON, or null. */
export const stateOf = (json: string | null): Snapshot | null =>
  json === null ? null : (JSON.parse(json) as Snapshot);

/** Selects history entries; callers add the condition and order. */
export const selectEntries = (sql: SqlClient.SqlClient) => sql`
  SELECT id, intel_id AS intelId, kind, actor, actor_title AS actorTitle, at, approved_at AS approvedAt,
    before_state AS beforeState, after_state AS afterState, undid, undone_at AS undoneAt
  FROM intel_history`;

/** One stored entry, or null when there is none with that identifier. */
export const readEntry = (entryId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<EntryRow>`${selectEntries(sql)} WHERE id = ${entryId}`;
    return row === undefined ? null : { ...row, after: stateOf(row.afterState), before: stateOf(row.beforeState) };
  });

/** Marks an entry undone. Callers run it in a transaction. */
export const markUndone = (entryId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE intel_history SET undone_at = ${now} WHERE id = ${entryId}`;
  });

/**
 * Erases the history of deleted threads' own intel, deleted ones included, before that intel is erased.
 * Entries the threads made on other intel stay, with their titles as then. Callers run it in a transaction.
 */
export const eraseThreadHistory = (threadIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`DELETE FROM intel_history WHERE intel_id IN (
        SELECT id FROM intels WHERE scope = 'Thread' AND thread_id IN ${sql.in(threadIds)}
        UNION
        SELECT h.intel_id FROM intel_history h
        WHERE h.intel_id NOT IN (SELECT id FROM intels) AND h.scope_thread_id IN ${sql.in(threadIds)}
          AND h.rowid = (SELECT MAX(rowid) FROM intel_history WHERE intel_id = h.intel_id AND actor != 'Fading')
      )`;
  });
