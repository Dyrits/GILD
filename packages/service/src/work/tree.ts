import type { HarnessName, OpenThreadResult, ThreadId } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import { checkAccount, type Runner, type RunnerChoice, runnerOf } from "../harness/index.ts";
import { budgetRefusalOf } from "./budgetScopes.ts";
import { changed, unchanged } from "./commands.ts";
import { type JournalAuthor, nothingToRecord, openerMessagesOf, updateJournal } from "./journal.ts";
import { maxOwnerDepth, waitsInTurn } from "./lifecycle.ts";
import { insertMessage } from "./messaging.ts";
import { readStartingContext, startingContextRefusalOf } from "./startingContext.ts";
import { attachmentsTitle, titleOf } from "./titles.ts";

/** At most this many threads run at once in a mission (thread-tree, Limits; CHG-0037). */
export const maxRunning = 8;

/** How many levels a thread is beneath its mission's top thread, which is 0. */
const depthOf = (threadId: string) =>
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

/**
 * How many of the mission's threads are inside a turn: Running, or in Attention on a question asked during it,
 * whose harness process still runs (thread-tree, Limits).
 */
export const runningCountOf = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ count: number }>`
      SELECT COUNT(*) AS count FROM threads
      WHERE mission_id = ${missionId} AND (state = 'Running' OR ${sql.literal(waitsInTurn)})`;
    return row?.count ?? 0;
  });

interface Opening {
  /** The files attached to the first message, added beforehand as drafts (message-attachments). */
  readonly attachmentIds?: ReadonlyArray<string>;
  /** The opener's choices; what it leaves out comes from the parent (runnerOf). */
  readonly choice: RunnerChoice;
  /** An off-topic request the owner kept beneath the thread (thread-tree, Off-topic requests). */
  readonly isAside: boolean;
  readonly isOpenedByAgent: boolean;
  readonly parentId: string;
  readonly text: string;
  /** A short title; the first line of the text when null. */
  readonly title: string | null;
}

/** The parent's runner and where it works, or undefined when it is gone. */
const readParent = (parentId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [parent] = yield* sql<
      Runner & { backups: string; missionId: string; workspaceId: string | null }
    >`SELECT mission_id AS missionId, harness, account_id AS accountId, model, effort, workspace_id AS workspaceId, backups
      FROM threads WHERE id = ${parentId} AND is_deleting = 0`;
    return parent;
  });

/**
 * Records a thread beneath the parent, in the parent's workspace and, unless chosen, with its harness,
 * account, model, effort, and backup Companions, and its first message: the opener's request. The command that opens it wakes
 * it.
 */
const insertThread = (opening: Opening) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const parent = yield* readParent(opening.parentId);
    if (parent === undefined) return yield* notFound("No such thread.");
    const runner = yield* checkAccount(runnerOf(parent, opening.choice));
    const threadId = crypto.randomUUID();
    // An aside starts from the off-topic request alone, without its opener's conversation.
    const openerMessages = opening.isAside ? null : yield* openerMessagesOf(opening.parentId);
    yield* sql`INSERT INTO threads (id, mission_id, parent_id, state, harness, account_id, model, effort, workspace_id, title, is_opened_by_agent, opener_messages, is_aside, backups)
      VALUES (${threadId}, ${parent.missionId}, ${opening.parentId}, 'Idle', ${runner.harness}, ${runner.accountId},
        ${runner.model}, ${runner.effort}, ${parent.workspaceId}, ${titleOf(opening.title ?? opening.text) || attachmentsTitle}, ${opening.isOpenedByAgent ? 1 : 0},
        ${openerMessages}, ${opening.isAside ? 1 : 0}, ${parent.backups})`;
    const messageId = yield* insertMessage({
      fromThreadId: opening.isOpenedByAgent ? opening.parentId : null,
      isQueued: false,
      isResult: false,
      text: opening.text,
      threadId,
      ...(opening.attachmentIds === undefined ? {} : { attachmentIds: opening.attachmentIds }),
    });
    return { messageId, threadId: threadId as ThreadId } satisfies OpenThreadResult;
  });

/**
 * The owner opens a thread beneath any thread, down to the depth limit. One whose starting context is over
 * the warning starts only when the owner chose to start it anyway; the new thread is then woken.
 */
export const openThreadByOwner = (
  parentId: string,
  text: string,
  choice: RunnerChoice & { readonly model: string },
  shouldStartAnyway: boolean,
  attachmentIds: ReadonlyArray<string> = [],
) =>
  Effect.gen(function* () {
    if ((yield* depthOf(parentId)) + 1 > maxOwnerDepth) {
      return yield* invalid(`Threads you open can go down to ${maxOwnerDepth} levels beneath the top thread.`);
    }
    if (!shouldStartAnyway) {
      const refusal = startingContextRefusalOf(
        yield* readStartingContext(parentId, { harness: choice.harness ?? null, model: choice.model }, text),
      );
      if (refusal !== null) return yield* invalid(refusal);
    }
    const opened = yield* insertThread({
      attachmentIds,
      choice,
      isAside: false,
      isOpenedByAgent: false,
      parentId,
      text,
      title: null,
    });
    return changed(opened, { threadsToWake: [opened.threadId] });
  });

/**
 * Keeps an off-topic request as an aside beneath the thread: its first message is the owner's request, and
 * the aside is then woken.
 */
export const openAside = (parentId: string, text: string, title: string) =>
  insertThread({
    choice: {},
    isAside: true,
    isOpenedByAgent: false,
    parentId,
    text,
    title: title.trim() === "" ? null : title,
  }).pipe(Effect.map((opened) => changed(opened, { threadsToWake: [opened.threadId] })));

/** Whether the thread is an aside, which leaves the journal to its parent. */
export const isAside = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`SELECT id FROM threads WHERE id = ${threadId} AND is_aside = 1`;
    return rows.length > 0;
  });

/** What `open_thread` came to: the new thread, or why it was refused. */
export type OpenedByAgent =
  | { readonly _tag: "Opened"; readonly threadId: ThreadId }
  | { readonly _tag: "Refused"; readonly reason: string };

/** A refused `open_thread`, which changes nothing. */
export const refusedOf = (reason: string) => unchanged<OpenedByAgent>({ _tag: "Refused", reason });

/**
 * A thread opens a thread beneath itself (`open_thread`): the new thread's identifier, woken once committed,
 * or the reason it is refused.
 */
export const openThreadByAgent = (
  callerId: string,
  request: string,
  title: string | null,
  choice: RunnerChoice & { readonly harness: HarnessName | null },
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [caller] = yield* sql<{
      accountId: string | null;
      harness: HarnessName;
      missionId: string;
    }>`SELECT mission_id AS missionId, harness, account_id AS accountId FROM threads WHERE id = ${callerId} AND is_deleting = 0`;
    if (caller === undefined) return refusedOf("Unknown thread.");
    if (request.trim() === "") return refusedOf("The request is empty.");
    const target = runnerOf(
      { accountId: caller.accountId, effort: "default", harness: caller.harness, model: "default" },
      choice,
    );
    const overBudget = yield* budgetRefusalOf(caller.missionId, {
      accountId: target.accountId,
      harness: target.harness,
    });
    if (overBudget !== null) return refusedOf(`Not opened: ${overBudget}`);
    if ((yield* runningCountOf(caller.missionId)) >= maxRunning)
      return refusedOf(
        `${maxRunning} threads are already running in this mission. Wait for one to finish, or ask the owner.`,
      );
    const opened = yield* insertThread({
      choice,
      isAside: false,
      isOpenedByAgent: true,
      parentId: callerId,
      text: request,
      title: title !== null && title.trim() !== "" ? title : null,
    });
    return changed<OpenedByAgent>({ _tag: "Opened", threadId: opened.threadId }, { threadsToWake: [opened.threadId] });
  });

/**
 * Whether a thread may message another: its parent, a thread directly beneath it (thread-messaging), any thread to
 * the Guildmaster, and the Guildmaster to a quest's top thread (quest coordination, References between quests).
 */
export const isWithinReach = (fromId: string, toId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`
      SELECT id FROM threads
      WHERE (id = ${toId} AND parent_id = ${fromId})
        OR (id = ${fromId} AND parent_id = ${toId})
      UNION
      SELECT t.id FROM threads t JOIN missions m ON m.id = t.mission_id
      WHERE t.id = ${toId} AND m.is_guildmaster = 1 AND t.id <> ${fromId} AND t.is_deleting = 0
      UNION
      SELECT t.id FROM threads t JOIN missions m ON m.id = t.mission_id
      WHERE t.id = ${toId} AND m.is_guildmaster = 0 AND t.parent_id IS NULL AND t.is_deleting = 0
        AND EXISTS (SELECT 1 FROM threads f JOIN missions fm ON fm.id = f.mission_id
          WHERE f.id = ${fromId} AND fm.is_guildmaster = 1)`;
    return rows.length > 0;
  });

/** Whether a thread is directly beneath another, the only threads it may interrupt (thread-messaging). */
export const isBeneath = (parentId: string, childId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`SELECT id FROM threads WHERE id = ${childId} AND parent_id = ${parentId}`;
    return rows.length > 0;
  });

/** Whether a result's journal answer says there is nothing to record, in any case and with a final period. */
const isNothingToRecord = (journal: string) => journal.trim().toLowerCase().replace(/\.$/, "") === nothingToRecord;

/**
 * Records the caller's journal entry, unless it has nothing to record, then its result: it goes to the
 * parent as a thread message, which wakes it, and the turn now running ends the caller Done. Returns the
 * parent, or null for a top thread.
 */
export const reportResult = (threadId: string, result: string, journal: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [thread] = yield* sql<{
      missionId: string;
      parentId: string | null;
      isAside: number;
    }>`SELECT mission_id AS missionId, parent_id AS parentId, is_aside AS isAside FROM threads WHERE id = ${threadId}`;
    if (thread === undefined) return yield* notFound("No such thread.");
    // An aside leaves the journal to its parent (thread-tree, Off-topic requests).
    if (thread.isAside === 0 && !isNothingToRecord(journal)) {
      const author: JournalAuthor = { kind: "thread", threadId };
      yield* updateJournal(thread.missionId, author, journal, null);
    }
    yield* sql`UPDATE threads SET reported_turn_id = (
        SELECT id FROM turns WHERE thread_id = ${threadId} AND status = 'running' ORDER BY started_at DESC LIMIT 1)
      WHERE id = ${threadId}`;
    // The top thread's result asks the owner "Mark as done?"; the mission does not end on its own.
    if (thread.parentId === null)
      yield* sql`UPDATE missions SET is_asking_done = 1 WHERE id = ${thread.missionId} AND ending IS NULL`;
    else {
      yield* insertMessage({
        fromThreadId: threadId,
        isQueued: false,
        isResult: true,
        text: result,
        threadId: thread.parentId,
      });
    }
    return changed(thread.parentId, { threadsToWake: thread.parentId === null ? [] : [thread.parentId] });
  });
