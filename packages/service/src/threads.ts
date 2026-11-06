import { join } from "node:path";
import type { EffortChoice, ModelChoice } from "@openmission/contracts";
import { Clock, Context, Effect, FiberMap, FiberSet, Layer, Match, PubSub } from "effect";
import { SqlClient } from "effect/sql";
import { Approvals } from "./approvals.ts";
import { Changes } from "./changes.ts";
import { invalid, type ServiceFailure } from "./errors.ts";
import { Harness, type HarnessEvent, type TurnOutcome } from "./execution.ts";
import { threadInstructionsOf } from "./instructions.ts";
import { ToolServer } from "./mcp.ts";
import { deliveredTextOf } from "./messaging.ts";
import { listThreadPermissions } from "./permissions.ts";
import { readSettings } from "./settings.ts";
import { activeStates, maxRunning, relaxAncestors, runningCountOf } from "./tree.ts";
import { Waker } from "./waker.ts";
import { prepareWorkingFolder, readThreadWorkspace } from "./workspaces.ts";

/** Owns thread state and admits at most one turn per thread. */
export class Threads extends Context.Service<
  Threads,
  {
    /** Takes a thread waiting on its missing workspace folder out of Attention and starts its turn again. */
    readonly retry: (threadId: string) => Effect.Effect<void, ServiceFailure>;
    /** Continues a Stopped thread with the messages kept for it (thread-tree, Stopping). */
    readonly resume: (threadId: string) => Effect.Effect<void, ServiceFailure>;
    /**
     * Ends the thread's running turn and withdraws its open questions; the thread stays usable and its
     * undelivered messages start its next turn. False when no turn runs (thread-messaging, Interruptions).
     */
    readonly interrupt: (threadId: string) => Effect.Effect<boolean>;
    /** Ends the thread's current turn, withdraws its open questions, and marks it Stopped; threads beneath keep running. */
    readonly stop: (threadId: string) => Effect.Effect<void>;
    /**
     * Delivers the thread's undelivered messages: a running turn takes in those not queued (steering);
     * otherwise they start a turn.
     */
    readonly wake: (threadId: string) => Effect.Effect<void>;
  }
>()("openmission/Threads") {}

/** Where each mission's threads with no workspace run, one scratch folder per mission. */
export class ScratchRoot extends Context.Service<ScratchRoot, string>()("openmission/ScratchRoot") {}

interface Admitted {
  readonly effort: EffortChoice;
  readonly messages: ReadonlyArray<string>;
  readonly missionId: string;
  readonly model: ModelChoice;
  readonly sessionId: string | null;
  readonly turnId: string;
}

/** A turn the harness is running, with the steered messages already written to it. */
interface ActiveTurn {
  readonly turnId: string;
  readonly written: Set<string>;
}

export const threadsLayer = Layer.effect(
  Threads,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const harness = yield* Harness;
    const changes = yield* Changes;
    const scratchRoot = yield* ScratchRoot;
    const approvals = yield* Approvals;
    const toolServer = yield* ToolServer;
    const waker = yield* Waker;
    const turns = yield* FiberMap.make<string>();
    // Wakes for other threads run here, outside any turn's fiber, which a later wake may replace.
    const background = yield* FiberSet.make();
    // Turns the harness is running, by thread, so messages can be steered into them.
    const active = new Map<string, ActiveTurn>();

    // Provisional recovery until the recovery decision is settled: a process that
    // ended mid-turn leaves no trustworthy Running state, and nothing is replayed.
    // With nothing running, no thread is left waiting on a thread beneath it.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE turns SET status = 'interrupted', ended_at = ${startedAt} WHERE status = 'running'`;
    yield* sql`UPDATE threads SET state = 'Idle' WHERE state IN ('Running', 'Waiting')`;

    const touch = (missionId: string, now: number) =>
      sql`UPDATE missions SET last_activity_at = ${now} WHERE id = ${missionId}`;

    /**
     * Starts a turn for the thread's undelivered messages, from the owner and from other threads, unless
     * one is running, the thread is Stopped, or the mission already runs its limit of threads.
     */
    const admit = (threadId: string) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const [thread] = yield* sql<{
            state: string;
            missionId: string;
            sessionId: string | null;
            model: ModelChoice;
            effort: EffortChoice;
          }>`SELECT state, mission_id AS missionId, session_id AS sessionId, model, effort
            FROM threads WHERE id = ${threadId}`;
          // A thread waiting on a question is still inside its turn; a Stopped one keeps its
          // messages until the owner resumes it (thread-tree, Stopping).
          if (thread === undefined || ["Running", "Attention", "Stopped"].includes(thread.state)) return null;
          const pending = yield* sql<{
            id: string;
            text: string;
            fromThreadId: string | null;
            fromTitle: string | null;
            isResult: number;
          }>`
            SELECT m.id, m.text, m.sender_thread_id AS fromThreadId, s.title AS fromTitle, m.is_result AS isResult
            FROM messages m LEFT JOIN threads s ON s.id = m.sender_thread_id
            WHERE m.thread_id = ${threadId} AND m.sender_kind IN ('user', 'thread') AND m.delivered_turn_id IS NULL
            ORDER BY m.sequence`;
          if (pending.length === 0) return null;
          // Past the mission's limit the messages wait; a turn ending elsewhere wakes the thread.
          const running = yield* runningCountOf(thread.missionId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
          if (running >= maxRunning) return null;
          const now = yield* Clock.currentTimeMillis;
          // A turn about to start in a missing workspace waits in Attention for Retry, and its
          // messages stay undelivered (workspace-attachment, Missing folder; CHG-0034).
          const workspace = yield* readThreadWorkspace(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
          if (workspace?.isMissing === true) {
            yield* sql`UPDATE threads SET state = 'Attention', blocker = 'MissingWorkspace' WHERE id = ${threadId}`;
            yield* touch(thread.missionId, now);
            yield* sql.afterCommit(changes.publish);
            return null;
          }
          const turnId = crypto.randomUUID();
          yield* sql`INSERT INTO turns (id, thread_id, status, started_at) VALUES (${turnId}, ${threadId}, 'running', ${now})`;
          yield* sql`UPDATE messages SET delivered_turn_id = ${turnId} WHERE id IN ${sql.in(pending.map((m) => m.id))}`;
          yield* sql`UPDATE threads SET state = 'Running', failure = NULL WHERE id = ${threadId}`;
          yield* touch(thread.missionId, now);
          yield* sql.afterCommit(changes.publish);
          return {
            effort: thread.effort,
            messages: pending.map((m) => deliveredTextOf({ ...m, isResult: m.isResult === 1 })),
            missionId: thread.missionId,
            model: thread.model,
            sessionId: thread.sessionId,
            turnId,
          } satisfies Admitted;
        }),
      );

    const saveReply = (threadId: string, turn: Admitted, text: string) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          const [next] = yield* sql<{ sequence: number }>`
            SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM messages WHERE thread_id = ${threadId}`;
          yield* sql`INSERT INTO messages (id, mission_id, thread_id, sender_kind, text, sequence, sent_at)
            VALUES (${crypto.randomUUID()}, ${turn.missionId}, ${threadId}, 'agent', ${text}, ${next?.sequence ?? 1}, ${now})`;
          yield* touch(turn.missionId, now);
          yield* sql.afterCommit(changes.publish);
        }),
      );

    /** Ends a turn that completed or was interrupted; an interrupted one ends the same way (CHG-0039). */
    const complete = (threadId: string, turn: Admitted, outcome: TurnOutcome) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const { isInterrupted, sessionId, usage } = outcome;
          const now = yield* Clock.currentTimeMillis;
          if (usage !== null) {
            yield* sql`INSERT INTO usage (turn_id, mission_id, input, output, cache_read, cache_creation)
              VALUES (${turn.turnId}, ${turn.missionId}, ${usage.input}, ${usage.output}, ${usage.cacheRead}, ${usage.cacheCreation})`;
          }
          const status = isInterrupted ? "interrupted" : "completed";
          yield* sql`UPDATE turns SET status = ${status}, ended_at = ${now} WHERE id = ${turn.turnId}`;
          // A thread that reported its result in this turn is Done; one with work still running
          // beneath it is Waiting; otherwise Idle (thread-tree, Thread states).
          const [row] = yield* sql<{ reportedTurnId: string | null; active: number }>`
            SELECT reported_turn_id AS reportedTurnId,
              (SELECT COUNT(*) FROM threads c WHERE c.parent_id = ${threadId} AND c.state IN ${sql.in(activeStates)})
                AS active
            FROM threads WHERE id = ${threadId}`;
          const state = row?.reportedTurnId === turn.turnId ? "Done" : (row?.active ?? 0) > 0 ? "Waiting" : "Idle";
          yield* sql`UPDATE threads SET state = ${state}, session_id = ${sessionId}, failure = NULL WHERE id = ${threadId}`;
          yield* relaxAncestors(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
          yield* touch(turn.missionId, now);
          yield* sql.afterCommit(changes.publish);
        }),
      );

    /** The failed turn's messages become undelivered again, so the next message retries them. */
    const fail = (threadId: string, turn: Admitted, reason: string) =>
      sql
        .withTransaction(
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis;
            yield* sql`UPDATE turns SET status = 'failed', ended_at = ${now} WHERE id = ${turn.turnId}`;
            yield* sql`UPDATE messages SET delivered_turn_id = NULL WHERE delivered_turn_id = ${turn.turnId}`;
            yield* sql`UPDATE threads SET state = 'Failed', failure = ${reason} WHERE id = ${threadId}`;
            yield* relaxAncestors(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
            yield* touch(turn.missionId, now);
            yield* sql.afterCommit(changes.publish);
          }),
        )
        .pipe(Effect.andThen(approvals.withdraw(threadId)));

    const draft = (threadId: string, text: string) => PubSub.publish(changes.drafts, { text, threadId });

    /** A steered message was taken in by the running turn: it now belongs to that turn. */
    const markDelivered = (turn: Admitted, messageId: string) =>
      sql
        .withTransaction(
          Effect.gen(function* () {
            yield* sql`UPDATE messages SET delivered_turn_id = ${turn.turnId}
              WHERE id = ${messageId} AND delivered_turn_id IS NULL`;
            yield* sql.afterCommit(changes.publish);
          }),
        )
        .pipe(Effect.orDie);

    /**
     * Writes the thread's undelivered messages that are not queued into its running turn, each once.
     * Thread messages always steer; the owner's steer unless sent as Queue (CHG-0039).
     */
    const steerInto = (threadId: string, turn: ActiveTurn) =>
      Effect.gen(function* () {
        const pending = yield* sql<{
          id: string;
          text: string;
          fromThreadId: string | null;
          fromTitle: string | null;
          isResult: number;
        }>`
          SELECT m.id, m.text, m.sender_thread_id AS fromThreadId, s.title AS fromTitle, m.is_result AS isResult
          FROM messages m LEFT JOIN threads s ON s.id = m.sender_thread_id
          WHERE m.thread_id = ${threadId} AND m.sender_kind IN ('user', 'thread') AND m.delivered_turn_id IS NULL
            AND m.is_queued = 0
          ORDER BY m.sequence`;
        for (const message of pending) {
          if (turn.written.has(message.id)) continue;
          turn.written.add(message.id);
          const text = deliveredTextOf({ ...message, isResult: message.isResult === 1 });
          // Not taken: the turn just ended, and the message starts the next one.
          if (!(yield* harness.steer(threadId, { id: message.id, text }))) turn.written.delete(message.id);
        }
      }).pipe(Effect.orDie);

    /**
     * Once a turn ends or a thread stops, a running slot frees: wakes the mission's other threads whose
     * messages wait, in the background.
     */
    const wakeWaiting = (missionId: string, exceptThreadId: string) =>
      FiberSet.run(
        background,
        Effect.gen(function* () {
          const waiting = yield* sql<{ threadId: string }>`
            SELECT DISTINCT m.thread_id AS threadId FROM messages m JOIN threads t ON t.id = m.thread_id
            WHERE m.mission_id = ${missionId} AND m.sender_kind IN ('user', 'thread') AND m.delivered_turn_id IS NULL
              AND t.state NOT IN ('Running', 'Attention', 'Stopped') AND t.id != ${exceptThreadId}`;
          for (const { threadId } of waiting) yield* wake(threadId);
        }).pipe(Effect.orDie),
      ).pipe(Effect.asVoid);

    /** The thread's place in the tree, for its starting context: its own title and its parent. */
    const readPosition = (threadId: string) =>
      Effect.gen(function* () {
        const [row] = yield* sql<{ title: string; parentId: string | null; parentTitle: string | null }>`
          SELECT t.title, t.parent_id AS parentId, p.title AS parentTitle
          FROM threads t LEFT JOIN threads p ON p.id = t.parent_id WHERE t.id = ${threadId}`;
        return {
          parent: row?.parentId == null ? null : { id: row.parentId, title: row.parentTitle ?? "" },
          threadId,
          title: row?.title ?? "",
        };
      });

    const run = (threadId: string, turn: Admitted): Effect.Effect<void, unknown> =>
      Effect.gen(function* () {
        const { approvalLevel, shouldStreamReplies } = yield* readSettings.pipe(
          Effect.provideService(SqlClient.SqlClient, sql),
        );
        const permissions = yield* listThreadPermissions(threadId).pipe(
          Effect.provideService(SqlClient.SqlClient, sql),
        );
        const workspace = yield* readThreadWorkspace(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
        const prepared = yield* prepareWorkingFolder(workspace, join(scratchRoot, turn.missionId));
        const { cwd } = prepared;
        const context = `${prepared.context}\n\n${threadInstructionsOf(yield* readPosition(threadId))}`;
        const mcpUrl = yield* toolServer.urlFor(threadId);
        const onEvent = (event: HarnessEvent) =>
          Match.valueTags(event, {
            Delivered: (delivered) => markDelivered(turn, delivered.messageId),
            Draft: (written) => (shouldStreamReplies ? draft(threadId, written.text).pipe(Effect.asVoid) : Effect.void),
            Reply: (reply) =>
              saveReply(threadId, turn, reply.text).pipe(Effect.andThen(draft(threadId, "")), Effect.orDie),
          });
        active.set(threadId, { turnId: turn.turnId, written: new Set() });
        const outcome = yield* harness
          .runTurn({
            access: {
              approvalLevel,
              isInWorkspace: workspace !== null,
              mcpUrl,
              permissions: permissions.map((permission) => permission.sentence),
            },
            context,
            cwd,
            effort: turn.effort,
            model: turn.model,
            onEvent,
            sessionId: turn.sessionId,
            text: turn.messages.join("\n\n"),
            threadId,
          })
          .pipe(Effect.result, Effect.ensuring(Effect.sync(() => active.delete(threadId))));
        yield* draft(threadId, "");
        if (outcome._tag === "Failure") {
          yield* fail(threadId, turn, outcome.failure.reason);
          return yield* wakeWaiting(turn.missionId, threadId);
        }
        yield* complete(threadId, turn, outcome.success);
        yield* wakeWaiting(turn.missionId, threadId);
        // Messages that arrived during the turn start the next one, in this same fiber,
        // so the thread's entry in the fiber map always holds its current turn.
        const next = yield* admit(threadId);
        if (next !== null) yield* run(threadId, next);
      });

    const wake = (threadId: string): Effect.Effect<void> =>
      Effect.suspend(() => {
        const running = active.get(threadId);
        if (running !== undefined) return steerInto(threadId, running);
        return admit(threadId).pipe(
          Effect.flatMap((turn) =>
            turn === null
              ? Effect.void
              : FiberMap.run(turns, threadId, run(threadId, turn).pipe(Effect.orDie)).pipe(Effect.asVoid),
          ),
          Effect.orDie,
        );
      });

    const interrupt = (threadId: string) =>
      Effect.gen(function* () {
        if (!active.has(threadId) || !(yield* harness.interrupt(threadId))) return false;
        // The turn's end, in its own fiber, sets the thread's state and starts its next turn.
        yield* approvals.withdraw(threadId);
        return true;
      });

    const stop = (threadId: string) =>
      Effect.gen(function* () {
        // Stopped comes first: the harness may still prompt while it exits, and only
        // a thread at work can be asked (approvals.ts).
        const missionId = yield* sql.withTransaction(
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis;
            const [thread] = yield* sql<{
              missionId: string;
            }>`SELECT mission_id AS missionId FROM threads WHERE id = ${threadId}`;
            if (thread === undefined) return null;
            yield* sql`UPDATE turns SET status = 'stopped', ended_at = ${now} WHERE thread_id = ${threadId} AND status = 'running'`;
            yield* sql`UPDATE threads SET state = 'Stopped', blocker = NULL WHERE id = ${threadId}`;
            yield* relaxAncestors(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
            yield* touch(thread.missionId, now);
            yield* sql.afterCommit(changes.publish);
            return thread.missionId;
          }),
        );
        // Interrupting the turn closes its harness process (claude.ts).
        yield* FiberMap.remove(turns, threadId);
        yield* approvals.withdraw(threadId);
        yield* draft(threadId, "");
        if (missionId !== null) yield* wakeWaiting(missionId, threadId);
      }).pipe(Effect.orDie);

    const resume = (threadId: string) =>
      Effect.gen(function* () {
        const isStopped = yield* sql.withTransaction(
          Effect.gen(function* () {
            const [thread] = yield* sql<{ state: string }>`SELECT state FROM threads WHERE id = ${threadId}`;
            if (thread?.state !== "Stopped") return false;
            yield* sql`UPDATE threads SET state = 'Idle' WHERE id = ${threadId}`;
            yield* sql.afterCommit(changes.publish);
            return true;
          }),
        );
        if (!isStopped) return yield* invalid("This thread is not stopped.");
        yield* wake(threadId);
      }).pipe(Effect.catchTag("SqlError", Effect.die));

    const retry = (threadId: string) =>
      Effect.gen(function* () {
        const isWaiting = yield* sql.withTransaction(
          Effect.gen(function* () {
            const [thread] = yield* sql<{ blocker: string | null }>`SELECT blocker FROM threads WHERE id = ${threadId}`;
            if (thread?.blocker !== "MissingWorkspace") return false;
            yield* sql`UPDATE threads SET state = 'Idle', blocker = NULL WHERE id = ${threadId}`;
            yield* sql.afterCommit(changes.publish);
            return true;
          }),
        );
        if (!isWaiting) return yield* invalid("This thread is not waiting on its workspace folder.");
        // Still missing: admit sends it back to Attention.
        yield* wake(threadId);
      }).pipe(Effect.catchTag("SqlError", Effect.die));

    yield* waker.register({ interrupt, wake });
    return { interrupt, resume, retry, stop, wake };
  }),
);
