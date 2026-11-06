import type { Message, MissionDetail, ThreadSummary } from "@openmission/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { listBudgetEvents, readHeldStop } from "./budgetViews.ts";
import { readChatter } from "./chatter.ts";
import { notFound } from "./errors.ts";
import { readGauge } from "./intel.ts";
import { listThreadIntelChanges } from "./intelViews.ts";
import { threadActionsOf } from "./lifecycle.ts";
import { listMissionSummaries } from "./missions.ts";
import { listThreadQuestions } from "./questions.ts";
import { listThreadSuggestions } from "./suggestionStore.ts";
import { readThreadWorkspace } from "./workspaces.ts";

// What the owner reads of one mission: its thread tree and one thread's conversation.

type ThreadRow = Omit<ThreadSummary, "isOpenedByAgent" | "isAside"> & { isOpenedByAgent: number; isAside: number };

/** The mission's threads with their depth and kept messages, each parent before the threads beneath it. */
const listThreads = (missionId: string, topThreadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<ThreadRow & { path: string }>`
      WITH RECURSIVE tree(id, depth, path) AS (
        SELECT id, 0, '' FROM threads WHERE id = ${topThreadId}
        UNION ALL
        SELECT t.id, tree.depth + 1, tree.path || printf('%020d', t.rowid) || '/'
        FROM threads t JOIN tree ON t.parent_id = tree.id
      )
      SELECT t.id, t.parent_id AS parentId, t.title, t.state, tree.depth, tree.path,
        t.is_opened_by_agent AS isOpenedByAgent, t.is_aside AS isAside,
        (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id AND m.sender_kind IN ('user', 'thread')
          AND m.delivered_turn_id IS NULL) AS waitingCount
      FROM tree JOIN threads t ON t.id = tree.id
      WHERE t.mission_id = ${missionId}
      ORDER BY tree.path`;
    return rows.map(
      ({ path: _path, ...row }) =>
        ({ ...row, isAside: row.isAside === 1, isOpenedByAgent: row.isOpenedByAgent === 1 }) as ThreadSummary,
    );
  });

/** A mission with its thread tree and the conversation of one thread, the top thread by default. */
export const readMission = (missionId: string, threadId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [summary] = yield* listMissionSummaries([missionId]);
    if (summary === undefined) return yield* notFound("No such mission.");
    const threads = yield* listThreads(missionId, summary.topThreadId);
    const selected = threads.find((thread) => thread.id === (threadId ?? summary.topThreadId));
    if (selected === undefined) return yield* notFound("No such thread in this mission.");
    const [thread] = yield* sql<Pick<MissionDetail["thread"], "id" | "model" | "effort" | "failure" | "blocker">>`
      SELECT id, model, effort, failure, blocker FROM threads WHERE id = ${selected.id}`;
    if (thread === undefined) return yield* notFound("No such thread in this mission.");
    const workspace = yield* readThreadWorkspace(selected.id);
    const messages = yield* sql<Omit<Message, "isResult" | "isQueued"> & { isResult: number; isQueued: number }>`
      SELECT m.id, m.thread_id AS threadId, m.sender_kind AS sender, m.text, m.sequence, m.sent_at AS sentAt,
        m.sender_thread_id AS fromThreadId, COALESCE(s.title, m.sender_title) AS fromTitle, m.is_result AS isResult,
        (m.is_queued = 1 AND m.delivered_turn_id IS NULL) AS isQueued
      FROM messages m LEFT JOIN threads s ON s.id = m.sender_thread_id
      WHERE m.thread_id = ${selected.id} ORDER BY m.sequence`;
    const questions = yield* listThreadQuestions(selected.id);
    const suggestions = yield* listThreadSuggestions(selected.id);
    return {
      budgetEvents: selected.parentId === null ? yield* listBudgetEvents(missionId) : [],
      budgetStop: yield* readHeldStop(selected.id),
      chatter: yield* readChatter(selected.id),
      intelChanges: yield* listThreadIntelChanges(selected.id),
      intelGauge: yield* readGauge(selected.id),
      messages: messages.map((message) => ({
        ...message,
        isQueued: message.isQueued === 1,
        isResult: message.isResult === 1,
      })),
      mission: summary,
      questions,
      suggestions,
      thread: {
        ...thread,
        actions: threadActionsOf({ blocker: thread.blocker, depth: selected.depth, state: selected.state }),
        depth: selected.depth,
        parentId: selected.parentId,
        state: selected.state,
        title: selected.title,
        waitingCount: selected.waitingCount,
        workspace,
      },
      threads,
    } as MissionDetail;
  });
