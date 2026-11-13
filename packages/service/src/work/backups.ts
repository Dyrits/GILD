import { BackupCompanion } from "@iskios/contracts";
import { Effect, Exit, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { notFound, readSettings } from "../core/index.ts";
import { checkBackups } from "../harness/index.ts";
import { changed, unchanged, type WithFollowUps } from "./commands.ts";
import { changeThreadRunner } from "./handover.ts";

// Backup Companions (thread-panel, Backups): the Companions a thread falls back to, in order, when a turn fails.

const decodeBackups = Schema.decodeUnknownSync(Schema.Array(BackupCompanion));

/** Saves a thread's backups; the failure chain starts over. Each account must exist and belong to its harness. */
export const setThreadBackups = (threadId: string, backups: ReadonlyArray<BackupCompanion>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [thread] = yield* sql<{ id: string }>`SELECT id FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
    if (thread === undefined) return yield* notFound("No such thread.");
    yield* checkBackups(backups);
    yield* sql`UPDATE threads SET backups = ${JSON.stringify(backups)}, backup_step = 0 WHERE id = ${threadId}`;
    return changed(null);
  });

/** Saves the backups a card named for the quest it opened, a refusal rolling back the quest too; a card naming none, or the Workshop's own default list, leaves the list the quest started with. */
export const setCardBackups = (threadId: string | null, backups: ReadonlyArray<BackupCompanion> | undefined) =>
  Effect.gen(function* () {
    const { backups: defaults } = yield* readSettings;
    if (threadId === null || backups === undefined || JSON.stringify(backups) === JSON.stringify(defaults)) return;
    yield* setThreadBackups(threadId, backups);
  });

/** The failure chain starts over: a turn completed, or the owner chose a runner. */
export const resetBackupStep = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET backup_step = 0 WHERE id = ${threadId} AND backup_step != 0`;
  });

/**
 * A turn of the thread failed: the thread carries on with the next backup that differs from its current runner, the
 * conversation handed over to it (the line says why). Nothing happens when the list is used up. A backup that cannot be
 * taken, such as one on a removed account, is passed over.
 */
export const fallBackToBackup = (threadId: string, reason: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ backups: string; step: number }>`
      SELECT backups, backup_step AS step FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
    if (row === undefined) return unchanged(null);
    const backups = decodeBackups(JSON.parse(row.backups));
    for (let index = row.step; index < backups.length; index++) {
      const candidate = backups[index];
      if (candidate === undefined) continue;
      const outcome = yield* Effect.exit(changeThreadRunner(threadId, candidate, { fellBackAfter: reason }));
      if (!Exit.isSuccess(outcome) || !outcome.value.followUps.isChanged) continue;
      yield* sql`UPDATE threads SET backup_step = ${index + 1} WHERE id = ${threadId}`;
      return { followUps: outcome.value.followUps, value: null } satisfies WithFollowUps<null>;
    }
    return unchanged(null);
  });
