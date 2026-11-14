import {
  type Crest,
  type Ritual,
  type RitualCompanion,
  RitualCompanion as RitualCompanionSchema,
  type RitualSchedule,
  type RitualScope,
  RitualScope as RitualScopeSchema,
} from "@iskios/contracts";
import { Clock, Effect, Exit, Layer, PubSub, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { Changes, invalid, notFound } from "../core/index.ts";
import { Commands, changed, unchanged, type WithFollowUps } from "./commands.ts";
import { changeThreadRunner } from "./handover.ts";
import { insertMessage } from "./messaging.ts";
import { insertQuest } from "./missions.ts";
import { nextRunAfter, runStateOf, scheduleOf } from "./ritualSchedule.ts";

// Rituals (rituals): an instruction run on a schedule, or by hand, in a quest of its own. Each run is a message to the quest's
// main thread; a failed run falls back to the next Companion of the list, through a handover (thread-handover).

/** The longest the scheduler sleeps, so a Ritual changed behind its back is still found within the hour. */
const longestSleepMillis = 60 * 60 * 1000;
/** How late a scheduled run may start: one that is later than this was missed while the service was down, and is skipped. */
const graceMillis = 5 * 60 * 1000;

const decodeCompanion = Schema.decodeUnknownSync(RitualCompanionSchema);
const decodeFallbacks = Schema.decodeUnknownSync(Schema.Array(RitualCompanionSchema));
const decodeScope = Schema.decodeUnknownSync(RitualScopeSchema);

interface RitualRow {
  readonly authority: string;
  readonly createdAt: number;
  readonly fallbackStep: number;
  readonly fallbacks: string;
  readonly id: string;
  readonly instruction: string;
  readonly isOn: number;
  readonly isRealmArchived: number;
  readonly lastRunAt: number | null;
  readonly lastRunState: string | null;
  readonly missionId: string;
  readonly nextRunAt: number | null;
  readonly primaryCompanion: string;
  readonly schedule: string;
  readonly threadId: string;
  readonly threadState: string;
  readonly title: string;
}

/** The Rituals matching a condition, with their quest's top thread. */
const readRows = (
  condition: "all" | { readonly id: string } | { readonly missionId: string } | { readonly threadId: string },
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const where =
      condition === "all"
        ? sql`1 = 1`
        : "id" in condition
          ? sql`r.id = ${condition.id}`
          : "missionId" in condition
            ? sql`r.mission_id = ${condition.missionId}`
            : sql`m.top_thread_id = ${condition.threadId}`;
    return yield* sql<RitualRow>`
      SELECT r.id, r.mission_id AS missionId, m.top_thread_id AS threadId, t.state AS threadState, m.title,
        r.authority, r.instruction, r.schedule, r.primary_companion AS primaryCompanion, r.fallbacks, r.is_on AS isOn,
        EXISTS (SELECT 1 FROM workspaces w WHERE w.id = t.workspace_id AND w.archived_at IS NOT NULL) AS isRealmArchived,
        r.next_run_at AS nextRunAt, r.last_run_at AS lastRunAt, r.last_run_state AS lastRunState,
        r.fallback_step AS fallbackStep, r.created_at AS createdAt
      FROM rituals r JOIN missions m ON m.id = r.mission_id JOIN threads t ON t.id = m.top_thread_id
      WHERE ${where}`;
  });

const ritualOf = (row: RitualRow): Ritual =>
  ({
    fallbacks: decodeFallbacks(JSON.parse(row.fallbacks)),
    id: row.id,
    instruction: row.instruction,
    isOn: row.isOn === 1,
    isRealmArchived: row.isRealmArchived === 1,
    lastRunAt: row.lastRunAt,
    lastRunState: runStateOf(row.lastRunState, row.threadState),
    missionId: row.missionId,
    nextRunAt: row.nextRunAt,
    primary: decodeCompanion(JSON.parse(row.primaryCompanion)),
    schedule: scheduleOf(row.schedule),
    // Stored as `authority` (migration 0044): the owner's reviewed scope, empty by default.
    scope: decodeScope(JSON.parse(row.authority)),
    threadId: row.threadId,
    title: row.title,
  }) as Ritual;

/** The quest's Ritual, or null when the quest is not a Ritual's. */
export const readRitual = (missionId: string) =>
  Effect.gen(function* () {
    const [row] = yield* readRows({ missionId });
    return row === undefined ? null : ritualOf(row);
  });

/** Every Ritual, the latest first. */
export const listRituals = Effect.gen(function* () {
  const rows = yield* readRows("all");
  return rows.toSorted((a, b) => b.createdAt - a.createdAt).map(ritualOf);
});

/** What a Ritual's quest and thread are named. */
const renameQuest = (missionId: string, threadId: string, title: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE missions SET title = ${title}, is_title_by_user = 1 WHERE id = ${missionId}`;
    yield* sql`UPDATE threads SET title = ${title} WHERE id = ${threadId}`;
  });

/** Creates a Ritual and its quest, whose thread takes the primary Companion. Nothing runs yet. */
export const createRitual = (input: {
  /** The owner's reviewed scope, already validated (ritualScope.ts); empty when left out. */
  readonly scope?: RitualScope;
  readonly fallbacks: ReadonlyArray<RitualCompanion>;
  readonly instruction: string;
  readonly primary: RitualCompanion;
  readonly realm: { crest: Crest | null; name: string } | null;
  readonly schedule: RitualSchedule;
  readonly title: string;
  readonly workspacePath: string | null;
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const quest = yield* insertQuest(
      {
        firstMessage: null,
        isTitleByOwner: true,
        realm: input.realm,
        shouldRememberChoices: false,
        title: input.title,
      },
      input.primary,
      input.workspacePath,
    );
    const now = yield* Clock.currentTimeMillis;
    const ritualId = crypto.randomUUID();
    yield* sql`INSERT INTO rituals (id, mission_id, instruction, schedule, primary_companion, fallbacks, is_on, next_run_at, created_at, authority)
      VALUES (${ritualId}, ${quest.missionId}, ${input.instruction}, ${JSON.stringify(input.schedule)},
        ${JSON.stringify(input.primary)}, ${JSON.stringify(input.fallbacks)}, 1, ${nextRunAfter(input.schedule, now)}, ${now}, ${JSON.stringify(input.scope ?? [])})`;
    return changed({ missionId: quest.missionId, ritualId, threadId: quest.threadId });
  });

/** Replaces a Ritual's fields; the next run is worked out again only when the schedule or the switch changed. */
export const updateRitual = (input: {
  /** The owner's reviewed scope, already validated, replacing the current one; kept when left out. */
  readonly scope?: RitualScope;
  readonly fallbacks: ReadonlyArray<RitualCompanion>;
  readonly instruction: string;
  readonly isOn: boolean;
  readonly primary: RitualCompanion;
  readonly ritualId: string;
  readonly schedule: RitualSchedule;
  readonly title: string;
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* readRows({ id: input.ritualId });
    if (row === undefined) return yield* notFound("No such Ritual.");
    if (input.isOn && row.isRealmArchived === 1)
      return yield* invalid("Restore this Ritual's archived realm before switching it on.");
    const now = yield* Clock.currentTimeMillis;
    const schedule = JSON.stringify(input.schedule);
    const isSameTiming = row.schedule === schedule && (row.isOn === 1) === input.isOn;
    const nextRunAt = input.isOn ? (isSameTiming ? row.nextRunAt : nextRunAfter(input.schedule, now)) : null;
    yield* sql`UPDATE rituals SET authority = ${input.scope === undefined ? row.authority : JSON.stringify(input.scope)}, instruction = ${input.instruction}, schedule = ${schedule},
      primary_companion = ${JSON.stringify(input.primary)}, fallbacks = ${JSON.stringify(input.fallbacks)},
      is_on = ${input.isOn ? 1 : 0}, next_run_at = ${nextRunAt} WHERE id = ${input.ritualId}`;
    yield* renameQuest(row.missionId, row.threadId, input.title);
    return changed(null);
  });

/** Deletes a Ritual; its quest stays, as an ordinary quest. */
export const deleteRitual = (ritualId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* readRows({ id: ritualId });
    if (row === undefined) return yield* notFound("No such Ritual.");
    yield* sql`DELETE FROM rituals WHERE id = ${ritualId}`;
    return changed(null);
  });

const clockOf = (millis: number) =>
  new Date(millis).toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, minute: "2-digit" });

/** The states in which a Ritual's thread is still at work, so another run would pile onto it. */
const busyStates = ["Running", "Attention", "Waiting"];

/**
 * Starts a run: the thread takes the primary Companion again, then the instruction arrives as a message under its
 * trigger. Returns whether it started; a manual run that cannot start is refused with the reason, a scheduled one skipped.
 */
const beginRun = (
  row: RitualRow,
  trigger: { readonly kind: "manual" } | { readonly dueAt: number; readonly kind: "scheduled" },
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const isManual = trigger.kind === "manual";
    if (busyStates.includes(row.threadState)) {
      if (isManual) return yield* invalid("This Ritual is still running. Wait for it to end or interrupt it.");
      return false;
    }
    if (row.threadState === "Stopped") {
      if (isManual) return yield* invalid("This Ritual's quest is stopped. Resume it first.");
      return false;
    }
    yield* changeThreadRunner(row.threadId, decodeCompanion(JSON.parse(row.primaryCompanion)));
    const now = yield* Clock.currentTimeMillis;
    const label = isManual ? "Ritual · run by you" : `Ritual · scheduled ${clockOf(trigger.dueAt)}`;
    const messageId = yield* insertMessage({
      fromThreadId: null,
      isQueued: false,
      isResult: false,
      text: `${label}\n\n${row.instruction}`,
      threadId: row.threadId,
    });
    // The run's message is the service's, not the owner's: marked so it never counts as the owner's words (CHG-0208).
    yield* sql`INSERT INTO ritual_run_messages (message_id, ritual_id) VALUES (${messageId}, ${row.id})`;
    yield* sql`UPDATE rituals SET last_run_at = ${now}, last_run_state = 'Underway', fallback_step = 0 WHERE id = ${row.id}`;
    return true;
  });

/** Runs a Ritual now, whatever its schedule and switch. */
export const runRitual = (ritualId: string) =>
  Effect.gen(function* () {
    const [row] = yield* readRows({ id: ritualId });
    if (row === undefined) return yield* notFound("No such Ritual.");
    if (row.isRealmArchived === 1) return yield* invalid("Restore this Ritual's archived realm before running it.");
    yield* beginRun(row, { kind: "manual" });
    return changed(null, { threadsToWake: [row.threadId] });
  });

/**
 * Runs every Ritual that is on and due, and moves each to its next time. A run later than the grace was missed while the
 * service was down: it is skipped, not caught up.
 */
export const runDueRituals: Effect.Effect<WithFollowUps<null>, never, SqlClient.SqlClient> = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const rows = (yield* readRows("all")).filter(
    (row) => row.isOn === 1 && row.nextRunAt !== null && row.nextRunAt <= now,
  );
  const toWake: Array<string> = [];
  for (const row of rows) {
    const dueAt = row.nextRunAt ?? now;
    yield* sql`UPDATE rituals SET next_run_at = ${nextRunAfter(scheduleOf(row.schedule), now)} WHERE id = ${row.id}`;
    if (now - dueAt > graceMillis) continue;
    const started = yield* Effect.exit(beginRun(row, { dueAt, kind: "scheduled" }));
    if (Exit.isSuccess(started) && started.value) toWake.push(row.threadId);
  }
  return rows.length === 0 ? unchanged(null) : changed(null, { threadsToWake: toWake });
}).pipe(Effect.orDie);

/** A turn of the Ritual's main thread ended: its run is done, or interrupted. Other threads' turns change nothing. */
export const finishRitualRun = (threadId: string, state: "Done" | "Interrupted") =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE rituals SET last_run_state = ${state}
      WHERE last_run_state = 'Underway' AND mission_id IN (SELECT id FROM missions WHERE top_thread_id = ${threadId})`;
  });

/**
 * A turn of the Ritual's main thread failed: its run carries on with the next Companion of the list that differs from the
 * current one, the conversation handed over to it (the line says why), or fails once the list is used up. Other turns change nothing.
 */
export const fallBackAfterFailure = (threadId: string, reason: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* readRows({ threadId });
    if (row === undefined || row.lastRunState !== "Underway") return unchanged(null);
    const fallbacks = decodeFallbacks(JSON.parse(row.fallbacks));
    for (let index = row.fallbackStep; index < fallbacks.length; index++) {
      const candidate = fallbacks[index];
      if (candidate === undefined) continue;
      const outcome = yield* Effect.exit(changeThreadRunner(threadId, candidate, { fellBackAfter: reason }));
      // A Companion that cannot be taken, such as one on a removed account, or that is already the thread's, is passed over.
      if (!Exit.isSuccess(outcome) || !outcome.value.followUps.isChanged) continue;
      yield* sql`UPDATE rituals SET fallback_step = ${index + 1} WHERE id = ${row.id}`;
      return { followUps: outcome.value.followUps, value: null } satisfies WithFollowUps<null>;
    }
    yield* sql`UPDATE rituals SET last_run_state = 'Failed', fallback_step = ${fallbacks.length} WHERE id = ${row.id}`;
    return changed(null);
  });

/**
 * The scheduler: runs the Rituals that are due, then sleeps until the next one is, waking early on any change, since a
 * Ritual may have been created or edited. It also marks runs the service lost by stopping as interrupted.
 */
export const ritualsLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const commands = yield* Commands;
    const changes = yield* Changes;
    yield* sql`UPDATE rituals SET last_run_state = 'Interrupted' WHERE last_run_state = 'Underway'`.pipe(Effect.orDie);
    const subscription = yield* PubSub.subscribe(changes.pubsub);
    const untilNextRun = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const [next] = yield* sql<{ at: number | null }>`SELECT MIN(next_run_at) AS at FROM rituals
        WHERE is_on = 1 AND next_run_at IS NOT NULL`;
      return Math.max(1, Math.min((next?.at ?? now + longestSleepMillis) - now, longestSleepMillis));
    });
    const watch = Effect.gen(function* () {
      yield* commands.run(runDueRituals);
      const wait = yield* untilNextRun;
      yield* Effect.raceFirst(Effect.sleep(wait), PubSub.take(subscription));
    }).pipe(Effect.forever, Effect.orDie);
    yield* Effect.forkScoped(watch);
  }),
);
