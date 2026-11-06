import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Approvals } from "./approvals.ts";
import type { Changes } from "./changes.ts";
import { relaxAncestors } from "./tree.ts";

/** Invalidates active turns before cancellation so late output cannot change a paused or stopped thread. */
export const haltThreads = Effect.fn("haltThreads")(function* (
  ids: ReadonlyArray<string>,
  state: "Stopped" | "Attention",
) {
  const sql = yield* SqlClient.SqlClient;
  if (ids.length === 0) return;
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE turns SET status = 'stopped', ended_at = ${now}
    WHERE thread_id IN ${sql.in(ids)} AND status = 'running'`;
  yield* sql`UPDATE threads SET state = ${state}, generation = generation + 1,
    blocker = ${state === "Attention" ? "Chatter" : null} WHERE id IN ${sql.in(ids)}`;
});

/** Owns cancellation and Stop without holding a database transaction while a harness exits. */
export const makeLifecycle = (dependencies: {
  readonly sql: SqlClient.SqlClient;
  readonly approvals: Approvals["Service"];
  readonly changes: Changes["Service"];
  readonly cancelTurn: (id: string) => Effect.Effect<void>;
  readonly clearDraft: (id: string) => Effect.Effect<void>;
  readonly wakeWaiting: (missionId: string, exceptId: string) => Effect.Effect<void>;
}) => {
  const { sql, approvals, changes, cancelTurn, clearDraft, wakeWaiting } = dependencies;
  const cancel = Effect.fn("cancelThreads")(function* (ids: ReadonlyArray<string>) {
    for (const id of ids) {
      yield* cancelTurn(id);
      yield* approvals.withdraw(id);
      yield* clearDraft(id);
    }
  });
  const stop = Effect.fn("stopThread")(function* (threadId: string) {
    const missionId = yield* sql
      .withTransaction(
        Effect.gen(function* () {
          const [thread] = yield* sql<{
            missionId: string;
          }>`SELECT mission_id AS missionId FROM threads WHERE id = ${threadId}`;
          if (thread === undefined) return null;
          yield* haltThreads([threadId], "Stopped");
          yield* relaxAncestors(threadId);
          const now = yield* Clock.currentTimeMillis;
          yield* sql`UPDATE missions SET last_activity_at = ${now} WHERE id = ${thread.missionId}`;
          yield* sql.afterCommit(changes.publish);
          return thread.missionId;
        }),
      )
      .pipe(Effect.provideService(SqlClient.SqlClient, sql));
    yield* cancel([threadId]);
    if (missionId !== null) yield* wakeWaiting(missionId, threadId);
  }, Effect.orDie);
  return { cancel, stop };
};
