import type { ThreadActions, ThreadState } from "@canopy/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { touchMission } from "./activity.ts";
import type { Changes } from "./changes.ts";

// The thread lifecycle: the one module that writes a thread's state and blocker (thread-tree, Thread
// states). Callers decide which threads and which transition; each transition keeps the tree's rules,
// such as a parent left Waiting with nothing at work beneath it becoming Idle. Transitions run inside
// the caller's transaction; `makeLifecycle` adds what runs outside one (cancelling turns, waking).

/** The owner opens threads down to this many levels beneath the top thread; agents have no depth limit. */
export const maxOwnerDepth = 4;

/** States in which a thread beneath keeps its parent Waiting. */
export const activeStates = ["Running", "Waiting", "Attention"];

/** What a thread waits on the owner for outside a turn: a missing folder, chatter, or a budget. */
export type HoldReason = "MissingWorkspace" | "Chatter" | "Budget";

/** Threads waiting on the owner inside a turn (a question or a suggestion), as an SQL condition on `threads`. */
export const waitsInTurn = "(state = 'Attention' AND blocker IS NULL)";

/**
 * Parents left Waiting with nothing active beneath them become Idle, up the tree from the given thread.
 * Callers run it in a transaction.
 */
export const relaxAncestors = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    let current: string | null = threadId;
    while (current !== null) {
      const [row]: ReadonlyArray<{ parentId: string | null }> = yield* sql<{
        parentId: string | null;
      }>`SELECT parent_id AS parentId FROM threads WHERE id = ${current}`;
      const parentId: string | null = row?.parentId ?? null;
      if (parentId === null) return;
      const [parent] = yield* sql<{ state: string; active: number }>`
        SELECT state, (SELECT COUNT(*) FROM threads c WHERE c.parent_id = ${parentId}
          AND c.state IN ${sql.in(activeStates)}) AS active
        FROM threads WHERE id = ${parentId}`;
      if (parent?.state !== "Waiting" || parent.active > 0) return;
      yield* sql`UPDATE threads SET state = 'Idle' WHERE id = ${parentId}`;
      current = parentId;
    }
  });

/** What the owner can do with a thread in this state, for every interface to offer the same. */
export const threadActionsOf = (thread: {
  readonly state: ThreadState;
  readonly blocker: string | null;
  readonly depth: number;
}): ThreadActions => ({
  canOpenBeneath: thread.depth < maxOwnerDepth,
  canResume: thread.state === "Stopped",
  canStop: activeStates.includes(thread.state),
  isInTurn: thread.state === "Running" || (thread.state === "Attention" && thread.blocker === null),
});

/** A turn starts: the thread runs and its last failure clears. */
export const startRunning = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET state = 'Running', failure = NULL WHERE id = ${threadId}`;
  });

/**
 * A turn ends: the thread is Done if it reported its result in it, Waiting with work still at work
 * beneath it, otherwise Idle; its parents relax.
 */
export const endTurn = (threadId: string, turnId: string, sessionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ reportedTurnId: string | null; active: number }>`
      SELECT reported_turn_id AS reportedTurnId,
        (SELECT COUNT(*) FROM threads c WHERE c.parent_id = ${threadId} AND c.state IN ${sql.in(activeStates)})
          AS active
      FROM threads WHERE id = ${threadId}`;
    const state = row?.reportedTurnId === turnId ? "Done" : (row?.active ?? 0) > 0 ? "Waiting" : "Idle";
    yield* sql`UPDATE threads SET state = ${state}, session_id = ${sessionId}, failure = NULL WHERE id = ${threadId}`;
    yield* relaxAncestors(threadId);
  });

/** A turn fails: the thread shows Failed with the reason; its parents relax. */
export const failTurn = (threadId: string, reason: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET state = 'Failed', failure = ${reason} WHERE id = ${threadId}`;
    yield* relaxAncestors(threadId);
  });

/** A running thread asks the owner inside its turn and waits in Attention. */
export const holdInTurn = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET state = 'Attention' WHERE id = ${threadId} AND state = 'Running'`;
  });

/** The owner answered inside the turn: the thread runs again once no question or suggestion stays open. */
export const resumeInTurn = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET state = 'Running'
      WHERE id = ${threadId} AND ${sql.literal(waitsInTurn)}
        AND NOT EXISTS (SELECT 1 FROM questions WHERE thread_id = ${threadId} AND outcome IS NULL)
        AND NOT EXISTS (SELECT 1 FROM suggestions WHERE thread_id = ${threadId} AND outcome IS NULL)`;
  });

/** A thread about to start a turn waits in Attention for a reason outside any turn instead. */
export const holdThread = (threadId: string, reason: HoldReason) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET state = 'Attention', blocker = ${reason}
      WHERE id = ${threadId} AND state != 'Stopped' AND is_deleting = 0`;
  });

/**
 * Holds the thread a question shows on, such as a budget stop's, unless it works, has failed, or already
 * waits on the owner for another reason: the question still shows on it, and its own state stays.
 */
export const holdQuestionHolder = (threadId: string, reason: HoldReason) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET state = 'Attention', blocker = ${reason}
      WHERE id = ${threadId} AND state NOT IN ('Stopped', 'Running', 'Failed') AND is_deleting = 0
        AND (blocker IS NULL OR blocker = ${reason})`;
  });

/** Releases a held thread, which becomes Idle and runs its kept messages once woken. */
export const releaseThread = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET state = 'Idle', blocker = NULL WHERE id = ${threadId}`;
  });

/** Releases the threads held only by chatter pauses since resolved; other reasons and Stop still win. */
export const releaseResolvedChatter = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Idle', blocker = NULL
    WHERE blocker = 'Chatter' AND state = 'Attention' AND NOT EXISTS (
      SELECT 1 FROM chatter WHERE pause_id IS NOT NULL AND (first_id = threads.id OR second_id = threads.id))`;
});

/** A Stopped thread continues: it becomes Idle and runs its kept messages once woken. */
export const resumeStopped = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET state = 'Idle' WHERE id = ${threadId}`;
  });

/**
 * At startup no turn runs: threads left Running, Waiting, or waiting inside a turn become Idle; those
 * held for a reason outside any turn keep waiting (provisional until recovery is settled: work-in-progress,
 * Open questions).
 */
export const recoverThreadStates = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Idle'
    WHERE state IN ('Running', 'Waiting') OR ${sql.literal(waitsInTurn)}`;
});

/**
 * Invalidates active turns before cancellation so late output cannot change a paused or stopped thread.
 * Stopping also returns each parent left Waiting with nothing at work beneath it to Idle (thread-tree,
 * Thread states), whichever path stops the threads. Callers run it in a transaction, then cancel the turns.
 */
export const haltThreads = Effect.fn("haltThreads")(function* (
  ids: ReadonlyArray<string>,
  state: "Stopped" | "Attention",
  attentionBlocker: "Chatter" | "Budget" = "Chatter",
) {
  const sql = yield* SqlClient.SqlClient;
  if (ids.length === 0) return;
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE turns SET status = 'stopped', ended_at = ${now}
    WHERE thread_id IN ${sql.in(ids)} AND status = 'running'`;
  yield* sql`UPDATE threads SET state = ${state}, generation = generation + 1,
    blocker = ${state === "Attention" ? attentionBlocker : null} WHERE id IN ${sql.in(ids)}`;
  if (state === "Stopped") for (const id of ids) yield* relaxAncestors(id);
});

/** Owns cancellation and Stop without holding a database transaction while a harness exits. */
export const makeLifecycle = (dependencies: {
  readonly sql: SqlClient.SqlClient;
  /** Withdraws everything the thread waits on the owner for. */
  readonly withdraw: (id: string) => Effect.Effect<void>;
  readonly changes: Changes["Service"];
  readonly cancelTurn: (id: string) => Effect.Effect<void>;
  readonly clearDraft: (id: string) => Effect.Effect<void>;
  readonly wakeWaiting: (missionId: string, exceptId: string) => Effect.Effect<void>;
}) => {
  const { sql, withdraw, changes, cancelTurn, clearDraft, wakeWaiting } = dependencies;
  const cancel = Effect.fn("cancelThreads")(function* (ids: ReadonlyArray<string>) {
    for (const id of ids) {
      yield* cancelTurn(id);
      yield* withdraw(id);
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
          yield* touchMission(thread.missionId, yield* Clock.currentTimeMillis);
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
