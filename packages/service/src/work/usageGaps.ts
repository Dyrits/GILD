import type { UsageFilter } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { arePlaceFilters, messageColumns, questJoinsOf, turnColumns, type UsageBounds, whereOf } from "./usageScope.ts";

// What the usage page counts beside the turns' usage (budget-control, Reserves usage page): the messages sent and replies
// completed, and the finished turns that left no usage. Neither belongs to a harness, model, or account the way usage
// does, so under such a filter they are not counted, and the page says so.

/**
 * Messages sent and replies completed in the period, in the quests the filters select; null when a filter hides which
 * they were. A Ritual's scheduled run is no message the owner sent, so it is not counted; one run by hand is.
 */
export const readMessages = (bounds: UsageBounds, filters: ReadonlyArray<UsageFilter>) =>
  Effect.gen(function* () {
    if (!arePlaceFilters(filters)) return null;
    const sql = yield* SqlClient.SqlClient;
    const where = whereOf(bounds, messageColumns, filters);
    const [row] = yield* sql.unsafe<{ assistant: number; user: number }>(
      `SELECT COALESCE(SUM(CASE WHEN x.sender_kind = 'user' AND instr(x.text, 'Ritual · scheduled') != 1 THEN 1 ELSE 0 END), 0) AS user,
        COALESCE(SUM(CASE WHEN x.sender_kind = 'agent' THEN 1 ELSE 0 END), 0) AS assistant
       FROM messages x ${questJoinsOf(messageColumns.mission)}
       WHERE ${where.text}`,
      where.params,
    );
    return { assistant: row?.assistant ?? 0, user: row?.user ?? 0 };
  });

/** Finished turns that left no usage record; null when a filter hides which they were. */
export const readTurnsWithoutUsage = (bounds: UsageBounds, filters: ReadonlyArray<UsageFilter>) =>
  Effect.gen(function* () {
    if (!arePlaceFilters(filters)) return null;
    const sql = yield* SqlClient.SqlClient;
    const where = whereOf(bounds, turnColumns, filters, [
      "t.status IN ('completed', 'interrupted')",
      "NOT EXISTS (SELECT 1 FROM usage x WHERE x.turn_id = t.id)",
    ]);
    const [row] = yield* sql.unsafe<{ count: number }>(
      `SELECT COUNT(*) AS count FROM turns t
       LEFT JOIN threads th ON th.id = t.thread_id ${questJoinsOf(turnColumns.mission)}
       WHERE ${where.text}`,
      where.params,
    );
    return row?.count ?? 0;
  });
