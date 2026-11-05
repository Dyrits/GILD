import { Clock, Context, Effect, FiberSet, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { Changes } from "./changes.ts";
import { Harness } from "./execution.ts";

/** Owns thread state and admits at most one turn per thread. */
export class Threads extends Context.Service<Threads, { readonly wake: (threadId: string) => Effect.Effect<void> }>()(
  "openmission/Threads",
) {}

export const threadsLayer = Layer.effect(
  Threads,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const harness = yield* Harness;
    const changes = yield* Changes;
    const turns = yield* FiberSet.make();

    // Provisional recovery until the recovery decision is settled: a process that
    // ended mid-turn leaves no trustworthy Running state, and nothing is replayed.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE turns SET status = 'interrupted', ended_at = ${startedAt} WHERE status = 'running'`;
    yield* sql`UPDATE threads SET state = 'Idle' WHERE state = 'Running'`;

    /** Starts a turn for the thread's undelivered user messages, unless one is running. */
    const admit = (threadId: string) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const [thread] = yield* sql<{ state: string; missionId: string }>`
            SELECT state, mission_id AS missionId FROM threads WHERE id = ${threadId}`;
          if (thread === undefined || thread.state === "Running") return undefined;
          const pending = yield* sql<{ id: string; text: string }>`
            SELECT id, text FROM messages
            WHERE thread_id = ${threadId} AND sender_kind = 'user' AND delivered_turn_id IS NULL
            ORDER BY sequence`;
          if (pending.length === 0) return undefined;
          const now = yield* Clock.currentTimeMillis;
          const turnId = crypto.randomUUID();
          yield* sql`INSERT INTO turns (id, thread_id, status, started_at) VALUES (${turnId}, ${threadId}, 'running', ${now})`;
          yield* sql`UPDATE messages SET delivered_turn_id = ${turnId}
            WHERE id IN ${sql.in(pending.map((m) => m.id))}`;
          yield* sql`UPDATE threads SET state = 'Running' WHERE id = ${threadId}`;
          yield* sql`UPDATE missions SET last_activity_at = ${now} WHERE id = ${thread.missionId}`;
          yield* sql.afterCommit(changes.publish);
          return { turnId, missionId: thread.missionId, messages: pending.map((m) => m.text) };
        }),
      );

    const finish = (threadId: string, turn: { turnId: string; missionId: string }, reply: string) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          const [next] = yield* sql<{ sequence: number }>`
            SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM messages WHERE thread_id = ${threadId}`;
          yield* sql`INSERT INTO messages (id, mission_id, thread_id, sender_kind, text, sequence, sent_at)
            VALUES (${crypto.randomUUID()}, ${turn.missionId}, ${threadId}, 'agent', ${reply}, ${next?.sequence ?? 1}, ${now})`;
          yield* sql`UPDATE turns SET status = 'completed', ended_at = ${now} WHERE id = ${turn.turnId}`;
          yield* sql`UPDATE threads SET state = 'Idle' WHERE id = ${threadId}`;
          yield* sql`UPDATE missions SET last_activity_at = ${now} WHERE id = ${turn.missionId}`;
          yield* sql.afterCommit(changes.publish);
        }),
      );

    const wake = (threadId: string): Effect.Effect<void> =>
      admit(threadId).pipe(
        Effect.flatMap((turn) =>
          turn === undefined
            ? Effect.void
            : FiberSet.run(
                turns,
                harness.runTurn({ messages: turn.messages }).pipe(
                  Effect.flatMap(({ reply }) => finish(threadId, turn, reply)),
                  // Messages that arrived during the turn start the next one.
                  Effect.andThen(Effect.suspend(() => wake(threadId))),
                  Effect.orDie,
                ),
              ).pipe(Effect.asVoid),
        ),
        Effect.orDie,
      );

    return { wake };
  }),
);
