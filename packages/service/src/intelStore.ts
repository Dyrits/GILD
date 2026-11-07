import type { IntelHistoryKind, IntelKind, IntelOrigin } from "@canopy/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Placement } from "./intel.ts";
import { readFading } from "./intelFading.ts";
import {
  type Actor,
  fadingEntryIdOf,
  owner,
  readSnapshot,
  type Snapshot,
  threadActor,
  unrecordedStepsOf,
} from "./intelHistory.ts";
import { originColumnsOf } from "./intelOrigins.ts";

// The intel store (scoped-intel, History and undo): the only writer of intels, their history, and their uses.
// Each operation records its own history entry, and stores the fading steps an intel took before a change
// resets them, so no caller can forget either. Callers run every operation in a transaction.

/** Stores an intel's state, creating or overwriting it. */
const writeSnapshot = Effect.fnUntraced(function* (state: Snapshot) {
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

/** Adds one history entry made by a thread or the owner. */
const insertEntry = Effect.fnUntraced(function* (entry: EntryRecord) {
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

/** Stores the fading steps an intel took since its last use and that are not stored yet. */
const recordStepsOf = Effect.fnUntraced(function* (state: Snapshot) {
  const sql = yield* SqlClient.SqlClient;
  for (const step of yield* unrecordedStepsOf(state, yield* readFading)) {
    yield* sql`INSERT INTO intel_history (id, intel_id, kind, actor, at, scope_thread_id)
      VALUES (${fadingEntryIdOf(state.id, step.kind, step.at)}, ${state.id}, ${step.kind}, 'Fading', ${step.at},
        ${state.threadId})`;
  }
});

/**
 * Stores the fading steps each intel took since its last use, so they stay in its history once something
 * resets its fading (a use, a restore, a replacement, a pin, a deletion).
 */
export const recordFadingSteps = (intelIds: ReadonlyArray<string>) =>
  Effect.forEach(
    intelIds,
    (intelId) =>
      readSnapshot(intelId).pipe(Effect.flatMap((state) => (state === null ? Effect.void : recordStepsOf(state)))),
    { discard: true },
  );

/** Runs a change to one intel and records it with the state before and after, fading steps up to now first. */
const trackChange = <E, R>(
  intelId: string,
  kind: IntelHistoryKind,
  actor: Actor,
  approvedAt: number | null,
  change: Effect.Effect<unknown, E, R>,
) =>
  Effect.gen(function* () {
    const before = yield* readSnapshot(intelId);
    if (before !== null) yield* recordStepsOf(before);
    yield* change;
    const after = yield* readSnapshot(intelId);
    yield* insertEntry({ actor, after, approvedAt, before, intelId, kind, undid: null });
  });

/** Deletes an intel; a deletion by the owner also declines the changes awaiting approval on it. */
const removeIntel = Effect.fnUntraced(function* (intelId: string, actor: Actor) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DELETE FROM intels WHERE id = ${intelId}`;
  // A thread's deletion leaves them for the owner, who finds nothing left to change (scoped-intel, Correcting).
  if (actor.kind !== "Owner") return;
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE intel_changes SET status = 'Declined', resolved_at = ${now}
    WHERE intel_id = ${intelId} AND status = 'Awaiting'`;
});

/** A new intel as a thread saves it, with what it rests on. */
export interface NewIntel {
  readonly kind: IntelKind;
  readonly origin: IntelOrigin | null;
  readonly placement: Placement;
  readonly text: string;
  /** The thread that saved it, which is the actor of its save. */
  readonly threadId: string;
}

/** Saves a new intel and records its save, approved by the owner when the time is given; returns its id. */
export const insertIntel = Effect.fnUntraced(function* (intel: NewIntel, approvedAt: number | null = null) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const id = crypto.randomUUID();
  const origin = originColumnsOf(intel.origin);
  const { placement } = intel;
  yield* sql`INSERT INTO intels (id, scope, kind, thread_id, workspace_id, text, saved_by_thread_id, saved_by_title,
      saved_at, updated_at, last_used_at, origin_kind, origin_entry, origin_from, origin_excerpt)
    VALUES (${id}, ${placement.scope}, ${intel.kind}, ${placement.threadId}, ${placement.workspaceId},
      ${intel.text.trim()}, ${intel.threadId}, (SELECT title FROM threads WHERE id = ${intel.threadId}), ${now},
      ${now}, ${now}, ${origin.originKind}, ${origin.originEntry}, ${origin.originFrom}, ${origin.originExcerpt})`;
  const after = yield* readSnapshot(id);
  yield* insertEntry({
    actor: threadActor(intel.threadId),
    after,
    approvedAt,
    before: null,
    intelId: id,
    kind: "Saved",
    undid: null,
  });
  return id;
});

/** Corrects an intel's text where it is: Edited by the owner, Corrected by a thread. */
export const correctIntel = (intelId: string, text: string, actor: Actor, approvedAt: number | null = null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const kind = actor.kind === "Owner" ? "Edited" : "Corrected";
    yield* trackChange(
      intelId,
      kind,
      actor,
      approvedAt,
      sql`UPDATE intels SET text = ${text.trim()}, updated_at = ${now} WHERE id = ${intelId}`,
    );
  });

/** Moves an intel to a wider or narrower scope, with new text when given. */
export const moveIntel = (
  intelId: string,
  placement: Placement,
  text: string | null,
  kind: "Widened" | "Narrowed",
  actor: Actor,
  approvedAt: number | null = null,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* trackChange(
      intelId,
      kind,
      actor,
      approvedAt,
      sql`UPDATE intels SET scope = ${placement.scope}, thread_id = ${placement.threadId},
        workspace_id = ${placement.workspaceId}, text = COALESCE(${text?.trim() ?? null}, text), updated_at = ${now}
        WHERE id = ${intelId}`,
    );
  });

/**
 * Gives an intel a replacement's text, kind, and origin; it keeps its identifier, scope, and uses. Restating
 * it makes it active again at full strength (provisional, work-in-progress Batch 14).
 */
export const replaceIntel = (
  intelId: string,
  replacement: { readonly kind: IntelKind; readonly origin: IntelOrigin | null; readonly text: string },
  actor: Actor,
  approvedAt: number | null = null,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const origin = originColumnsOf(replacement.origin);
    yield* trackChange(
      intelId,
      "Replaced",
      actor,
      approvedAt,
      sql`UPDATE intels SET kind = ${replacement.kind}, text = ${replacement.text.trim()}, updated_at = ${now},
        last_used_at = ${now}, origin_kind = ${origin.originKind}, origin_entry = ${origin.originEntry},
        origin_from = ${origin.originFrom}, origin_excerpt = ${origin.originExcerpt}
        WHERE id = ${intelId}`,
    );
  });

/** The owner pins an intel so it never fades, or unpins it. */
export const pinIntel = (intelId: string, isPinned: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* trackChange(
      intelId,
      isPinned ? "Pinned" : "Unpinned",
      owner,
      null,
      sql`UPDATE intels SET is_pinned = ${isPinned ? 1 : 0} WHERE id = ${intelId}`,
    );
  });

/** Deletes an intel; the owner's deletion declines the changes awaiting approval on it. */
export const deleteIntel = (intelId: string, actor: Actor, approvedAt: number | null = null) =>
  trackChange(intelId, "Deleted", actor, approvedAt, removeIntel(intelId, actor));

/**
 * The owner makes a dormant or archived intel active again: its last use becomes now, at full strength,
 * without counting a use (work-in-progress, Batch 13).
 */
export const restoreIntel = (intelId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* trackChange(
      intelId,
      "Restored",
      owner,
      null,
      sql`UPDATE intels SET last_used_at = ${now} WHERE id = ${intelId}`,
    );
  });

/**
 * The owner merges intels into one global intel: each merged intel is deleted and its uses become the kept
 * intel's, which goes global with every intel's uses and the latest last use.
 */
export const mergeIntels = Effect.fnUntraced(function* (keptId: string, mergedIds: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  const states = yield* Effect.forEach([keptId, ...mergedIds], readSnapshot);
  const present = states.filter((state) => state !== null);
  for (const mergedId of mergedIds) {
    yield* trackChange(
      mergedId,
      "Merged",
      owner,
      null,
      Effect.gen(function* () {
        yield* removeIntel(mergedId, owner);
        // Its uses become the kept intel's, so later evidence counts them.
        yield* sql`UPDATE intel_uses SET intel_id = ${keptId} WHERE intel_id = ${mergedId}`;
      }),
    );
  }
  const now = yield* Clock.currentTimeMillis;
  const uses = present.reduce((sum, state) => sum + state.uses, 0);
  const lastUsedAt = Math.max(...present.map((state) => state.lastUsedAt));
  yield* trackChange(
    keptId,
    "Widened",
    owner,
    null,
    sql`UPDATE intels SET scope = 'Global', thread_id = NULL, workspace_id = NULL, uses = ${uses},
      last_used_at = ${lastUsedAt}, updated_at = ${now} WHERE id = ${keptId}`,
  );
});

/**
 * Counts one use of each intel by a thread: it fades slower, and a dormant one is active again (scoped-intel,
 * Fading). A use is not a history entry, but it resets fading, so the steps taken so far are stored first.
 */
export const countUses = Effect.fnUntraced(function* (threadId: string, intelIds: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  yield* recordFadingSteps(intelIds);
  yield* sql`UPDATE intels SET uses = uses + 1, last_used_at = ${now} WHERE id IN ${sql.in(intelIds)}`;
  // Where each use happened is the evidence for narrowing (scoped-intel, Widening and narrowing).
  for (const intelId of intelIds) {
    yield* sql`INSERT INTO intel_uses (intel_id, at, workspace_id)
      SELECT ${intelId}, ${now}, workspace_id FROM threads WHERE id = ${threadId}`;
  }
});

/** The history entry an undo reverts. */
export interface UndoneEntry {
  readonly id: string;
  readonly intelId: string;
  readonly kind: IntelHistoryKind;
}

/**
 * The owner undoes one history entry: the intel takes the state given, or is deleted when it is null. The undo
 * is itself an entry, from the intel's state now to the one restored, and the entry is marked undone.
 */
export const writeUndo = Effect.fnUntraced(function* (entry: UndoneEntry, state: Snapshot | null) {
  const sql = yield* SqlClient.SqlClient;
  const current = yield* readSnapshot(entry.intelId);
  if (current !== null) yield* recordStepsOf(current);
  if (state === null) yield* removeIntel(entry.intelId, owner);
  else yield* writeSnapshot(state);
  yield* insertEntry({
    actor: owner,
    after: state,
    approvedAt: null,
    before: current,
    intelId: entry.intelId,
    kind: "Undone",
    undid: { id: entry.id, kind: entry.kind },
  });
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE intel_history SET undone_at = ${now} WHERE id = ${entry.id}`;
});

/**
 * Erases deleted threads' own intel, deleted ones included, with its history, uses, and the threads' changes,
 * awaiting or done; a mission's deletion names all its threads. Entries the threads made on other intel stay,
 * with their titles as then.
 */
export const eraseThreadsIntel = Effect.fnUntraced(function* (threadIds: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  // The history goes first: a live intel's entries are found from the intel itself.
  yield* sql`DELETE FROM intel_history WHERE intel_id IN (
      SELECT id FROM intels WHERE scope = 'Thread' AND thread_id IN ${sql.in(threadIds)}
      UNION
      SELECT h.intel_id FROM intel_history h
      WHERE h.intel_id NOT IN (SELECT id FROM intels) AND h.scope_thread_id IN ${sql.in(threadIds)}
        AND h.rowid = (SELECT MAX(rowid) FROM intel_history WHERE intel_id = h.intel_id AND actor != 'Fading')
    )`;
  yield* sql`DELETE FROM intel_uses WHERE intel_id IN (
      SELECT id FROM intels WHERE scope = 'Thread' AND thread_id IN ${sql.in(threadIds)})`;
  yield* sql`DELETE FROM intels WHERE scope = 'Thread' AND thread_id IN ${sql.in(threadIds)}`;
  yield* sql`DELETE FROM intel_changes WHERE thread_id IN ${sql.in(threadIds)}
    OR scope_thread_id IN ${sql.in(threadIds)}`;
});
