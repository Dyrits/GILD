import type { EffortChoice, ModelChoice, OpenThreadResult, ThreadId } from "@openmission/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "./errors.ts";
import { insertMessage } from "./messaging.ts";
import { titleOf } from "./missions.ts";

/** At most this many threads run at once in a mission (thread-tree, Limits; CHG-0037). */
export const maxRunning = 8;
/** The owner opens threads down to this many levels beneath the top thread; agents have no depth limit. */
export const maxOwnerDepth = 4;

/** States in which a thread beneath keeps its parent Waiting. */
export const activeStates = ["Running", "Waiting", "Attention"];

/** How many levels a thread is beneath its mission's top thread, which is 0. */
export const depthOf = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ depth: number }>`
      WITH RECURSIVE ancestors(id, parent_id, depth) AS (
        SELECT id, parent_id, 0 FROM threads WHERE id = ${threadId}
        UNION ALL
        SELECT t.id, t.parent_id, a.depth + 1 FROM threads t JOIN ancestors a ON t.id = a.parent_id
      )
      SELECT MAX(depth) AS depth FROM ancestors`;
    return row?.depth ?? 0;
  });

/** How many of the mission's threads are Running. */
export const runningCountOf = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ count: number }>`
      SELECT COUNT(*) AS count FROM threads WHERE mission_id = ${missionId} AND state = 'Running'`;
    return row?.count ?? 0;
  });

interface Opening {
  readonly effort: EffortChoice | null;
  readonly isOpenedByAgent: boolean;
  readonly model: ModelChoice | null;
  readonly parentId: string;
  readonly text: string;
  /** A short title; the first line of the text when null. */
  readonly title: string | null;
}

/**
 * Records a thread beneath the parent, in the parent's workspace and, unless chosen, with its model and
 * effort, and its first message: the opener's request. Callers run it in a transaction and wake it.
 */
const insertThread = (opening: Opening) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [parent] = yield* sql<{
      missionId: string;
      model: ModelChoice;
      effort: EffortChoice;
      workspaceId: string | null;
    }>`SELECT mission_id AS missionId, model, effort, workspace_id AS workspaceId FROM threads WHERE id = ${opening.parentId}`;
    if (parent === undefined) return yield* notFound("No such thread.");
    const threadId = crypto.randomUUID();
    yield* sql`INSERT INTO threads (id, mission_id, parent_id, state, model, effort, workspace_id, title, is_opened_by_agent)
      VALUES (${threadId}, ${parent.missionId}, ${opening.parentId}, 'Idle', ${opening.model ?? parent.model},
        ${opening.effort ?? parent.effort}, ${parent.workspaceId}, ${titleOf(opening.title ?? opening.text)}, ${opening.isOpenedByAgent ? 1 : 0})`;
    const messageId = yield* insertMessage({
      fromThreadId: opening.isOpenedByAgent ? opening.parentId : null,
      isQueued: false,
      isResult: false,
      text: opening.text,
      threadId,
    });
    return { messageId, threadId: threadId as ThreadId } satisfies OpenThreadResult;
  });

/** The owner opens a thread beneath any thread, down to the depth limit. Callers run it in a transaction. */
export const openThreadByOwner = (parentId: string, text: string, model: ModelChoice, effort: EffortChoice) =>
  Effect.gen(function* () {
    if ((yield* depthOf(parentId)) + 1 > maxOwnerDepth) {
      return yield* invalid(`Threads you open can go down to ${maxOwnerDepth} levels beneath the top thread.`);
    }
    return yield* insertThread({ effort, isOpenedByAgent: false, model, parentId, text, title: null });
  });

/**
 * A thread opens a thread beneath itself (`open_thread`): the new thread's identifier, or the reason it is
 * refused. Callers run it in a transaction and wake the new thread.
 */
export const openThreadByAgent = (
  callerId: string,
  request: string,
  title: string | null,
  model: ModelChoice | null,
  effort: EffortChoice | null,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [caller] = yield* sql<{
      missionId: string;
    }>`SELECT mission_id AS missionId FROM threads WHERE id = ${callerId}`;
    if (caller === undefined) return { _tag: "Refused", reason: "Unknown thread." } as const;
    if (request.trim() === "") return { _tag: "Refused", reason: "The request is empty." } as const;
    if ((yield* runningCountOf(caller.missionId)) >= maxRunning) {
      return {
        _tag: "Refused",
        reason: `${maxRunning} threads are already running in this mission. Wait for one to finish, or ask the owner.`,
      } as const;
    }
    const opened = yield* insertThread({
      effort,
      isOpenedByAgent: true,
      model,
      parentId: callerId,
      text: request,
      title: title !== null && title.trim() !== "" ? title : null,
    });
    return { _tag: "Opened", threadId: opened.threadId } as const;
  });

/** Whether a thread may message another: its parent, or a thread directly beneath it (thread-messaging). */
export const isWithinReach = (fromId: string, toId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`
      SELECT id FROM threads
      WHERE (id = ${toId} AND parent_id = ${fromId})
        OR (id = ${fromId} AND parent_id = ${toId})`;
    return rows.length > 0;
  });

/** Whether a thread is directly beneath another, the only threads it may interrupt (thread-messaging). */
export const isBeneath = (parentId: string, childId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`SELECT id FROM threads WHERE id = ${childId} AND parent_id = ${parentId}`;
    return rows.length > 0;
  });

/**
 * Records the caller's result: it goes to the parent as a thread message, and the turn now running ends
 * the caller Done. Returns the parent, or null for a top thread. Callers run it in a transaction.
 */
export const reportResult = (threadId: string, result: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [thread] = yield* sql<{
      parentId: string | null;
    }>`SELECT parent_id AS parentId FROM threads WHERE id = ${threadId}`;
    if (thread === undefined) return yield* notFound("No such thread.");
    yield* sql`UPDATE threads SET reported_turn_id = (
        SELECT id FROM turns WHERE thread_id = ${threadId} AND status = 'running' ORDER BY started_at DESC LIMIT 1)
      WHERE id = ${threadId}`;
    if (thread.parentId !== null) {
      yield* insertMessage({
        fromThreadId: threadId,
        isQueued: false,
        isResult: true,
        text: result,
        threadId: thread.parentId,
      });
    }
    return thread.parentId;
  });

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
