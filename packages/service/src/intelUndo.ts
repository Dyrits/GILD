import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "./errors.ts";
import {
  insertEntry,
  isFadingEntryId,
  markUndone,
  owner,
  readEntry,
  readSnapshot,
  recordFadingSteps,
  type Snapshot,
  writeSnapshot,
} from "./intelHistory.ts";

// Undoing a change to intel (scoped-intel, History and undo): the owner puts back what one change changed,
// recorded as a new entry that can itself be undone.

/**
 * The intel as it is now with what the change changed put back: text, kind, scope, pin, and origin. Uses are
 * never taken back; its last use goes back only when no use came after the change (work-in-progress, Batch 15).
 */
const revertedOf = (current: Snapshot, before: Snapshot, after: Snapshot, now: number): Snapshot => {
  const back = <K extends keyof Snapshot>(field: K) =>
    before[field] !== after[field] ? before[field] : current[field];
  return {
    ...current,
    isPinned: back("isPinned"),
    kind: back("kind"),
    lastUsedAt: current.lastUsedAt === after.lastUsedAt ? before.lastUsedAt : current.lastUsedAt,
    originEntry: back("originEntry"),
    originExcerpt: back("originExcerpt"),
    originFrom: back("originFrom"),
    originKind: back("originKind"),
    scope: back("scope"),
    text: back("text"),
    threadId: back("threadId"),
    updatedAt: now,
    workspaceId: back("workspaceId"),
  };
};

/** Deletes an intel; its changes awaiting approval are declined, as with the owner's deletion. */
const removeIntel = (intelId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`DELETE FROM intels WHERE id = ${intelId}`;
    yield* sql`UPDATE intel_changes SET status = 'Declined', resolved_at = ${now}
      WHERE intel_id = ${intelId} AND status = 'Awaiting'`;
  });

/**
 * The owner undoes one entry of an intel's history: a save is undone by deleting the intel, a deletion by
 * restoring it with its identifier and uses, any other change by putting back what it changed. Fading steps
 * are restored with Restore instead. Callers run it in a transaction.
 */
export const undoIntelChange = (entryId: string) =>
  Effect.gen(function* () {
    if (isFadingEntryId(entryId)) {
      return yield* invalid("A fading step cannot be undone: restore the intel instead.");
    }
    const entry = yield* readEntry(entryId);
    if (entry === null) return yield* notFound("No such change in the intel's history.");
    if (entry.undoneAt !== null) return yield* invalid("This change was already undone.");
    const current = yield* readSnapshot(entry.intelId);
    const now = yield* Clock.currentTimeMillis;
    const undid = { id: entryId, kind: entry.kind };
    if (current !== null) yield* recordFadingSteps(current);
    if (entry.before === null) {
      if (current === null) return yield* invalid("This intel is already deleted.");
      yield* removeIntel(entry.intelId);
      yield* insertEntry({
        actor: owner,
        after: null,
        approvedAt: null,
        before: current,
        intelId: entry.intelId,
        kind: "Undone",
        undid,
      });
    } else if (entry.after === null) {
      if (current !== null) return yield* invalid("This intel exists again.");
      yield* writeSnapshot(entry.before);
      yield* insertEntry({
        actor: owner,
        after: entry.before,
        approvedAt: null,
        before: null,
        intelId: entry.intelId,
        kind: "Undone",
        undid,
      });
    } else {
      if (current === null) return yield* invalid("This intel is deleted: undo its deletion first.");
      const reverted = revertedOf(current, entry.before, entry.after, now);
      yield* writeSnapshot(reverted);
      yield* insertEntry({
        actor: owner,
        after: reverted,
        approvedAt: null,
        before: current,
        intelId: entry.intelId,
        kind: "Undone",
        undid,
      });
    }
    yield* markUndone(entryId);
    return null;
  });
