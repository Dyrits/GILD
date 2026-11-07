import { join } from "node:path";
import type { DeletionPreview } from "@canopy/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { Changes } from "./changes.ts";
import { invalid, notFound, ServiceFailure } from "./errors.ts";
import { eraseThreadIntel } from "./intel.ts";
import { eraseThreadHistory } from "./intelHistory.ts";
import { haltThreads, releaseResolvedChatter } from "./lifecycle.ts";
import { removeScratch } from "./scratch.ts";
import { ScratchRoot, Threads } from "./threads.ts";

const readSubtree = Effect.fn("readSubtree")(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string; missionId: string; parentId: string | null; running: number; depth: number }>`
    WITH RECURSIVE subtree(id, depth) AS (
      SELECT id, 0 FROM threads WHERE id = ${threadId}
      UNION ALL SELECT t.id, s.depth + 1 FROM threads t JOIN subtree s ON t.parent_id = s.id
    )
    SELECT t.id, t.mission_id AS missionId, t.parent_id AS parentId, s.depth,
      EXISTS(SELECT 1 FROM turns WHERE thread_id = t.id AND status = 'running') AS running
    FROM threads t JOIN subtree s ON s.id = t.id ORDER BY s.depth, t.id`;
  if (rows.length === 0) return yield* notFound("No such thread.");
  return rows;
});

const previewOf = (rows: Effect.Success<ReturnType<typeof readSubtree>>): DeletionPreview => ({
  confirmation: JSON.stringify(rows.map(({ id, running }) => [id, running])),
  descendantCount: rows.length - 1,
  isMission: rows[0]?.parentId === null,
  runningCount: rows.filter((row) => row.running === 1).length,
});

/** The exact subtree and live turns the owner's one deletion confirmation covers. */
export const previewDeletion = (threadId: string) => readSubtree(threadId).pipe(Effect.map(previewOf));

/** Permanently erases the confirmed subtree after invalidating and cancelling all its turns. */
export const deleteThread = Effect.fn("deleteThread")(function* (threadId: string, confirmation: string) {
  const sql = yield* SqlClient.SqlClient;
  const threads = yield* Threads;
  const changes = yield* Changes;
  const scratchRoot = yield* ScratchRoot;
  const rows = yield* sql.withTransaction(
    Effect.gen(function* () {
      const rows = yield* readSubtree(threadId);
      if (previewOf(rows).confirmation !== confirmation) {
        return yield* new ServiceFailure({
          kind: "StaleVersion",
          message: "The threads changed. Review the deletion count again.",
        });
      }
      const ids = rows.map((row) => row.id);
      yield* sql`UPDATE threads SET is_deleting = 1 WHERE id IN ${sql.in(ids)}`;
      yield* haltThreads(ids, "Stopped");
      yield* sql.afterCommit(changes.publish);
      return rows;
    }),
  );
  const root = rows[0];
  if (root === undefined) return yield* invalid("No thread to delete.");
  const ids = rows.map((row) => row.id);
  yield* threads.cancel(ids);
  if (root.parentId === null) yield* removeScratch(join(scratchRoot, root.missionId));
  yield* sql.withTransaction(
    Effect.gen(function* () {
      // A received message belongs to its receiver's history, even after its sender is deleted.
      yield* sql`UPDATE messages SET sender_thread_id = NULL WHERE sender_thread_id IN ${sql.in(ids)}`;
      yield* sql`DELETE FROM command_outcomes WHERE json_extract(outcome, '$.threadId') IN ${sql.in(ids)}
      OR json_extract(outcome, '$.messageId') IN (SELECT id FROM messages WHERE thread_id IN ${sql.in(ids)})`;
      yield* sql`DELETE FROM messages WHERE thread_id IN ${sql.in(ids)}`;
      yield* sql`DELETE FROM chatter WHERE first_id IN ${sql.in(ids)} OR second_id IN ${sql.in(ids)}`;
      yield* releaseResolvedChatter;
      yield* sql`DELETE FROM questions WHERE thread_id IN ${sql.in(ids)}`;
      yield* sql`DELETE FROM suggestions WHERE thread_id IN ${sql.in(ids)}`;
      // Before the intel goes: its history is found from it.
      yield* eraseThreadHistory(ids);
      yield* eraseThreadIntel(ids);
      // Usage stays: deleting never gives spending back to a budget (budget-control).
      yield* sql`DELETE FROM turns WHERE thread_id IN ${sql.in(ids)}`;
      if (root.parentId === null) {
        // Before the threads go: the top thread marked as deleting is what lets the entries go (store.ts, 0011).
        yield* sql`DELETE FROM journal_entries WHERE mission_id = ${root.missionId}`;
        yield* sql`DELETE FROM journals WHERE mission_id = ${root.missionId}`;
      }
      for (const row of rows.toReversed()) yield* sql`DELETE FROM threads WHERE id = ${row.id}`;
      if (root.parentId === null) {
        yield* sql`DELETE FROM standing_permissions WHERE mission_id = ${root.missionId}`;
        yield* sql`DELETE FROM budget_events WHERE mission_id = ${root.missionId}`;
        yield* sql`DELETE FROM budget_stops WHERE mission_id = ${root.missionId}`;
        yield* sql`DELETE FROM missions WHERE id = ${root.missionId}`;
      }
      yield* sql.afterCommit(changes.publish);
    }),
  );
  // Freed running slots let the mission's waiting threads run.
  if (root.parentId !== null) yield* threads.wakeMission(root.missionId);
  return null;
});
