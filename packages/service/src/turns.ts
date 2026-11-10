import type { EffortChoice, HarnessName, ModelChoice } from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { touchMission } from "./activity.ts";
import { enforceBudgets, holdIfReached } from "./budgets.ts";
import { Changes } from "./changes.ts";
import type { TurnOutcome } from "./execution.ts";
import { endTurn, failTurn, holdThread, startRunning } from "./lifecycle.ts";
import { deliverMessages, insertReply, listPending } from "./messaging.ts";
import { finishRitualRun } from "./rituals.ts";
import { maxRunning, runningCountOf } from "./tree.ts";
import { readThreadWorkspace } from "./workspaces.ts";

// A turn's record in the store: admitted with the thread's messages, then completed or failed. Each step runs
// in its own transaction and publishes a change once committed; a step for a turn no longer running does nothing.

/** A turn admitted for a thread, with the runner it takes and the messages delivered to it. */
export interface Admitted {
  readonly accountId: string | null;
  readonly effort: EffortChoice;
  readonly harness: HarnessName;
  readonly messages: ReadonlyArray<string>;
  readonly missionId: string;
  readonly model: ModelChoice;
  readonly sessionId: string | null;
  readonly turnId: string;
}

/** Runs the step in one transaction. */
const transacting = <A, E, R>(step: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql.withTransaction(step);
  });

/** Publishes a change once the transaction commits. */
const publishOnCommit = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const changes = yield* Changes;
  yield* sql.afterCommit(changes.publish);
});

/** Whether the turn is still the thread's running turn. */
export const isCurrentTurn = (turnId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`SELECT id FROM turns WHERE id = ${turnId} AND status = 'running'`;
    return rows.length > 0;
  });

/**
 * Starts a turn for the thread's undelivered messages, from the owner and from other threads, unless
 * one is running, the thread is Stopped, or the mission already runs its limit of threads; null when none starts.
 */
export const admitTurn = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    return yield* sql.withTransaction(
      Effect.gen(function* () {
        const [thread] = yield* sql<{
          state: string;
          missionId: string;
          sessionId: string | null;
          model: ModelChoice;
          effort: EffortChoice;
          harness: HarnessName;
          accountId: string | null;
        }>`SELECT state, mission_id AS missionId, session_id AS sessionId, model, effort, harness,
            account_id AS accountId
          FROM threads WHERE id = ${threadId}`;
        // A thread waiting on a question is still inside its turn; a Stopped one keeps its
        // messages until the owner resumes it (thread-tree, Stopping).
        if (thread === undefined || ["Running", "Attention", "Stopped"].includes(thread.state)) return null;
        const pending = yield* listPending(threadId, false);
        if (pending.length === 0) return null;
        // Past the mission's limit the messages wait; a turn ending elsewhere wakes the thread.
        if ((yield* runningCountOf(thread.missionId)) >= maxRunning) return null;
        const now = yield* Clock.currentTimeMillis;
        // A turn about to start in a missing workspace waits in Attention for Retry, and its
        // messages stay undelivered (workspace-attachment, Missing folder; CHG-0034).
        const workspace = yield* readThreadWorkspace(threadId);
        if (workspace?.isMissing === true) {
          yield* holdThread(threadId, "MissingWorkspace");
          yield* touchMission(thread.missionId, now);
          yield* sql.afterCommit(changes.publish);
          return null;
        }
        // Under a reached budget the messages wait in Attention for the owner (budget-control, Reaching a limit).
        if (yield* holdIfReached(threadId, thread.missionId)) {
          yield* touchMission(thread.missionId, now);
          yield* sql.afterCommit(changes.publish);
          return null;
        }
        const turnId = crypto.randomUUID();
        yield* sql`INSERT INTO turns (id, thread_id, status, started_at) VALUES (${turnId}, ${threadId}, 'running', ${now})`;
        yield* deliverMessages(
          pending.map((m) => m.id),
          turnId,
        );
        yield* startRunning(threadId);
        yield* touchMission(thread.missionId, now);
        yield* sql.afterCommit(changes.publish);
        return {
          accountId: thread.accountId,
          effort: thread.effort,
          harness: thread.harness,
          messages: pending.map((m) => m.text),
          missionId: thread.missionId,
          model: thread.model,
          sessionId: thread.sessionId,
          turnId,
        } satisfies Admitted;
      }),
    );
  });

/**
 * Saves a reply of the running turn to the thread's conversation. A harness that names no model (Codex, OpenCode) leaves
 * the reply under the model the thread chose for this turn, so a later model switch does not relabel it.
 */
export const saveTurnReply = (threadId: string, turn: Admitted, text: string, model: string | null) =>
  transacting(
    Effect.gen(function* () {
      if (!(yield* isCurrentTurn(turn.turnId))) return;
      yield* insertReply(turn.missionId, threadId, text, {
        harness: turn.harness,
        model: model ?? (turn.model === "default" ? null : turn.model),
      });
      yield* publishOnCommit;
    }),
  );

/**
 * Ends a turn that completed or was interrupted; an interrupted one ends the same way (CHG-0039). Answers the
 * threads a budget reached by its spending stopped.
 */
export const completeTurn = (threadId: string, turn: Admitted, outcome: TurnOutcome) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    return yield* sql.withTransaction(
      Effect.gen(function* () {
        if (!(yield* isCurrentTurn(turn.turnId))) return [];
        const { context, cost, isInterrupted, sessionId, usage } = outcome;
        const now = yield* Clock.currentTimeMillis;
        if (usage !== null) {
          const endedAt = yield* Clock.currentTimeMillis;
          yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, cost, context)
            VALUES (${turn.turnId}, ${turn.missionId}, ${threadId}, ${endedAt}, ${usage.input}, ${usage.output},
              ${usage.cacheRead}, ${usage.cacheCreation}, ${cost}, ${context ?? null})`;
        }
        const status = isInterrupted ? "interrupted" : "completed";
        yield* sql`UPDATE turns SET status = ${status}, ended_at = ${now} WHERE id = ${turn.turnId}`;
        yield* endTurn(threadId, turn.turnId, sessionId);
        yield* finishRitualRun(threadId, isInterrupted ? "Interrupted" : "Done");
        yield* touchMission(turn.missionId, now);
        yield* sql.afterCommit(changes.publish);
        // Spending is known at the turn's end: a reached budget stops the work under it.
        return usage === null ? [] : yield* enforceBudgets(turn.missionId, threadId);
      }),
    );
  });

/** Records a failed turn: its messages become undelivered again, so the next message retries them. */
export const recordTurnFailure = (threadId: string, turn: Admitted, reason: string) =>
  transacting(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      if (!(yield* isCurrentTurn(turn.turnId))) return;
      const now = yield* Clock.currentTimeMillis;
      yield* sql`UPDATE turns SET status = 'failed', ended_at = ${now} WHERE id = ${turn.turnId}`;
      yield* sql`UPDATE messages SET delivered_turn_id = NULL WHERE delivered_turn_id = ${turn.turnId}`;
      yield* failTurn(threadId, reason);
      yield* touchMission(turn.missionId, now);
      yield* publishOnCommit;
    }),
  );

/** A steered message was taken in by the running turn: it now belongs to that turn. */
export const deliverSteered = (turn: Admitted, messageId: string) =>
  transacting(
    Effect.gen(function* () {
      if (!(yield* isCurrentTurn(turn.turnId))) return;
      yield* deliverMessages([messageId], turn.turnId);
      yield* publishOnCommit;
    }),
  );
