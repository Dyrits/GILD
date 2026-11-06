import type { EndingPreview, MissionEnding, MissionPrompt } from "@openmission/contracts";
import { Clock, Effect, Layer, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import { Changes } from "./changes.ts";
import { invalid, notFound, ServiceFailure } from "./errors.ts";
import { updateJournal } from "./journal.ts";
import { haltThreads } from "./lifecycle.ts";
import { readSettings } from "./settings.ts";
import { Threads } from "./threads.ts";
import { activeStates } from "./tree.ts";

const day = 24 * 60 * 60 * 1000;

/** The journal entry for each way a mission ends or continues (mission-journal, When a mission ends). */
const entries = {
  Archived: "Archived by the user",
  AutoArchived: "Archived automatically",
  Done: "Marked done by the user",
  Reopened: "Reopened by the user",
} as const;

const questionEndings = { Archived: "archive", Done: "mark as done" } satisfies Record<MissionEnding, string>;

/**
 * The confirmation naming the threads still at work. Threads in Attention count too, so no question stays open
 * on an ended mission (provisional: CHG-0045, work-in-progress Batch 9).
 */
export const endingQuestionOf = (count: number, ending: MissionEnding) =>
  count === 1
    ? `1 thread is still running. Stop it and ${questionEndings[ending]}?`
    : `${count} threads are still running. Stop them and ${questionEndings[ending]}?`;

const readWorking = Effect.fn("readWorking")(function* (missionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [mission] = yield* sql<{ ending: MissionEnding | null }>`SELECT ending FROM missions WHERE id = ${missionId}`;
  if (mission === undefined) return yield* notFound("No such mission.");
  const rows = yield* sql<{ id: string }>`SELECT id FROM threads
    WHERE mission_id = ${missionId} AND is_deleting = 0 AND state IN ${sql.in(activeStates)} ORDER BY id`;
  return rows.map((row) => row.id);
});

/** What ending the mission this way would stop. */
export const previewEnding = (missionId: string, ending: MissionEnding) =>
  readWorking(missionId).pipe(
    Effect.map(
      (ids): EndingPreview => ({
        question: ids.length === 0 ? null : endingQuestionOf(ids.length, ending),
        snapshot: JSON.stringify(ids),
        workingCount: ids.length,
      }),
    ),
  );

/** Records the ending and its journal entry. Callers run it in a transaction. */
const recordEnding = (missionId: string, ending: MissionEnding, entry: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE missions SET ending = ${ending}, is_asking_done = 0,
      done_at = ${ending === "Done" ? now : sql`done_at`} WHERE id = ${missionId}`;
    yield* updateJournal(missionId, { kind: "user" }, entry, null);
  });

/** Marks a mission Done or archives it, stopping exactly the threads at work the owner's preview named. */
export const endMission = Effect.fn("endMission")(function* (
  missionId: string,
  ending: MissionEnding,
  snapshot: string,
) {
  const sql = yield* SqlClient.SqlClient;
  const threads = yield* Threads;
  const changes = yield* Changes;
  const stopped = yield* sql.withTransaction(
    Effect.gen(function* () {
      const ids = yield* readWorking(missionId);
      if (JSON.stringify(ids) !== snapshot) {
        return yield* new ServiceFailure({
          kind: "StaleVersion",
          message: "The threads at work changed. Review them again before ending the mission.",
        });
      }
      yield* haltThreads(ids, "Stopped");
      yield* recordEnding(missionId, ending, entries[ending]);
      yield* sql.afterCommit(changes.publish);
      return ids;
    }),
  );
  yield* threads.cancel(stopped);
  return null;
});

/** Returns an ended mission to the state worked out from its threads. */
export const reopenMission = Effect.fn("reopenMission")(function* (missionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [mission] = yield* sql<{ ending: string | null }>`SELECT ending FROM missions WHERE id = ${missionId}`;
  if (mission === undefined) return yield* notFound("No such mission.");
  if (mission.ending === null) return yield* invalid("This mission has not ended.");
  yield* sql`UPDATE missions SET ending = NULL WHERE id = ${missionId}`;
  yield* updateJournal(missionId, { kind: "user" }, entries.Reopened, null);
  return null;
});

/** Not now on a dashboard question; the inactivity question then counts its period from now. */
export const dismissPrompt = Effect.fn("dismissPrompt")(function* (missionId: string, prompt: MissionPrompt) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  yield* prompt === "MarkDone"
    ? sql`UPDATE missions SET is_asking_done = 0 WHERE id = ${missionId}`
    : sql`UPDATE missions SET inactivity_dismissed_at = ${now} WHERE id = ${missionId}`;
  return null;
});

/** Archives the Done missions past the auto-archive delay, when the setting is on. */
const archiveDueMissions = (delayDays: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const now = yield* Clock.currentTimeMillis;
    const due = yield* sql<{ id: string }>`SELECT id FROM missions
      WHERE ending = 'Done' AND done_at IS NOT NULL AND done_at <= ${now - delayDays * day}`;
    if (due.length === 0) return;
    yield* sql.withTransaction(
      Effect.gen(function* () {
        for (const { id } of due) yield* recordEnding(id, "Archived", entries.AutoArchived);
        yield* sql.afterCommit(changes.publish);
      }),
    );
  });

/**
 * Runs auto-archive at startup and then hourly (provisional: CHG-0045, work-in-progress Batch 9). Each run also
 * announces a change: the inactivity question depends on time alone, so open dashboards refetch to show it.
 */
export const autoArchiveLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const changes = yield* Changes;
    const sweep = readSettings.pipe(
      Effect.flatMap((settings) =>
        settings.shouldAutoArchive ? archiveDueMissions(settings.autoArchiveDays) : Effect.void,
      ),
      Effect.andThen(changes.publish),
      Effect.orDie,
    );
    yield* Effect.forkScoped(sweep.pipe(Effect.repeat(Schedule.spaced("1 hour"))));
  }),
);
