import type { GuildHallRecap, MissionId } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { consumptionColumns, dayMillis } from "../core/index.ts";
import { unchanged } from "./commands.ts";
import { type ConsumptionRow, consumptionOf } from "./consumption.ts";

// The Guild Hall hub's recap (quest coordination, Guild Hall as a hub): what happened since the owner's last visit.
// Recent activity and what waits for the owner come from the quest list the app already reads.

/** The settings-table key holding when the owner last visited the Guild Hall, in milliseconds. */
const visitKey = "guildHallVisitedAt";

/** How many finished quests the recap names; it counts them all. */
const maxFinishedListed = 5;

/** When the owner last visited the Guild Hall, or null before the first visit. */
const readLastVisit = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ value: string }>`SELECT value FROM settings WHERE key = ${visitKey}`;
  const at = row === undefined ? Number.NaN : Number(row.value);
  return Number.isFinite(at) ? at : null;
});

/**
 * The recap from `since`, or from the last visit when null, and from 24 hours ago at the first visit. The screen sends
 * the start back on later reads, so the period stays fixed while the owner is at the Guild Hall.
 */
export const readGuildHallRecap = (given: number | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const lastVisit = given === null ? yield* readLastVisit : null;
    const since = given ?? lastVisit ?? now - dayMillis;
    // The Guild Hall's own quest and the Rituals' quests are no finished quests: a Ritual's quest never ends.
    const finished = yield* sql<{ missionId: MissionId; title: string }>`
      SELECT id AS missionId, title FROM missions
      WHERE is_guildmaster = 0 AND ending = 'Done' AND done_at >= ${since} ORDER BY done_at DESC`;
    const [used] = yield* sql<ConsumptionRow>`
      SELECT ${sql.literal(consumptionColumns)} FROM usage u WHERE u.ended_at >= ${since}`;
    // Each run sends its Ritual's quest a message that starts with "Ritual · " (see `beginRun`).
    const [runs] = yield* sql<{ count: number }>`
      SELECT COUNT(*) AS count FROM messages m JOIN rituals r ON r.mission_id = m.mission_id
      WHERE m.sent_at >= ${since} AND m.sender_kind = 'user' AND instr(m.text, 'Ritual · ') = 1`;
    return {
      consumption: consumptionOf(used as ConsumptionRow),
      finished: finished.slice(0, maxFinishedListed),
      finishedCount: finished.length,
      isFirstVisit: given === null ? lastVisit === null : false,
      ritualRuns: runs?.count ?? 0,
      since,
    } satisfies GuildHallRecap;
  });

/** Records that the owner is at the Guild Hall now. Nothing the owner sees changes. */
export const visitGuildHall = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  yield* sql`INSERT INTO settings (key, value) VALUES (${visitKey}, ${String(now)})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
  return unchanged(null);
});
