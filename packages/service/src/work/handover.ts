import type { BackupCompanion, EffortChoice, HarnessName, ModelChoice } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound, tokensOf } from "../core/index.ts";
import { checkAccount, checkBackups, harnessLabels, type Runner } from "../harness/index.ts";
import { contextWindowOf } from "../lore/index.ts";
import { readStoredAttachments } from "./attachments.ts";
import { changed, unchanged } from "./commands.ts";

// Handover (thread-handover): the owner changes a thread's harness, account, model, or effort between turns.
// A harness's own session cannot be resumed by another harness or under another account, so such a change
// starts a new session that is given the thread's whole conversation (ADR 0006); a change of model or
// effort alone carries on in the same session.

/** The share of the new model's context window the replayed conversation may take, in percent (provisional). */
const historyWindowPercent = 50;

/** What a handover line says: the new runner in words, as the thread's conversation shows it. */
const handoverTextOf = (runner: Runner, accountLabel: string | null, fellBackAfter: string | null) =>
  [
    `${fellBackAfter === null ? "Handed over" : "Fell back"} to ${harnessLabels[runner.harness]}`,
    runner.model === "default" ? "default model" : runner.model,
    ...(accountLabel === null ? [] : [accountLabel]),
    `${runner.effort} effort`,
    ...(fellBackAfter === null ? [] : [fellBackAfter.trim().split("\n")[0]?.slice(0, 160) ?? ""]),
  ].join(" · ");

/**
 * Changes the thread's runner. Refused while the thread is in a turn. A change of harness or account forgets the
 * harness session, so the thread's next turn starts a new one with the conversation so far. The owner's change starts
 * no turn and leaves no line until one does (`recordPendingHandover`): a message waiting after a failed turn runs on the new runner when the owner retries or writes again. A
 * fallback (backups, rituals) passes the failure that caused it, which the line then gives after the new runner, and
 * runs the waiting messages at once.
 */
export const changeThreadRunner = (
  threadId: string,
  runner: Runner,
  {
    backups = null,
    fellBackAfter = null,
  }: { backups?: ReadonlyArray<BackupCompanion> | null; fellBackAfter?: string | null } = {},
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [thread] = yield* sql<{
      accountId: string | null;
      effort: string;
      harness: HarnessName;
      missionId: string;
      model: ModelChoice;
      state: string;
    }>`SELECT mission_id AS missionId, state, harness, account_id AS accountId, model, effort
      FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
    if (thread === undefined) return yield* notFound("No such thread.");
    if (thread.state === "Running" || thread.state === "Attention")
      return yield* invalid("This thread is in a turn. Interrupt or stop it, then change its harness or model.");
    yield* checkAccount(runner);
    // A chosen preset's backups replace the thread's in the same step, so a refusal leaves both as they were.
    if (backups !== null) yield* checkBackups(backups);
    // The owner's own choice of runner starts a thread's failure chain over (thread-panel, Backups).
    if (fellBackAfter === null) yield* sql`UPDATE threads SET backup_step = 0 WHERE id = ${threadId}`;
    if (backups !== null) yield* sql`UPDATE threads SET backups = ${JSON.stringify(backups)} WHERE id = ${threadId}`;
    const isNewSession = runner.harness !== thread.harness || runner.accountId !== thread.accountId;
    if (!isNewSession && runner.model === thread.model && runner.effort === thread.effort)
      return backups === null ? unchanged(null) : changed(null);
    const now = yield* Clock.currentTimeMillis;
    // The owner's change leaves no line yet: the runner it leaves is kept (the first one, across several changes), and
    // the line is written when a turn starts on the runner then chosen (`recordPendingHandover`). A fallback runs at
    // once, so its line is written now, and nothing is left pending.
    const from = JSON.stringify([thread.harness, thread.accountId, thread.model, thread.effort]);
    yield* sql`UPDATE threads SET harness = ${runner.harness}, account_id = ${runner.accountId}, model = ${runner.model},
      effort = ${runner.effort}${isNewSession ? sql`, session_id = NULL` : sql``},
      handover_from = ${fellBackAfter === null ? sql`COALESCE(handover_from, ${from})` : sql`NULL`} WHERE id = ${threadId}`;
    if (fellBackAfter !== null) yield* insertHandover(threadId, runner, fellBackAfter, now);
    // The owner's change waits for the owner: their next message, or Retry after a failed turn, runs on it. A
    // fallback after a failure runs the waiting messages on the new runner at once.
    return fellBackAfter === null ? changed(null) : changed(null, { threadsToWake: [threadId] });
  });

/** Writes one handover line for a runner, at the given time. */
const insertHandover = (threadId: string, runner: Runner, fellBackAfter: string | null, at: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [account] =
      runner.accountId === null
        ? []
        : yield* sql<{ label: string }>`SELECT label FROM accounts WHERE id = ${runner.accountId}`;
    yield* insertThreadLine(threadId, handoverTextOf(runner, account?.label ?? null, fellBackAfter), at);
  });

/**
 * Writes one line in the thread's conversation beside its handover lines, shown the same way: a handover, or a harness
 * session the thread lost (CHG-0208). Callers run it in a transaction.
 */
export const insertThreadLine = (threadId: string, text: string, at: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT INTO handovers (id, thread_id, text, at) VALUES (${crypto.randomUUID()}, ${threadId}, ${text}, ${at})`;
  });

/**
 * Called as a turn starts on the thread's current runner: when the owner changed the runner since the last turn,
 * writes one handover line for the runner that now runs, none when it is the one the thread last ran on, and
 * forgets the change. The line belongs to a run, not to each change of a picker.
 */
export const recordPendingHandover = (threadId: string, at: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [thread] = yield* sql<{
      accountId: string | null;
      effort: string;
      handoverFrom: string | null;
      harness: HarnessName;
      model: ModelChoice;
    }>`SELECT harness, account_id AS accountId, model, effort, handover_from AS handoverFrom FROM threads WHERE id = ${threadId}`;
    if (thread === undefined || thread.handoverFrom === null) return;
    yield* sql`UPDATE threads SET handover_from = NULL WHERE id = ${threadId}`;
    const current = JSON.stringify([thread.harness, thread.accountId, thread.model, thread.effort]);
    if (current === thread.handoverFrom) return;
    yield* insertHandover(
      threadId,
      {
        accountId: thread.accountId,
        effort: thread.effort as EffortChoice,
        harness: thread.harness,
        model: thread.model,
      },
      null,
      at,
    );
  });

/** The thread's handover lines, oldest first. */
export const listHandovers = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<{ at: number; id: string; text: string }>`
      SELECT id, text, at FROM handovers WHERE thread_id = ${threadId} ORDER BY at, rowid`;
  });

/**
 * The thread's conversation before this turn, to hand to a harness session that starts with none: the owner's
 * and threads' messages delivered to earlier turns and the thread's own replies, oldest first. The oldest are
 * left out, with a line saying how many, when they would take over half the model's context window
 * (provisional: summarizing the oldest part is staged). Null when there is no earlier conversation.
 */
export const readConversationSoFar = (threadId: string, turnId: string, model: ModelChoice) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{
      fromTitle: string | null;
      id: string;
      isResult: number;
      sender: "user" | "agent" | "thread";
      text: string;
    }>`
      SELECT m.id, m.sender_kind AS sender, COALESCE(s.title, m.sender_title) AS fromTitle, m.is_result AS isResult, m.text
      FROM messages m LEFT JOIN threads s ON s.id = m.sender_thread_id
      WHERE m.thread_id = ${threadId}
        AND (m.sender_kind = 'agent' OR (m.delivered_turn_id IS NOT NULL AND m.delivered_turn_id != ${turnId}))
      ORDER BY m.sequence`;
    if (rows.length === 0) return null;
    // An image is named, not resent: the replay is text.
    const attachments = yield* readStoredAttachments(rows.map((row) => row.id));
    const lines = rows.map((row) => {
      const speaker =
        row.sender === "agent"
          ? "You"
          : row.sender === "user"
            ? "The owner"
            : `${row.isResult ? "Result from thread" : "Thread"} "${row.fromTitle ?? "a thread"}"`;
      const images = (attachments.get(row.id) ?? []).map((file) => `image: ${file.name}`);
      return [`${speaker}: ${row.text}`, ...images].join("\n");
    });
    const allowance = Math.floor((contextWindowOf(model) * historyWindowPercent) / 100);
    let used = 0;
    let first = lines.length;
    while (first > 0 && used + tokensOf(lines[first - 1] ?? "") <= allowance) {
      first--;
      used += tokensOf(lines[first] ?? "");
    }
    const kept = lines.slice(first);
    return [
      "## Conversation so far",
      'This thread ran before in a harness session you do not have (on another harness, account, or model, or one that could not be resumed), and you now continue it. What follows is its conversation, oldest first, with you as "You". Carry on from it; do not repeat it.',
      ...(first > 0
        ? [
            `(${first} earlier ${first === 1 ? "message was" : "messages were"} left out because the conversation is long.)`,
          ]
        : []),
      kept.join("\n\n"),
    ].join("\n\n");
  });

/** The owner's choice of a thread's runner, with the backups of a preset when one is chosen. */
export const chooseThreadRunner = (change: {
  accountId: string | null;
  backups?: ReadonlyArray<BackupCompanion> | undefined;
  effort: EffortChoice;
  harness: HarnessName;
  model: ModelChoice;
  threadId: string;
}) =>
  changeThreadRunner(
    change.threadId,
    { accountId: change.accountId, effort: change.effort, harness: change.harness, model: change.model },
    { backups: change.backups ?? null },
  );
