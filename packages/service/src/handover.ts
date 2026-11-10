import type { HarnessName, ModelChoice } from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { changed, unchanged } from "./commands.ts";
import { invalid, notFound } from "./errors.ts";
import { harnessLabels } from "./harnessCatalog.ts";
import { tokensOf } from "./journal.ts";
import { contextWindowOf } from "./lore.ts";
import { checkAccount, type Runner } from "./runners.ts";

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
 * harness session, so the thread's next turn starts a new one with the conversation so far; a message already
 * waiting for the thread runs on the new runner at once. A Ritual's fallback (rituals) passes the failure that caused it,
 * which the line then gives after the new runner.
 */
export const changeThreadRunner = (threadId: string, runner: Runner, fellBackAfter: string | null = null) =>
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
    const isNewSession = runner.harness !== thread.harness || runner.accountId !== thread.accountId;
    if (!isNewSession && runner.model === thread.model && runner.effort === thread.effort) return unchanged(null);
    const now = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE threads SET harness = ${runner.harness}, account_id = ${runner.accountId}, model = ${runner.model},
      effort = ${runner.effort}${isNewSession ? sql`, session_id = NULL` : sql``} WHERE id = ${threadId}`;
    const [account] =
      runner.accountId === null
        ? []
        : yield* sql<{ label: string }>`SELECT label FROM accounts WHERE id = ${runner.accountId}`;
    yield* sql`INSERT INTO handovers (id, thread_id, text, at)
      VALUES (${crypto.randomUUID()}, ${threadId}, ${handoverTextOf(runner, account?.label ?? null, fellBackAfter)}, ${now})`;
    return changed(null, { threadsToWake: [threadId] });
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
      isResult: number;
      sender: "user" | "agent" | "thread";
      text: string;
    }>`
      SELECT m.sender_kind AS sender, COALESCE(s.title, m.sender_title) AS fromTitle, m.is_result AS isResult, m.text
      FROM messages m LEFT JOIN threads s ON s.id = m.sender_thread_id
      WHERE m.thread_id = ${threadId}
        AND (m.sender_kind = 'agent' OR (m.delivered_turn_id IS NOT NULL AND m.delivered_turn_id != ${turnId}))
      ORDER BY m.sequence`;
    if (rows.length === 0) return null;
    const lines = rows.map((row) => {
      const speaker =
        row.sender === "agent"
          ? "You"
          : row.sender === "user"
            ? "The owner"
            : `${row.isResult ? "Result from thread" : "Thread"} "${row.fromTitle ?? "a thread"}"`;
      return `${speaker}: ${row.text}`;
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
      'This thread ran on another harness, account, or model before, and you now continue it. What follows is its conversation, oldest first, with you as "You". Carry on from it; do not repeat it.',
      ...(first > 0
        ? [
            `(${first} earlier ${first === 1 ? "message was" : "messages were"} left out because the conversation is long.)`,
          ]
        : []),
      kept.join("\n\n"),
    ].join("\n\n");
  });
