import { type Mentionable, type MentionReference, mentionReferencesOf, mentionTokenOf } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { workedOutStateOf } from "./missionStates.ts";

// Quests, side-quests, and realms the owner names with `@` (thread-messaging, Who can message whom; CHG-0181): what the
// menu offers, the reference appended to the message the harness reads, and what a mention opens for the turn it reaches.

/** A thread of a quest not archived. */
interface ThreadRow {
  readonly id: string;
  readonly missionId: string;
  readonly parentId: string | null;
  readonly title: string;
}

/** The titles from a quest's top thread down to the thread, the top one being the quest's title. */
const trailOf = (thread: ThreadRow, byId: ReadonlyMap<string, ThreadRow>, questTitle: string) => {
  const titles: string[] = [];
  for (
    let at: ThreadRow | undefined = thread;
    at !== undefined;
    at = at.parentId === null ? void 0 : byId.get(at.parentId)
  ) {
    titles.unshift(at.parentId === null ? questTitle : at.title);
  }
  return titles;
};

/**
 * Every quest not archived with its side-quests beneath it, latest activity first, then every realm by name. Iskios's own
 * quest and threads being deleted are never offered.
 */
export const listMentionables = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const quests = yield* sql<{ id: string; title: string; realmName: string | null }>`
    SELECT m.id, m.title, w.name AS realmName FROM missions m
      JOIN threads top ON top.id = m.top_thread_id LEFT JOIN workspaces w ON w.id = top.workspace_id
    WHERE (m.ending IS NULL OR m.ending <> 'Archived') AND m.is_guildmaster = 0 AND top.is_deleting = 0
    ORDER BY m.last_activity_at DESC`;
  const threads = yield* sql<ThreadRow>`
    SELECT t.id, t.mission_id AS missionId, t.parent_id AS parentId, t.title FROM threads t
      JOIN missions m ON m.id = t.mission_id
    WHERE (m.ending IS NULL OR m.ending <> 'Archived') AND m.is_guildmaster = 0 AND t.is_deleting = 0
    ORDER BY t.rowid`;
  const realms = yield* sql<{ id: string; name: string; path: string | null }>`
    SELECT id, name, path FROM workspaces ORDER BY name COLLATE NOCASE`;
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  return [
    ...quests.flatMap(
      (quest): ReadonlyArray<Mentionable> => [
        { detail: quest.realmName, id: quest.id, kind: "quest", trail: [quest.title] },
        ...threads
          .filter((thread) => thread.missionId === quest.id && thread.parentId !== null)
          .map(
            (thread): Mentionable => ({
              detail: quest.realmName,
              id: thread.id,
              kind: "side-quest",
              trail: trailOf(thread, byId, quest.title),
            }),
          ),
      ],
    ),
    ...realms.map((realm): Mentionable => ({ detail: realm.path, id: realm.id, kind: "realm", trail: [realm.name] })),
  ];
});

/** A mentioned side-quest's thread, in a quest not archived; undefined when there is none. */
const readSideQuest = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ missionId: string; state: string }>`
      SELECT t.mission_id AS missionId, t.state FROM threads t JOIN missions m ON m.id = t.mission_id
      WHERE t.id = ${threadId} AND t.parent_id IS NOT NULL AND t.is_deleting = 0 AND m.is_guildmaster = 0
        AND (m.ending IS NULL OR m.ending <> 'Archived')`;
    return row;
  });

/** A quest not archived, nor Iskios's own, with its state and realm; empty when there is none. */
const readQuest = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{
      id: string;
      title: string;
      ending: string | null;
      states: string;
      topThreadId: string;
      workspaceName: string | null;
    }>`
      SELECT m.id, m.title, m.ending, m.top_thread_id AS topThreadId, w.name AS workspaceName,
        (SELECT group_concat(t.state) FROM threads t WHERE t.mission_id = m.id) AS states
      FROM missions m JOIN threads top ON top.id = m.top_thread_id LEFT JOIN workspaces w ON w.id = top.workspace_id
      WHERE m.id = ${missionId} AND m.is_guildmaster = 0 AND top.is_deleting = 0
        AND (m.ending IS NULL OR m.ending <> 'Archived')`;
    return rows.map((row) => ({ ...row, state: row.ending ?? workedOutStateOf(row.states.split(",")) }));
  });

/** What a reference names, as the receiving thread reads it, with the ids its tools take. */
const resolvedLineOf = (reference: MentionReference) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const token = mentionTokenOf(reference);
    if (reference.kind === "realm") {
      const [realm] = yield* sql<{ name: string; path: string | null }>`
        SELECT name, path FROM workspaces WHERE id = ${reference.id}`;
      if (realm === undefined) return `${token} = no realm has this id any more.`;
      return `${token} = Realm "${realm.name}" (id ${reference.id}, ${realm.path === null ? "tied to no folder" : `folder ${realm.path}`}).`;
    }
    const sideQuest = reference.kind === "side-quest" ? yield* readSideQuest(reference.id) : void 0;
    const missionId = reference.kind === "quest" ? reference.id : (sideQuest?.missionId ?? null);
    const [quest] = missionId === null ? [] : yield* readQuest(missionId);
    if (quest === undefined) return `${token} = no open ${reference.kind} has this id: it was archived or deleted.`;
    const realm = quest.workspaceName === null ? "the Borderlands" : `realm ${quest.workspaceName}`;
    if (sideQuest === undefined)
      return `${token} = Quest "${quest.title}" (id ${quest.id}, state ${quest.state}, ${realm}, top thread id ${quest.topThreadId}). This turn you may read its journal with read_journal (mission ${quest.id}) and message its top thread with send_thread_message.`;
    const [thread] = yield* sql<{ title: string }>`SELECT title FROM threads WHERE id = ${reference.id}`;
    return `${token} = Side-quest "${thread?.title ?? ""}" of quest "${quest.title}" (thread id ${reference.id}, state ${sideQuest.state}, quest id ${quest.id}, ${realm}). This turn you may read its quest's journal with read_journal (mission ${quest.id}) and message it with send_thread_message.`;
  });

/**
 * What the owner's message tells its receiving thread about the quests, side-quests, and realms it mentions: a block
 * appended after the owner's own words, which stay as typed; empty when it mentions none.
 */
export const mentionNoteOf = (text: string) =>
  Effect.gen(function* () {
    const references = mentionReferencesOf(text);
    if (references.length === 0) return "";
    const lines = yield* Effect.forEach(references, resolvedLineOf);
    return `\n\n[The owner mentioned these with @, as context: decide from their words whether to look at each or write to it.\n${lines.join("\n")}]`;
  });

/** What a thread may reach beyond its tree during its current turn, from what was delivered to that turn. */
export interface TurnReach {
  /** Threads it may message: the top thread of a mentioned quest, a mentioned side-quest, and a thread that wrote to it. */
  readonly reachable: ReadonlySet<string>;
  /** Quests whose journal it may read: those the owner mentioned, or whose side-quest the owner mentioned. */
  readonly readable: ReadonlySet<string>;
}

/**
 * What the owner's mentions and the thread messages delivered into the thread's latest turn open to it (CHG-0181). A
 * mention lasts for the turn it reached: the next turn starts with nothing beyond the tree unless mentioned again. A
 * thread that wrote to it in this turn can be answered, so a reply comes straight back.
 */
export const readTurnReach = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // A sender being deleted can no longer be answered.
    const delivered = yield* sql<{ text: string; senderKind: string; fromThreadId: string | null }>`
      SELECT m.text, m.sender_kind AS senderKind, s.id AS fromThreadId FROM messages m
        LEFT JOIN threads s ON s.id = m.sender_thread_id AND s.is_deleting = 0
      WHERE m.thread_id = ${threadId} AND m.sender_kind IN ('user', 'thread') AND m.delivered_turn_id = (
        SELECT t.id FROM turns t WHERE t.thread_id = ${threadId} ORDER BY t.started_at DESC, t.rowid DESC LIMIT 1)`;
    const readable = new Set<string>();
    const reachable = new Set<string>();
    for (const message of delivered) {
      if (message.senderKind === "thread" && message.fromThreadId !== null) reachable.add(message.fromThreadId);
      if (message.senderKind !== "user") continue;
      for (const reference of mentionReferencesOf(message.text)) {
        if (reference.kind === "quest") {
          const [quest] = yield* readQuest(reference.id);
          if (quest === undefined) continue;
          readable.add(reference.id);
          reachable.add(quest.topThreadId);
        } else if (reference.kind === "side-quest") {
          const sideQuest = yield* readSideQuest(reference.id);
          if (sideQuest === undefined) continue;
          readable.add(sideQuest.missionId);
          reachable.add(reference.id);
        }
      }
    }
    reachable.delete(threadId);
    return { reachable, readable } satisfies TurnReach;
  });
