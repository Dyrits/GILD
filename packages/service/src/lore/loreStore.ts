import type { LoreHistoryKind, LoreKind, LoreOrigin } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Placement } from "./lore.ts";
import { readFading } from "./loreFading.ts";
import {
  type Actor,
  fadingEntryIdOf,
  owner,
  readSnapshot,
  type Snapshot,
  threadActor,
  unrecordedStepsOf,
} from "./loreHistory.ts";
import { originColumnsOf } from "./loreOrigins.ts";

// Stored and wire names keep `intel` so existing data and agents still work: table and column names (`intels`, `intel_id`, ...).

// The lore store (scoped-intel, History and undo): the only writer of lore entries, their history, and their uses.
// Each operation records its own history entry, and stores the fading steps a lore entry took before a change
// resets them, so no caller can forget either. Callers run every operation in a transaction.

/** Stores a lore entry's state, creating or overwriting it. */
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
  readonly kind: LoreHistoryKind;
  readonly loreEntryId: string;
  readonly undid: { readonly id: string; readonly kind: LoreHistoryKind } | null;
}

/** Adds one history entry made by a thread or the owner. */
const insertEntry = Effect.fnUntraced(function* (entry: EntryRecord) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const threadId = entry.actor.kind === "Thread" ? entry.actor.threadId : null;
  const state = entry.after ?? entry.before;
  yield* sql`INSERT INTO intel_history (id, intel_id, kind, actor, actor_thread_id, actor_title, at, approved_at,
      before_state, after_state, scope_thread_id, undid, undo_of)
    VALUES (${crypto.randomUUID()}, ${entry.loreEntryId}, ${entry.kind}, ${entry.actor.kind}, ${threadId},
      (SELECT title FROM threads WHERE id = ${threadId}), ${now}, ${entry.approvedAt},
      ${entry.before === null ? null : JSON.stringify(entry.before)},
      ${entry.after === null ? null : JSON.stringify(entry.after)}, ${state?.threadId ?? null},
      ${entry.undid?.kind ?? null}, ${entry.undid?.id ?? null})`;
});

/** Stores the fading steps a lore entry took since its last use and that are not stored yet. */
const recordStepsOf = Effect.fnUntraced(function* (state: Snapshot) {
  const sql = yield* SqlClient.SqlClient;
  for (const step of yield* unrecordedStepsOf(state, yield* readFading)) {
    yield* sql`INSERT INTO intel_history (id, intel_id, kind, actor, at, scope_thread_id)
      VALUES (${fadingEntryIdOf(state.id, step.kind, step.at)}, ${state.id}, ${step.kind}, 'Fading', ${step.at},
        ${state.threadId})`;
  }
});

/**
 * Stores the fading steps each lore entry took since its last use, so they stay in its history once something
 * resets its fading (a use, a restore, a replacement, a pin, a deletion).
 */
export const recordFadingSteps = (loreEntryIds: ReadonlyArray<string>) =>
  Effect.forEach(
    loreEntryIds,
    (loreEntryId) =>
      readSnapshot(loreEntryId).pipe(Effect.flatMap((state) => (state === null ? Effect.void : recordStepsOf(state)))),
    { discard: true },
  );

/** Runs a change to one lore entry and records it with the state before and after, fading steps up to now first. */
const trackChange = <E, R>(
  loreEntryId: string,
  kind: LoreHistoryKind,
  actor: Actor,
  approvedAt: number | null,
  change: Effect.Effect<unknown, E, R>,
) =>
  Effect.gen(function* () {
    const before = yield* readSnapshot(loreEntryId);
    if (before !== null) yield* recordStepsOf(before);
    yield* change;
    const after = yield* readSnapshot(loreEntryId);
    yield* insertEntry({ actor, after, approvedAt, before, kind, loreEntryId, undid: null });
  });

/** Deletes a lore entry; a deletion by the owner also declines the changes awaiting approval on it. */
const removeLoreEntry = Effect.fnUntraced(function* (loreEntryId: string, actor: Actor) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DELETE FROM intels WHERE id = ${loreEntryId}`;
  // A thread's deletion leaves them for the owner, who finds nothing left to change (scoped-intel, Correcting).
  if (actor.kind !== "Owner") return;
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE intel_changes SET status = 'Declined', resolved_at = ${now}
    WHERE intel_id = ${loreEntryId} AND status = 'Awaiting'`;
});

/** A new lore entry as a thread saves it, with what it rests on. */
export interface NewLoreEntry {
  readonly kind: LoreKind;
  readonly origin: LoreOrigin | null;
  readonly placement: Placement;
  readonly text: string;
  /** The thread that saved it, which is the actor of its save. */
  readonly threadId: string;
}

/** Saves a new lore entry and records its save, approved by the owner when the time is given; returns its id. */
export const insertLoreEntry = Effect.fnUntraced(function* (loreEntry: NewLoreEntry, approvedAt: number | null = null) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const id = crypto.randomUUID();
  const origin = originColumnsOf(loreEntry.origin);
  const { placement } = loreEntry;
  yield* sql`INSERT INTO intels (id, scope, kind, thread_id, workspace_id, text, saved_by_thread_id, saved_by_title,
      saved_at, updated_at, last_used_at, origin_kind, origin_entry, origin_from, origin_excerpt)
    VALUES (${id}, ${placement.scope}, ${loreEntry.kind}, ${placement.threadId}, ${placement.workspaceId},
      ${loreEntry.text.trim()}, ${loreEntry.threadId}, (SELECT title FROM threads WHERE id = ${loreEntry.threadId}), ${now},
      ${now}, ${now}, ${origin.originKind}, ${origin.originEntry}, ${origin.originFrom}, ${origin.originExcerpt})`;
  const after = yield* readSnapshot(id);
  yield* insertEntry({
    actor: threadActor(loreEntry.threadId),
    after,
    approvedAt,
    before: null,
    kind: "Saved",
    loreEntryId: id,
    undid: null,
  });
  return id;
});

/** Corrects a lore entry's text where it is: Edited by the owner, Corrected by a thread. */
export const correctLoreEntry = (loreEntryId: string, text: string, actor: Actor, approvedAt: number | null = null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const kind = actor.kind === "Owner" ? "Edited" : "Corrected";
    yield* trackChange(
      loreEntryId,
      kind,
      actor,
      approvedAt,
      sql`UPDATE intels SET text = ${text.trim()}, updated_at = ${now} WHERE id = ${loreEntryId}`,
    );
  });

/** Moves a lore entry to a wider or narrower scope, with new text when given. */
export const moveLoreEntry = (
  loreEntryId: string,
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
      loreEntryId,
      kind,
      actor,
      approvedAt,
      sql`UPDATE intels SET scope = ${placement.scope}, thread_id = ${placement.threadId},
        workspace_id = ${placement.workspaceId}, text = COALESCE(${text?.trim() ?? null}, text), updated_at = ${now}
        WHERE id = ${loreEntryId}`,
    );
  });

/**
 * Gives a lore entry a replacement's text, kind, and origin; it keeps its identifier, scope, and uses. Restating
 * it makes it active again at full strength (provisional, work-in-progress Batch 14).
 */
export const replaceLoreEntry = (
  loreEntryId: string,
  replacement: { readonly kind: LoreKind; readonly origin: LoreOrigin | null; readonly text: string },
  actor: Actor,
  approvedAt: number | null = null,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const origin = originColumnsOf(replacement.origin);
    yield* trackChange(
      loreEntryId,
      "Replaced",
      actor,
      approvedAt,
      sql`UPDATE intels SET kind = ${replacement.kind}, text = ${replacement.text.trim()}, updated_at = ${now},
        last_used_at = ${now}, origin_kind = ${origin.originKind}, origin_entry = ${origin.originEntry},
        origin_from = ${origin.originFrom}, origin_excerpt = ${origin.originExcerpt}
        WHERE id = ${loreEntryId}`,
    );
  });

/** The owner pins a lore entry so it never fades, or unpins it. */
export const pinLoreEntry = (loreEntryId: string, isPinned: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* trackChange(
      loreEntryId,
      isPinned ? "Pinned" : "Unpinned",
      owner,
      null,
      sql`UPDATE intels SET is_pinned = ${isPinned ? 1 : 0} WHERE id = ${loreEntryId}`,
    );
  });

/** Deletes a lore entry; the owner's deletion declines the changes awaiting approval on it. */
export const deleteLoreEntry = (loreEntryId: string, actor: Actor, approvedAt: number | null = null) =>
  trackChange(loreEntryId, "Deleted", actor, approvedAt, removeLoreEntry(loreEntryId, actor));

/**
 * The owner makes a dormant or archived lore active again: its last use becomes now, at full strength,
 * without counting a use (work-in-progress, Batch 13).
 */
export const restoreLoreEntry = (loreEntryId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* trackChange(
      loreEntryId,
      "Restored",
      owner,
      null,
      sql`UPDATE intels SET last_used_at = ${now} WHERE id = ${loreEntryId}`,
    );
  });

/**
 * The owner merges lore entries into one global lore entry: each merged lore entry is deleted and its uses become the kept
 * lore entry's, which goes global with every lore entry's uses and the latest last use.
 */
export const mergeLoreEntries = Effect.fnUntraced(function* (keptId: string, mergedIds: ReadonlyArray<string>) {
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
        yield* removeLoreEntry(mergedId, owner);
        // Its uses become the kept lore entry's, so later evidence counts them.
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
 * Counts one use of each lore entry by a thread: it fades slower, and a dormant one is active again (scoped-intel,
 * Fading). A use is not a history entry, but it resets fading, so the steps taken so far are stored first.
 */
export const countUses = Effect.fnUntraced(function* (threadId: string, loreEntryIds: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  yield* recordFadingSteps(loreEntryIds);
  yield* sql`UPDATE intels SET uses = uses + 1, last_used_at = ${now} WHERE id IN ${sql.in(loreEntryIds)}`;
  // Where each use happened is the evidence for narrowing (scoped-intel, Widening and narrowing).
  for (const loreEntryId of loreEntryIds) {
    yield* sql`INSERT INTO intel_uses (intel_id, at, workspace_id)
      SELECT ${loreEntryId}, ${now}, workspace_id FROM threads WHERE id = ${threadId}`;
  }
});

/** The history entry an undo reverts. */
export interface UndoneEntry {
  readonly id: string;
  readonly kind: LoreHistoryKind;
  readonly loreEntryId: string;
}

/**
 * The owner undoes one history entry: the lore entry takes the state given, or is deleted when it is null. The undo
 * is itself an entry, from the lore entry's state now to the one restored, and the entry is marked undone.
 */
export const writeUndo = Effect.fnUntraced(function* (entry: UndoneEntry, state: Snapshot | null) {
  const sql = yield* SqlClient.SqlClient;
  const current = yield* readSnapshot(entry.loreEntryId);
  if (current !== null) yield* recordStepsOf(current);
  if (state === null) yield* removeLoreEntry(entry.loreEntryId, owner);
  else yield* writeSnapshot(state);
  yield* insertEntry({
    actor: owner,
    after: state,
    approvedAt: null,
    before: current,
    kind: "Undone",
    loreEntryId: entry.loreEntryId,
    undid: { id: entry.id, kind: entry.kind },
  });
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE intel_history SET undone_at = ${now} WHERE id = ${entry.id}`;
});

/**
 * Erases deleted threads' own lore, deleted ones included, with its history, uses, and the threads' changes,
 * awaiting or done; a mission's deletion names all its threads. Entries the threads made on other lore stay,
 * with their titles as then.
 */
export const eraseThreadsLore = Effect.fnUntraced(function* (threadIds: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  // The history goes first: a live lore entry's entries are found from the lore itself.
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
