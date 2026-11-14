import type { EffortChoice, HarnessName, ModelChoice } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { Changes, touchMission } from "../core/index.ts";
import type { StoredAttachment } from "./attachments.ts";
import { holdIfReached } from "./budgets.ts";
import { recordPendingHandover } from "./handover.ts";
import { holdThread, startRunning } from "./lifecycle.ts";
import { deliverMessages, listPending } from "./messaging.ts";
import { isQuestRealmArchived } from "./realmAccess.ts";
import { maxRunning, runningCountOf } from "./treeLimits.ts";
import { readThreadWorkspace } from "./workspaces.ts";

/** A turn admitted with the runner and messages whose execution it owns. */
export type Admitted = {
  readonly accountId: string | null;
  readonly attachments: ReadonlyArray<StoredAttachment>;
  readonly effort: EffortChoice;
  readonly harness: HarnessName;
  readonly messages: ReadonlyArray<string>;
  readonly missionId: string;
  readonly model: ModelChoice;
  readonly sessionId: string | null;
  readonly turnId: string;
};

/** Whether output still belongs to this thread's current running turn. */
export const isCurrentTurn = (turnId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`SELECT id FROM turns WHERE id = ${turnId} AND status = 'running'`;
    return rows.length > 0;
  });

/**
 * The harness whose permission authority applies to the thread now: its running turn's admitted harness, or the
 * thread's selected harness between turns (thread-handover). Null for a thread that does not exist.
 */
export const readAuthorityHarness = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ harness: HarnessName }>`SELECT COALESCE(
      (SELECT turns.harness FROM turns WHERE turns.thread_id = threads.id AND turns.status = 'running'
        ORDER BY turns.started_at DESC, turns.rowid DESC LIMIT 1),
      threads.harness) AS harness
    FROM threads WHERE threads.id = ${threadId}`;
  return row?.harness ?? null;
});

/** The thread's running turn, the latest when several run, or null between turns. */
export const readRunningTurnId = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [turn] = yield* sql<{ id: string }>`SELECT id FROM turns
    WHERE thread_id = ${threadId} AND status = 'running' ORDER BY started_at DESC, rowid DESC LIMIT 1`;
  return turn?.id ?? null;
});

/** Admits pending messages only when the thread, realm, workspace, budget, and running limit permit work. */
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
            account_id AS accountId FROM threads WHERE id = ${threadId}`;
        // Attention can hold a turn still running in its harness; Stopped always needs an explicit resume.
        if (thread === undefined || ["Running", "Attention", "Stopped"].includes(thread.state)) return null;
        if (yield* isQuestRealmArchived(thread.missionId)) return null;
        const pending = yield* listPending(threadId, false);
        if (pending.length === 0) return null;
        if ((yield* runningCountOf(thread.missionId)) >= maxRunning) return null;
        const now = yield* Clock.currentTimeMillis;
        const workspace = yield* readThreadWorkspace(threadId);
        if (workspace?.isMissing === true) {
          yield* holdThread(threadId, "MissingWorkspace");
          yield* touchMission(thread.missionId, now);
          yield* sql.afterCommit(changes.publish);
          return null;
        }
        if (yield* holdIfReached(threadId, thread.missionId)) {
          yield* touchMission(thread.missionId, now);
          yield* sql.afterCommit(changes.publish);
          return null;
        }
        // A runner change is recorded when it actually runs, not while messages wait for admission.
        yield* recordPendingHandover(threadId, now);
        const turnId = crypto.randomUUID();
        yield* sql`INSERT INTO turns (id, thread_id, status, started_at, harness)
          VALUES (${turnId}, ${threadId}, 'running', ${now}, ${thread.harness})`;
        yield* deliverMessages(
          pending.map((message) => message.id),
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
          messages: pending.map((message) => message.text),
          missionId: thread.missionId,
          model: thread.model,
          sessionId: thread.sessionId,
          turnId,
        } satisfies Admitted;
      }),
    );
  });
