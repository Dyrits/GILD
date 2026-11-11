import type { Consumption } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { consumptionColumns } from "../core/index.ts";

// What turns used, shown rather than counted (budget-control, Estimated cost): the one read model behind the quest card,
// the quest and thread panels, the dashboard row, and the budget window, so a figure cannot differ between screens.

/** The columns `consumptionColumns` selects, as a row. */
export interface ConsumptionRow {
  readonly cacheCreation: number;
  readonly cacheRead: number;
  readonly earlierTurns: number;
  readonly estimated: number;
  readonly input: number;
  readonly output: number;
  readonly reported: number;
  readonly turns: number;
  readonly unpricedTurns: number;
}

/** A consumption read from a row of `consumptionColumns`. */
export const consumptionOf = (row: ConsumptionRow): Consumption => ({
  earlierTurns: row.earlierTurns,
  estimated: row.estimated,
  reported: row.reported,
  tokens: { cacheCreation: row.cacheCreation, cacheRead: row.cacheRead, input: row.input, output: row.output },
  turns: row.turns,
  unpricedTurns: row.unpricedTurns,
});

/** What the turns of one thread used. */
export const readThreadConsumption = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<ConsumptionRow>`
      SELECT ${sql.literal(consumptionColumns)} FROM usage u WHERE u.thread_id = ${threadId}`;
    return consumptionOf(row as ConsumptionRow);
  });
