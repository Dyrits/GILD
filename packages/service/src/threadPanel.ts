import type { ContextGauge, ContextPart, ThreadPanel } from "@gild/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "./errors.ts";
import { contextWindowOf } from "./lore.ts";
import { missionLimitsOf, missionSpendingOf, spendingColumns } from "./spending.ts";
import { readSentContextSize } from "./startingContext.ts";

// What the thread panel shows beyond the thread itself (thread-panel).

/**
 * Splits a reported total over the counted parts. Counted parts are estimates: when they exceed the total
 * they are scaled down to fit, and the remainder, which is never negative, is the tools and their results.
 */
export const contextPartsOf = (
  total: number,
  counted: ReadonlyArray<Pick<ContextPart, "kind" | "tokens">>,
): ReadonlyArray<ContextPart> => {
  const countedSum = counted.reduce((sum, part) => sum + part.tokens, 0);
  const scale = countedSum > total ? total / countedSum : 1;
  const parts = counted.map((part) => ({ kind: part.kind, tokens: Math.floor(part.tokens * scale) }));
  const known = parts.reduce((sum, part) => sum + part.tokens, 0);
  return [...parts, { kind: "ToolsAndResults", tokens: total - known }];
};

/** The context gauge of a thread, or null while no turn has reported its context. */
const readContextGauge = (threadId: string, model: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // The latest turn that reported one, not a sum over turns: the context is what the window holds now.
    const [latest] = yield* sql<{ context: number }>`
      SELECT context FROM usage WHERE thread_id = ${threadId} AND context IS NOT NULL
      ORDER BY ended_at DESC, rowid DESC LIMIT 1`;
    if (latest === undefined) return null;
    const sent = yield* readSentContextSize(threadId);
    const [{ messageText } = { messageText: 0 }] = yield* sql<{ messageText: number }>`
      SELECT COALESCE(SUM(LENGTH(text)), 0) AS messageText FROM messages WHERE thread_id = ${threadId}`;
    return {
      parts: contextPartsOf(latest.context, [
        { kind: "Instructions", tokens: sent.instructions },
        { kind: "Lore", tokens: sent.lore },
        { kind: "Journal", tokens: sent.journal },
        { kind: "Messages", tokens: sent.openerMessages + Math.ceil(messageText / 4) },
      ]),
      tokens: latest.context,
      windowTokens: contextWindowOf(model),
    } satisfies ContextGauge;
  });

/** What the panel shows of a thread: its context gauge, its own spending, and its quest's budget. */
export const readThreadPanel = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [thread] = yield* sql<{ missionId: string; model: string }>`
      SELECT mission_id AS missionId, model FROM threads WHERE id = ${threadId}`;
    if (thread === undefined) return yield* notFound("No such thread.");
    const [spent] = yield* sql<{ cost: number; tokens: number; turnCount: number }>`
      SELECT ${sql.literal(spendingColumns)}, COUNT(*) AS turnCount FROM usage u WHERE u.thread_id = ${threadId}`;
    return {
      budget: { limits: yield* missionLimitsOf(thread.missionId), spent: yield* missionSpendingOf(thread.missionId) },
      context: yield* readContextGauge(threadId, thread.model),
      spending: { cost: spent?.cost ?? 0, tokens: spent?.tokens ?? 0 },
      turnCount: spent?.turnCount ?? 0,
    } satisfies ThreadPanel;
  });
