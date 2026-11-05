import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { EffortChoice, ModelChoice, TokenUsage } from "@openmission/contracts";
import { Clock, Context, Effect, FiberSet, Layer, PubSub } from "effect";
import { SqlClient } from "effect/sql";
import { Changes } from "./changes.ts";
import { Harness, type HarnessEvent } from "./execution.ts";
import { readSettings } from "./settings.ts";

/** Owns thread state and admits at most one turn per thread. */
export class Threads extends Context.Service<Threads, { readonly wake: (threadId: string) => Effect.Effect<void> }>()(
  "openmission/Threads",
) {}

/** Where each mission's harness runs while it has no workspace. */
export class ScratchRoot extends Context.Service<ScratchRoot, string>()("openmission/ScratchRoot") {}

interface Admitted {
  readonly turnId: string;
  readonly missionId: string;
  readonly sessionId: string | null;
  readonly model: ModelChoice;
  readonly effort: EffortChoice;
  readonly messages: ReadonlyArray<string>;
}

export const threadsLayer = Layer.effect(
  Threads,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const harness = yield* Harness;
    const changes = yield* Changes;
    const scratchRoot = yield* ScratchRoot;
    const turns = yield* FiberSet.make();

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
          if (thread === undefined || thread.state === "Running") return undefined;
          const pending = yield* sql<{ id: string; text: string }>`
            SELECT id, text FROM messages
            WHERE thread_id = ${threadId} AND sender_kind = 'user' AND delivered_turn_id IS NULL
            ORDER BY sequence`;
          if (pending.length === 0) return undefined;
          const now = yield* Clock.currentTimeMillis;
          const turnId = crypto.randomUUID();
          yield* sql`INSERT INTO turns (id, thread_id, status, started_at) VALUES (${turnId}, ${threadId}, 'running', ${now})`;
          yield* sql`UPDATE messages SET delivered_turn_id = ${turnId} WHERE id IN ${sql.in(pending.map((m) => m.id))}`;
          yield* sql`UPDATE threads SET state = 'Running', failure = NULL WHERE id = ${threadId}`;
          yield* touch(thread.missionId, now);
          yield* sql.afterCommit(changes.publish);
          return {
            turnId,
            missionId: thread.missionId,
            sessionId: thread.sessionId,
            model: thread.model,
            effort: thread.effort,
            messages: pending.map((m) => m.text),
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
      sql.withTransaction(
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* sql`UPDATE turns SET status = 'failed', ended_at = ${now} WHERE id = ${turn.turnId}`;
          yield* sql`UPDATE messages SET delivered_turn_id = NULL WHERE delivered_turn_id = ${turn.turnId}`;
          yield* sql`UPDATE threads SET state = 'Failed', failure = ${reason} WHERE id = ${threadId}`;
          yield* touch(turn.missionId, now);
          yield* sql.afterCommit(changes.publish);
        }),
      );

    const draft = (threadId: string, text: string) => PubSub.publish(changes.drafts, { threadId, text });

    const run = (threadId: string, turn: Admitted) =>
      Effect.gen(function* () {
        const { streamReplies } = yield* readSettings.pipe(Effect.provideService(SqlClient.SqlClient, sql));
        const cwd = join(scratchRoot, turn.missionId);
        yield* Effect.sync(() => mkdirSync(cwd, { recursive: true }));
        const onEvent = (event: HarnessEvent) =>
          event._tag === "Reply"
            ? saveReply(threadId, turn, event.text).pipe(Effect.andThen(draft(threadId, "")), Effect.orDie)
            : streamReplies
              ? draft(threadId, event.text).pipe(Effect.asVoid)
              : Effect.void;
        const outcome = yield* harness
          .runTurn({
            threadId,
            sessionId: turn.sessionId,
            model: turn.model,
            effort: turn.effort,
            cwd,
            text: turn.messages.join("\n\n"),
            onEvent,
          })
          .pipe(Effect.result);
        yield* draft(threadId, "");
        if (outcome._tag === "Failure") return yield* fail(threadId, turn, outcome.failure.reason);
        yield* complete(threadId, turn, outcome.success.sessionId, outcome.success.usage);
        // Messages that arrived during the turn start the next one.
        yield* wake(threadId);
      });

    const wake = (threadId: string): Effect.Effect<void> =>
      admit(threadId).pipe(
        Effect.flatMap((turn) =>
          turn === undefined
            ? Effect.void
            : FiberSet.run(turns, run(threadId, turn).pipe(Effect.orDie)).pipe(Effect.asVoid),
        ),
        Effect.orDie,
      );

    return { wake };
  }),
);
