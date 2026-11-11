import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import { changed, unchanged } from "./commands.ts";
import { updateJournal } from "./journal.ts";
import { waitsInTurn } from "./lifecycle.ts";

// Quest moves (mission-tracking, Quest placement and moves): a quest's realm is its top thread's workspace, inherited
// by its side-quests, so a move rewrites that one column across the whole tree. Realm lore and standing permissions
// are keyed by the same id, so they follow the destination without being copied.

/**
 * Moves a quest, with every thread of its tree, to a realm or, with null, to the Borderlands. Refused for an unknown
 * quest or realm, and while any thread of the tree is in a turn: a move never stops threads. A move to where the quest
 * already is changes nothing.
 *
 * Threads keep their harness sessions: a resumed Claude Code session keeps its conversation and its cached prefix when
 * the folder changes (probe, 2026-11-11, Claude Code 2.1.322) and takes the new folder from the system part of the
 * turn. What the thread must learn, that it was moved and where it works now, goes into the journal, which every turn's
 * note carries. Files, branches, and own copies are not touched.
 */
export const moveQuest = Effect.fn("moveQuest")(function* (missionId: string, realmId: string | null) {
  const sql = yield* SqlClient.SqlClient;
  const [mission] = yield* sql<{ id: string }>`SELECT id FROM missions WHERE id = ${missionId}`;
  if (mission === undefined) return yield* notFound("No such quest.");
  const [destination] =
    realmId === null
      ? [{ name: null, path: null }]
      : yield* sql<{
          name: string | null;
          path: string | null;
        }>`SELECT name, path FROM workspaces WHERE id = ${realmId}`;
  if (destination === undefined) return yield* invalid("No such realm.");
  const [running] = yield* sql<{ count: number }>`SELECT COUNT(*) AS count FROM threads
    WHERE mission_id = ${missionId} AND (state = 'Running' OR ${sql.literal(waitsInTurn)})`;
  if ((running?.count ?? 0) > 0)
    return yield* invalid("A thread of this quest is at work. Stop it, then move the quest.");
  const [misplaced] = yield* sql<{ count: number }>`SELECT COUNT(*) AS count FROM threads
    WHERE mission_id = ${missionId} AND workspace_id IS NOT ${realmId}`;
  if ((misplaced?.count ?? 0) === 0) return unchanged(null);
  const [source] = yield* sql<{ name: string | null }>`SELECT w.name FROM missions m
    JOIN threads top ON top.id = m.top_thread_id LEFT JOIN workspaces w ON w.id = top.workspace_id
    WHERE m.id = ${missionId}`;
  yield* sql`UPDATE threads SET workspace_id = ${realmId} WHERE mission_id = ${missionId}`;
  const where = destination.path === null ? "no folder: it works in its own scratch folder" : destination.path;
  yield* updateJournal(
    missionId,
    { kind: "user" },
    `Moved by the user from ${source?.name ?? "the Borderlands"} to ${destination.name ?? "the Borderlands"} (${where}). Earlier messages may refer to the former place; the realm lore available now is the destination's.`,
    null,
  );
  return changed(null);
});
