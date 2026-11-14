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
        yield* sql`INSERT INTO turns (id, thread_id, status, started_at) VALUES (${turnId}, ${threadId}, 'running', ${now})`;
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
