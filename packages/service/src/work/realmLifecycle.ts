import { createHash } from "node:crypto";
import type {
  MissionId,
  RealmArchivePreview,
  RealmArchiveQuest,
  RestoreRealm,
  RitualId,
  WorkspaceId,
} from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound, realFolderOf, ServiceFailure } from "../core/index.ts";
import { deleteLoreEntryByOwner } from "../lore/index.ts";
import { changed } from "./commands.ts";
import { endMission, readWorkingIds } from "./ending.ts";
import { updateJournal } from "./journal.ts";
import { haltThreads } from "./lifecycle.ts";
import { moveQuest } from "./questMoves.ts";
import { validateRealmName } from "./realmNames.ts";
import { crestOfRow, renameRealm, setRealmCrest } from "./workspaces.ts";

/** The complete realm state covered by a confirmation, including lore identity rather than only a count. */
export const previewRealmArchive = Effect.fn("previewRealmArchive")(function* (workspaceId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [realm] = yield* sql<{
    id: WorkspaceId;
    name: string;
    path: string | null;
    crest: string | null;
    archivedAt: number | null;
  }>`SELECT id, name, path, crest, archived_at AS archivedAt FROM workspaces WHERE id = ${workspaceId}`;
  if (realm === undefined) return yield* notFound("No such realm.");
  // A Ritual's quest is one of the realm's missions but not one of its quests: the archive switches the Ritual off.
  const missions = yield* sql<{ id: string; title: string; ending: string | null; isRitual: number }>`
    SELECT m.id, m.title, m.ending, EXISTS (SELECT 1 FROM rituals r WHERE r.mission_id = m.id) AS isRitual
    FROM missions m JOIN threads top ON top.id = m.top_thread_id
    WHERE top.workspace_id = ${workspaceId} AND m.is_guildmaster = 0 ORDER BY m.id`;
  const rituals = yield* sql<{ id: RitualId; title: string; isOn: number }>`SELECT r.id, m.title, r.is_on AS isOn
    FROM rituals r JOIN missions m ON m.id = r.mission_id JOIN threads top ON top.id = m.top_thread_id
    WHERE top.workspace_id = ${workspaceId} ORDER BY r.id`;
  const lore = yield* sql<{ id: string; text: string; updatedAt: number }>`SELECT id, text, updated_at AS updatedAt
    FROM intels WHERE scope = 'Workspace' AND workspace_id = ${workspaceId} ORDER BY id`;
  const threads = yield* sql`SELECT t.id, t.parent_id, t.state, t.generation, t.workspace_id FROM threads t
    JOIN missions m ON m.id = t.mission_id JOIN threads top ON top.id = m.top_thread_id
    WHERE top.workspace_id = ${workspaceId} AND m.is_guildmaster = 0 ORDER BY t.id`;
  const working: string[] = [];
  const quests: RealmArchiveQuest[] = [];
  for (const mission of missions) {
    const ids = yield* readWorkingIds(mission.id);
    working.push(...ids);
    if (mission.isRitual === 0 && mission.ending !== "Archived")
      quests.push({ id: mission.id as MissionId, isWorking: ids.length > 0, title: mission.title });
  }
  // Even an idle descendant waiting for a running slot changes what the owner is archiving.
  const snapshot = createHash("sha256")
    .update(JSON.stringify({ lore, missions, realm, rituals, threads, working }))
    .digest("hex");
  return {
    archivedAt: realm.archivedAt,
    loreCount: lore.length,
    questCount: missions.filter((mission) => mission.isRitual === 0).length,
    quests,
    realm: { crest: crestOfRow(realm.crest), id: realm.id, name: realm.name, path: realm.path },
    rituals: rituals.map((ritual) => ({ id: ritual.id, isOn: ritual.isOn === 1, title: ritual.title })),
    snapshot,
    workingCount: working.length,
  } satisfies RealmArchivePreview;
});

/** Archived realms remain discoverable even when they contain no quests. */
export const listArchivedRealms = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE archived_at IS NOT NULL ORDER BY name`;
  return yield* Effect.forEach(rows, (row) => previewRealmArchive(row.id));
});

/** Matches the canonical folder without reviving the archived realm as a side effect. */
export const findArchivedRealm = Effect.fn("findArchivedRealm")(function* (path: string) {
  const sql = yield* SqlClient.SqlClient;
  const folder = yield* realFolderOf(path);
  if (folder === null) return yield* invalid(`No folder at ${path}.`);
  const [row] = yield* sql<{ id: string }>`SELECT id FROM workspaces
    WHERE path = ${folder} AND archived_at IS NOT NULL`;
  return row === undefined ? null : yield* previewRealmArchive(row.id);
});

const requireSnapshot = Effect.fn("requireRealmSnapshot")(function* (workspaceId: string, snapshot: string) {
  const current = yield* previewRealmArchive(workspaceId);
  if (snapshot !== current.snapshot)
    return yield* new ServiceFailure({
      kind: "StaleVersion",
      message: "The realm changed. Review it again before continuing.",
    });
  return current;
});

/**
 * Archives the realm in one transaction: the quests the owner chose go to the Borderlands, every other quest is
 * archived, and the Rituals are switched off and stopped, then the turns at work are cancelled. Quests at work
 * cannot be chosen, since a move never stops threads.
 */
export const archiveRealm = Effect.fn("archiveRealm")(function* (
  workspaceId: string,
  snapshot: string,
  movedQuestIds: ReadonlyArray<string> = [],
) {
  const current = yield* requireSnapshot(workspaceId, snapshot);
  if (current.archivedAt !== null) return yield* invalid("This realm is already archived.");
  const sql = yield* SqlClient.SqlClient;
  const moved = new Set(movedQuestIds);
  for (const id of moved) {
    const quest = current.quests.find((each) => each.id === id);
    if (quest === undefined)
      return yield* invalid("Only an active quest of this realm can be moved to the Borderlands.");
    if (quest.isWorking)
      return yield* invalid(`"${quest.title}" is at work. Stop it first, or leave it to be archived with the realm.`);
  }
  const turnsToCancel: string[] = [];
  const threadsToWake: string[] = [];
  for (const id of moved) {
    const move = yield* moveQuest(id, null);
    threadsToWake.push(...move.followUps.threadsToWake);
  }
  const quests = yield* sql<{ id: string; ending: string | null }>`SELECT m.id, m.ending FROM missions m
    JOIN threads top ON top.id = m.top_thread_id WHERE top.workspace_id = ${workspaceId} AND m.is_guildmaster = 0
    AND NOT EXISTS (SELECT 1 FROM rituals r WHERE r.mission_id = m.id)`;
  for (const quest of quests) {
    if (quest.ending === "Archived") continue;
    yield* sql`INSERT INTO realm_archived_quests (workspace_id, mission_id, previous_ending)
      VALUES (${workspaceId}, ${quest.id}, ${quest.ending})`;
    const ids = yield* readWorkingIds(quest.id);
    const ended = yield* endMission(quest.id, "Archived", JSON.stringify(ids));
    turnsToCancel.push(...ended.followUps.turnsToCancel);
  }
  // A Ritual stays in the Rituals, off, with its instruction and history; a run underway is stopped.
  const ritualMissions = yield* sql<{ id: string }>`SELECT r.mission_id AS id FROM rituals r
    JOIN missions m ON m.id = r.mission_id JOIN threads top ON top.id = m.top_thread_id
    WHERE top.workspace_id = ${workspaceId}`;
  for (const { id } of ritualMissions) {
    const ids = yield* readWorkingIds(id);
    yield* haltThreads(ids, "Stopped");
    turnsToCancel.push(...ids);
    yield* sql`UPDATE rituals SET is_on = 0, next_run_at = NULL WHERE mission_id = ${id}`;
  }
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE workspaces SET archived_at = ${now} WHERE id = ${workspaceId}`;
  return changed(null, { threadsToWake, turnsToCancel });
});

/** Recovers the same realm, optionally clearing only its lore and keeping all old quests archived. */
export const restoreRealm = Effect.fn("restoreRealm")(function* (given: typeof RestoreRealm.Type) {
  const current = yield* requireSnapshot(given.workspaceId, given.snapshot);
  if (current.archivedAt === null) return yield* invalid("This realm is not archived.");
  const sql = yield* SqlClient.SqlClient;
  yield* validateRealmName(
    given.appearance?.name ?? current.realm.name,
    given.workspaceId,
    given.allowDuplicateName ?? false,
  );
  if (given.appearance !== null) {
    yield* renameRealm(current.realm.id, given.appearance.name, given.allowDuplicateName ?? false);
    yield* setRealmCrest(current.realm.id, given.appearance.crest);
  }
  if (given.shouldStartAfresh) {
    const lore = yield* sql<{ id: string }>`SELECT id FROM intels
      WHERE scope = 'Workspace' AND workspace_id = ${given.workspaceId}`;
    for (const entry of lore) yield* deleteLoreEntryByOwner(entry.id);
  } else {
    const quests = yield* sql<{ id: string; ending: string | null }>`SELECT a.mission_id AS id,
      a.previous_ending AS ending FROM realm_archived_quests a
      JOIN missions m ON m.id = a.mission_id JOIN threads top ON top.id = m.top_thread_id
      WHERE a.workspace_id = ${given.workspaceId} AND top.workspace_id = ${given.workspaceId}`;
    for (const quest of quests) {
      yield* sql`UPDATE missions SET ending = ${quest.ending} WHERE id = ${quest.id}`;
      yield* updateJournal(quest.id, { kind: "user" }, "Reopened with the realm by the user", null);
    }
  }
  yield* sql`DELETE FROM realm_archived_quests WHERE workspace_id = ${given.workspaceId}`;
  yield* sql`UPDATE workspaces SET archived_at = NULL WHERE id = ${given.workspaceId}`;
  return changed(null);
});
