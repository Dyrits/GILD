import { join } from "node:path";
import type { EffortChoice, ModelChoice, TokenUsage } from "@openmission/contracts";
import { Clock, Context, Effect, FiberMap, Layer, PubSub } from "effect";
import { SqlClient } from "effect/sql";
import { Approvals } from "./approvals.ts";
import { Changes } from "./changes.ts";
import { invalid, type ServiceFailure } from "./errors.ts";
import { Harness, type HarnessEvent } from "./execution.ts";
import { ToolServer } from "./mcp.ts";
import { listThreadPermissions } from "./permissions.ts";
import { readSettings } from "./settings.ts";
import { prepareWorkingFolder, readThreadWorkspace } from "./workspaces.ts";

/** Owns thread state and admits at most one turn per thread. */
export class Threads extends Context.Service<
  Threads,
  {
    /** Takes a thread waiting on its missing workspace folder out of Attention and starts its turn again. */
    readonly retry: (threadId: string) => Effect.Effect<void, ServiceFailure>;
    /** Ends the thread's current turn, withdraws its open questions, and marks it Stopped. */
    readonly stop: (threadId: string) => Effect.Effect<void>;
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

export const threadsLayer = Layer.effect(
  Threads,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const harness = yield* Harness;
    const changes = yield* Changes;
    const scratchRoot = yield* ScratchRoot;
    const approvals = yield* Approvals;
    const toolServer = yield* ToolServer;
    const turns = yield* FiberMap.make<string>();

    // Provisional recovery until the recovery decision is settled: a process that
    // ended mid-turn leaves no trustworthy Running state, and nothing is replayed.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE turns SET status = 'interrupted', ended_at = ${startedAt} WHERE status = 'running'`;
    yield* sql`UPDATE threads SET state = 'Idle' WHERE state = 'Running'`;

    const touch = (missionId: string, now: number) =>
      sql`UPDATE missions SET last_activity_at = ${now} WHERE id = ${missionId}`;

    /** Starts a turn for the thread's undelivered user messages, unless one is running. */
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
          // A thread waiting on a question is still inside its turn.
          if (thread === undefined || thread.state === "Running" || thread.state === "Attention") return null;
          const pending = yield* sql<{ id: string; text: string }>`
            SELECT id, text FROM messages
            WHERE thread_id = ${threadId} AND sender_kind = 'user' AND delivered_turn_id IS NULL
            ORDER BY sequence`;
          if (pending.length === 0) return null;
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
            messages: pending.map((m) => m.text),
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

    const complete = (threadId: string, turn: Admitted, sessionId: string, usage: TokenUsage | null) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          if (usage !== null) {
            yield* sql`INSERT INTO usage (turn_id, mission_id, input, output, cache_read, cache_creation)
              VALUES (${turn.turnId}, ${turn.missionId}, ${usage.input}, ${usage.output}, ${usage.cacheRead}, ${usage.cacheCreation})`;
          }
          yield* sql`UPDATE turns SET status = 'completed', ended_at = ${now} WHERE id = ${turn.turnId}`;
          yield* sql`UPDATE threads SET state = 'Idle', session_id = ${sessionId}, failure = NULL WHERE id = ${threadId}`;
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
            yield* touch(turn.missionId, now);
            yield* sql.afterCommit(changes.publish);
          }),
        )
        .pipe(Effect.andThen(approvals.withdraw(threadId)));

    const draft = (threadId: string, text: string) => PubSub.publish(changes.drafts, { text, threadId });

    const run = (threadId: string, turn: Admitted): Effect.Effect<void, unknown> =>
      Effect.gen(function* () {
        const { approvalLevel, shouldStreamReplies } = yield* readSettings.pipe(
          Effect.provideService(SqlClient.SqlClient, sql),
        );
        const permissions = yield* listThreadPermissions(threadId).pipe(
          Effect.provideService(SqlClient.SqlClient, sql),
        );
        const workspace = yield* readThreadWorkspace(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
        const { context, cwd } = yield* prepareWorkingFolder(workspace, join(scratchRoot, turn.missionId));
        const mcpUrl = yield* toolServer.urlFor(threadId);
        const onEvent = (event: HarnessEvent) =>
          event._tag === "Reply"
            ? saveReply(threadId, turn, event.text).pipe(Effect.andThen(draft(threadId, "")), Effect.orDie)
            : shouldStreamReplies
              ? draft(threadId, event.text).pipe(Effect.asVoid)
              : Effect.void;
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
          .pipe(Effect.result);
        yield* draft(threadId, "");
        if (outcome._tag === "Failure") return yield* fail(threadId, turn, outcome.failure.reason);
        yield* complete(threadId, turn, outcome.success.sessionId, outcome.success.usage);
        // Messages that arrived during the turn start the next one, in this same fiber,
        // so the thread's entry in the fiber map always holds its current turn.
        const next = yield* admit(threadId);
        if (next !== null) yield* run(threadId, next);
      });

    const wake = (threadId: string): Effect.Effect<void> =>
      admit(threadId).pipe(
        Effect.flatMap((turn) =>
          turn === null
            ? Effect.void
            : FiberMap.run(turns, threadId, run(threadId, turn).pipe(Effect.orDie)).pipe(Effect.asVoid),
        ),
        Effect.orDie,
      );

    const stop = (threadId: string) =>
      Effect.gen(function* () {
        // Stopped comes first: the harness may still prompt while it exits, and only
        // a thread at work can be asked (approvals.ts).
        yield* sql.withTransaction(
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis;
            const [thread] = yield* sql<{
              missionId: string;
            }>`SELECT mission_id AS missionId FROM threads WHERE id = ${threadId}`;
            if (thread === undefined) return;
            yield* sql`UPDATE turns SET status = 'stopped', ended_at = ${now} WHERE thread_id = ${threadId} AND status = 'running'`;
            yield* sql`UPDATE threads SET state = 'Stopped', blocker = NULL WHERE id = ${threadId}`;
            yield* touch(thread.missionId, now);
            yield* sql.afterCommit(changes.publish);
          }),
        );
        // Interrupting the turn closes its harness process (claude.ts).
        yield* FiberMap.remove(turns, threadId);
        yield* approvals.withdraw(threadId);
        yield* draft(threadId, "");
      }).pipe(Effect.orDie);

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

    return { retry, stop, wake };
  }),
);
