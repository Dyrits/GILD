import { Effect } from "effect";
import { SqlClient } from "effect/sql";

// A mission's latest activity, which orders the dashboard and starts its inactivity period (mission-tracking).
// A leaf, so every module that records activity can import it without a module-load cycle.

/** Records a mission's latest activity. Callers run it in a transaction. */
export const touchMission = (missionId: string, now: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE missions SET last_activity_at = ${now} WHERE id = ${missionId}`;
  });
