import type { BillingKind, EffortChoice, HarnessName, ModelChoice, TokenUsage } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { Changes, PriceTable, type TurnOutcome, touchMission } from "../core/index.ts";
import type { StoredAttachment } from "./attachments.ts";
import { enforceBudgets, holdIfReached } from "./budgets.ts";
import { insertThreadLine, recordPendingHandover } from "./handover.ts";
import { endTurn, failTurn, holdThread, startRunning } from "./lifecycle.ts";
import { deliverMessages, insertReply, listPending } from "./messaging.ts";
import { finishRitualRun } from "./rituals.ts";
import { maxRunning, runningCountOf } from "./treeLimits.ts";
import { readThreadWorkspace } from "./workspaces.ts";

// A turn's record in the store: admitted with the thread's messages, then completed or failed. Each step runs
// in its own transaction and publishes a change once committed; a step for a turn no longer running does nothing.

/** A turn admitted for a thread, with the runner it takes and the messages delivered to it. */
export interface Admitted {
  readonly accountId: string | null;
  /** The files attached to the delivered messages, in order (message-attachments). */
  readonly attachments: ReadonlyArray<StoredAttachment>;
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
        // The owner's change of runner since the last turn leaves its line now that a turn runs on it.
        yield* recordPendingHandover(threadId, now);
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
          attachments: pending.flatMap((message) => message.attachments),
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
export const saveTurnReply = (
  threadId: string,
  turn: Admitted,
  text: string,
  model: string | null,
  usage: TokenUsage | null = null,
) =>
  transacting(
    Effect.gen(function* () {
      if (!(yield* isCurrentTurn(turn.turnId))) return;
      const written = model ?? (turn.model === "default" ? null : turn.model);
      const messageId = yield* insertReply(turn.missionId, threadId, text, { harness: turn.harness, model: written });
      // The call behind the reply, when the harness reports usage per call; the turn's remainder joins it at the turn's end.
      if (usage !== null) {
        const sql = yield* SqlClient.SqlClient;
        const estimate = written === null ? null : yield* (yield* PriceTable).estimate(written, usage);
        yield* sql`INSERT INTO reply_usage (message_id, input, output, cache_read, cache_creation, estimate)
          VALUES (${messageId}, ${usage.input}, ${usage.output}, ${usage.cacheRead}, ${usage.cacheCreation}, ${estimate?.amount ?? null})`;
      }
      yield* publishOnCommit;
    }),
  );

/** Records a line the harness adapter left in the thread during the turn, such as a session it could not continue. */
export const saveTurnNotice = (threadId: string, turn: Admitted, text: string) =>
  transacting(
    Effect.gen(function* () {
      if (!(yield* isCurrentTurn(turn.turnId))) return;
      yield* insertThreadLine(threadId, text, yield* Clock.currentTimeMillis);
      yield* publishOnCommit;
    }),
  );

/**
 * Gives the turn's last reply what the turn used beyond its replies' own calls, so the lines under a turn's replies add
 * up to the turn: with no per-call usage, the whole turn's, with its cost as reported or estimated (budget-control,
 * Seeing budget use and consumption). Callers run it in a transaction, after the turn's usage is recorded.
 */
const attachTurnRemainder = (
  threadId: string,
  turn: Admitted,
  usage: TokenUsage,
  turnCost: { readonly estimate: number | null; readonly reported: number | null },
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const replies = yield* sql<{ id: string; model: string | null }>`
      SELECT m.id, m.model FROM messages m
      WHERE m.thread_id = ${threadId} AND m.sender_kind = 'agent'
        AND m.sent_at >= (SELECT started_at FROM turns WHERE id = ${turn.turnId})
      ORDER BY m.sequence`;
    const last = replies.at(-1);
    if (last === undefined) return;
    const [own] = yield* sql<TokenUsage>`
      SELECT COALESCE(SUM(input), 0) AS input, COALESCE(SUM(output), 0) AS output,
        COALESCE(SUM(cache_read), 0) AS cacheRead, COALESCE(SUM(cache_creation), 0) AS cacheCreation
      FROM reply_usage WHERE message_id IN ${sql.in(replies.map((reply) => reply.id))}`;
    const spent = own ?? { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 };
    const rest = {
      cacheCreation: Math.max(0, usage.cacheCreation - spent.cacheCreation),
      cacheRead: Math.max(0, usage.cacheRead - spent.cacheRead),
      input: Math.max(0, usage.input - spent.input),
      output: Math.max(0, usage.output - spent.output),
    };
    if (rest.input + rest.output + rest.cacheRead + rest.cacheCreation === 0) return;
    const [existing] = yield* sql<{
      estimate: number | null;
    }>`SELECT estimate FROM reply_usage WHERE message_id = ${last.id}`;
    const isWholeTurn = spent.input + spent.output + spent.cacheRead + spent.cacheCreation === 0;
    // A whole turn carries the turn's own cost; a remainder adds to the call's own estimate.
    const restEstimate = isWholeTurn
      ? turnCost.estimate
      : last.model === null
        ? null
        : ((yield* (yield* PriceTable).estimate(last.model, rest))?.amount ?? null);
    const estimate =
      existing === undefined || existing.estimate === null
        ? restEstimate
        : restEstimate === null
          ? existing.estimate
          : Math.round((existing.estimate + restEstimate) * 1e6) / 1e6;
    yield* sql`INSERT INTO reply_usage (message_id, input, output, cache_read, cache_creation, estimate, reported)
      VALUES (${last.id}, ${rest.input}, ${rest.output}, ${rest.cacheRead}, ${rest.cacheCreation}, ${estimate}, ${isWholeTurn ? turnCost.reported : null})
      ON CONFLICT (message_id) DO UPDATE SET input = input + excluded.input, output = output + excluded.output,
        cache_read = cache_read + excluded.cache_read, cache_creation = cache_creation + excluded.cache_creation,
        estimate = excluded.estimate, reported = excluded.reported`;
  });

/**
 * The model a turn ran on, as its estimate is priced: the model the thread chose, or for the harness's own default
 * the model that wrote the thread's latest reply; null when neither is known.
 */
const modelOfTurn = (threadId: string, turn: Admitted) =>
  Effect.gen(function* () {
    if (turn.model !== "default") return turn.model;
    const sql = yield* SqlClient.SqlClient;
    const [reply] = yield* sql<{ model: string }>`
      SELECT model FROM messages WHERE thread_id = ${threadId} AND sender_kind = 'agent' AND model IS NOT NULL
      ORDER BY sequence DESC LIMIT 1`;
    return reply?.model ?? null;
  });

/**
 * A turn's estimated cost, stamped with where it came from: the price table, or the harness's own figure for a
 * model the table lacks (budget-control, Estimated cost). Null leaves the turn unpriced.
 */
const estimateOf = (
  prices: PriceTable["Service"],
  model: string | null,
  usage: TokenUsage,
  billing: BillingKind,
  cost: number | null,
  at: number,
) =>
  Effect.gen(function* () {
    const fromTable = model === null ? null : yield* prices.estimate(model, usage);
    if (fromTable !== null) return { amount: fromTable.amount, pricedAt: fromTable.pricedAt, source: "Table" } as const;
    if (billing !== "ApiKey" && cost !== null) return { amount: cost, pricedAt: at, source: "Harness" } as const;
    return null;
  });

/**
 * Ends a turn that completed or was interrupted; an interrupted one ends the same way (CHG-0039). Answers the
 * threads a budget reached by its spending stopped.
 */
export const completeTurn = (threadId: string, turn: Admitted, outcome: TurnOutcome) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const prices = yield* PriceTable;
    return yield* sql.withTransaction(
      Effect.gen(function* () {
        if (!(yield* isCurrentTurn(turn.turnId))) return [];
        const { billing, context, cost, isInterrupted, sessionId, usage } = outcome;
        const now = yield* Clock.currentTimeMillis;
        if (usage !== null) {
          const endedAt = yield* Clock.currentTimeMillis;
          const model = yield* modelOfTurn(threadId, turn);
          const estimate = yield* estimateOf(prices, model, usage, billing, cost, endedAt);
          yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, cost, context, billing,
              harness, model, account_id, estimate, estimate_source, priced_at)
            VALUES (${turn.turnId}, ${turn.missionId}, ${threadId}, ${endedAt}, ${usage.input}, ${usage.output},
              ${usage.cacheRead}, ${usage.cacheCreation}, ${cost}, ${context ?? null}, ${billing},
              ${turn.harness}, ${model}, ${turn.accountId}, ${estimate?.amount ?? null}, ${estimate?.source ?? null}, ${estimate?.pricedAt ?? null})`;
          yield* attachTurnRemainder(threadId, turn, usage, {
            estimate: billing === "ApiKey" && cost !== null ? null : (estimate?.amount ?? null),
            reported: billing === "ApiKey" ? cost : null,
          });
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
