import type { Message, MissionDetail, ThreadSummary } from "@gild/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "../core/index.ts";
import { ownAccountLabel } from "../harness/index.ts";
import { listThreadLoreChanges, readGauge } from "../lore/index.ts";
import { listThreadQuestions } from "../policy/index.ts";
import { readCards } from "./attachments.ts";
import { listBudgetEvents, readHeldStop } from "./budgetViews.ts";
import { readChatter } from "./chatter.ts";
import { listHandovers } from "./handover.ts";
import { threadActionsOf } from "./lifecycle.ts";
import { listMissionSummaries } from "./missions.ts";
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
        (SELECT COALESCE(MIN(m.sent_at), 0) FROM messages m WHERE m.thread_id = t.id) AS openedAt,
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

/** An account's label: the computer's own sign-in reads "This computer", and an account removed since says so. */
const accountLabelOf = (accountId: string | null, label: string | null) =>
  accountId === null ? ownAccountLabel : (label ?? "Removed account");

/** A mission with its thread tree and the conversation of one thread, the top thread by default. */
export const readMission = (missionId: string, threadId: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [summary] = yield* listMissionSummaries([missionId]);
    if (summary === undefined) return yield* notFound("No such mission.");
    const threads = yield* listThreads(missionId, summary.topThreadId);
    const selected = threads.find((thread) => thread.id === (threadId ?? summary.topThreadId));
    if (selected === undefined) return yield* notFound("No such thread in this mission.");
    const [thread] = yield* sql<
      Pick<MissionDetail["thread"], "id" | "model" | "effort" | "failure" | "blocker" | "harness" | "accountId"> & {
        accountLabel: string | null;
      }
    >`SELECT t.id, t.model, t.effort, t.failure, t.blocker, t.harness, t.account_id AS accountId, a.label AS accountLabel
      FROM threads t LEFT JOIN accounts a ON a.id = t.account_id WHERE t.id = ${selected.id}`;
    if (thread === undefined) return yield* notFound("No such thread in this mission.");
    const workspace = yield* readThreadWorkspace(selected.id);
    const messages = yield* sql<
      Omit<Message, "attachments" | "isResult" | "isQueued" | "usage"> & {
        isResult: number;
        isQueued: number;
        usageCacheCreation: number | null;
        usageCacheRead: number | null;
        usageEstimate: number | null;
        usageInput: number | null;
        usageOutput: number | null;
        usageReported: number | null;
      }
    >`
      SELECT m.id, m.thread_id AS threadId, m.sender_kind AS sender, m.model, m.harness, m.text, m.sequence, m.sent_at AS sentAt,
        m.sender_thread_id AS fromThreadId, COALESCE(s.title, m.sender_title) AS fromTitle, m.is_result AS isResult,
        CASE WHEN sm.is_guildmaster = 0 THEN s.mission_id END AS fromMissionId,
        (m.is_queued = 1 AND m.delivered_turn_id IS NULL) AS isQueued,
        ru.input AS usageInput, ru.output AS usageOutput, ru.cache_read AS usageCacheRead,
        ru.cache_creation AS usageCacheCreation, ru.estimate AS usageEstimate, ru.reported AS usageReported
      FROM messages m LEFT JOIN reply_usage ru ON ru.message_id = m.id LEFT JOIN threads s ON s.id = m.sender_thread_id LEFT JOIN missions sm ON sm.id = s.mission_id
      WHERE m.thread_id = ${selected.id} ORDER BY m.sequence`;
    const cards = yield* readCards(messages.map((message) => message.id));
    const questions = yield* listThreadQuestions(selected.id);
    const suggestions = yield* listThreadSuggestions(selected.id);
    return {
      budgetEvents: selected.parentId === null ? yield* listBudgetEvents(missionId) : [],
      budgetStop: yield* readHeldStop(selected.id),
      chatter: yield* readChatter(selected.id),
      handovers: yield* listHandovers(selected.id),
      loreChanges: yield* listThreadLoreChanges(selected.id),
      loreGauge: yield* readGauge(selected.id),
      messages: messages.map(
        ({
          usageCacheCreation,
          usageCacheRead,
          usageEstimate,
          usageInput,
          usageOutput,
          usageReported,
          ...message
        }) => ({
          ...message,
          attachments: cards.get(message.id) ?? [],
          isQueued: message.isQueued === 1,
          isResult: message.isResult === 1,
          usage:
            usageInput === null
              ? null
              : {
                  estimated: usageEstimate,
                  reported: usageReported,
                  tokens: {
                    cacheCreation: usageCacheCreation ?? 0,
                    cacheRead: usageCacheRead ?? 0,
                    input: usageInput,
                    output: usageOutput ?? 0,
                  },
                },
        }),
      ),
      mission: summary,
      questions,
      suggestions,
      thread: {
        ...thread,
        accountLabel: accountLabelOf(thread.accountId, thread.accountLabel),
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
