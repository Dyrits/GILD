import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "../core/index.ts";

/** Prevents attachment to a hidden realm without the owner's explicit recovery choice. */
export const requireActiveRealm = Effect.fn("requireActiveRealm")(function* (workspaceId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [realm] = yield* sql<{ archivedAt: number | null }>`SELECT archived_at AS archivedAt
    FROM workspaces WHERE id = ${workspaceId}`;
  if (realm === undefined) return yield* invalid("No such realm.");
  if (realm.archivedAt !== null) return yield* invalid("Restore this archived realm before using it.");
});

/** Whether a quest's containing realm is archived, independent of a side-quest's own attachment. */
export const isQuestRealmArchived = Effect.fn("isQuestRealmArchived")(function* (missionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`SELECT w.id FROM missions m JOIN threads top ON top.id = m.top_thread_id
    JOIN workspaces w ON w.id = top.workspace_id WHERE m.id = ${missionId} AND w.archived_at IS NOT NULL`;
  return rows.length > 0;
});

/** Keeps an archived realm's quests dormant until the realm is explicitly restored. */
export const requireActiveQuestRealm = Effect.fn("requireActiveQuestRealm")(function* (missionId: string) {
  if (yield* isQuestRealmArchived(missionId))
    return yield* invalid("Restore this archived realm before continuing its quests.");
});
