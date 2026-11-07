import { Clock, Effect } from "effect";
import { invalid, notFound } from "./errors.ts";
import { isFadingEntryId, readEntry, readSnapshot, type Snapshot } from "./intelHistory.ts";
import { writeUndo } from "./intelStore.ts";

// Undoing a change to intel (scoped-intel, History and undo): the owner puts back what one change changed,
// recorded as a new entry that can itself be undone. This module decides what an undo puts back; the intel
// store writes it.

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
    // What the undo puts back: nothing for a save, the intel for a deletion, the changed fields otherwise.
    if (entry.before === null) {
      if (current === null) return yield* invalid("This intel is already deleted.");
      yield* writeUndo(entry, null);
    } else if (entry.after === null) {
      if (current !== null) return yield* invalid("This intel exists again.");
      yield* writeUndo(entry, entry.before);
    } else {
      if (current === null) return yield* invalid("This intel is deleted: undo its deletion first.");
      yield* writeUndo(entry, revertedOf(current, entry.before, entry.after, yield* Clock.currentTimeMillis));
    }
    return null;
  });
