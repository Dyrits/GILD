import { Clock, Deferred, Effect } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { touchMission } from "./activity.ts";
import type { Changes } from "./changes.ts";
import { holdInTurn } from "./lifecycle.ts";

/** What a turn waits on the owner for: its record, written when the wait opens, and what ends it. */
export interface OwnerWait {
  /** Ends the wait as withdrawn when the turn that asked gives up. */
  readonly abandon: (id: string) => Effect.Effect<unknown, unknown>;
  readonly missionId: string;
  /** Records the open question or suggestion under `id`, asked at `now`, in the opening transaction. */
  readonly record: (id: string, now: number) => Effect.Effect<void, SqlError.SqlError, SqlClient.SqlClient>;
  readonly threadId: string;
}

/**
 * Waits on the owner inside a turn, for approval questions and off-topic suggestions alike: only a
 * thread at work in a turn is asked; it waits in Attention with no time limit, and the owner's
 * answer or a withdrawal hands the turn its resolution (thread-tree, Thread states; action-approval).
 */
export const makeOwnerWaits = <Resolution>(sql: SqlClient.SqlClient, changes: Changes["Service"]) => {
  const waiting = new Map<string, Deferred.Deferred<Resolution>>();

  /** Opens the wait and returns its resolution; null when the thread is not at work in a turn. */
  const ask = (wait: OwnerWait) =>
    Effect.gen(function* () {
      const id = crypto.randomUUID();
      const deferred = yield* Deferred.make<Resolution>();
      const isAtWork = yield* sql
        .withTransaction(
          Effect.gen(function* () {
            const [thread] = yield* sql<{ state: string; blocker: string | null }>`
            SELECT state, blocker FROM threads WHERE id = ${wait.threadId}`;
            // A thread no longer at work, such as one just stopped whose harness is still exiting, is not asked.
            if (thread === undefined || thread.blocker !== null || !["Running", "Attention"].includes(thread.state))
              return false;
            waiting.set(id, deferred);
            const now = yield* Clock.currentTimeMillis;
            yield* wait.record(id, now);
            yield* holdInTurn(wait.threadId);
            yield* touchMission(wait.missionId, now);
            yield* sql.afterCommit(changes.publish);
            return true;
          }),
        )
        .pipe(Effect.provideService(SqlClient.SqlClient, sql));
      if (!isAtWork) return null;
      return yield* Deferred.await(deferred).pipe(
        Effect.onInterrupt(() => wait.abandon(id).pipe(Effect.ignore)),
        Effect.ensuring(Effect.sync(() => waiting.delete(id))),
      );
    });

  return {
    ask,
    /** Whether a turn still waits on this wait; an open record without one belongs to a turn that ended. */
    isWaiting: (id: string) => waiting.has(id),
    /** Hands the turn waiting on `id` its resolution, if one still waits. */
    settle: (id: string, resolution: Resolution) =>
      Effect.suspend(() => {
        const deferred = waiting.get(id);
        return deferred === undefined ? Effect.void : Deferred.succeed(deferred, resolution).pipe(Effect.asVoid);
      }),
  };
};
