import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { waitsInTurn } from "./lifecycle.ts";

/** At most this many threads run at once in a mission (thread-tree, Limits; CHG-0037). */
export const maxRunning = 8;

/** How many levels a thread is beneath its mission's top thread, which is 0. */
export const depthOf = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ depth: number }>`
      WITH RECURSIVE ancestors(id, parent_id, depth) AS (
        SELECT id, parent_id, 0 FROM threads WHERE id = ${threadId}
        UNION ALL
        SELECT child.id, child.parent_id, ancestor.depth + 1 FROM threads child JOIN ancestors ancestor ON child.id = ancestor.parent_id
      )
      SELECT MAX(depth) AS depth FROM ancestors`;
    return row?.depth ?? 0;
  });

/**
 * How many of the mission's threads are inside a turn: Running, or in Attention on a question asked during it, whose harness process still runs (thread-tree, Limits).
 */
export const runningCountOf = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ count: number }>`
      SELECT COUNT(*) AS count FROM threads
      WHERE mission_id = ${missionId} AND (state = 'Running' OR ${sql.literal(waitsInTurn)})`;
    return row?.count ?? 0;
  });
