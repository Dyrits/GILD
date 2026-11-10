import type { GuildmasterPlace } from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { changed, unchanged } from "./commands.ts";
import { invalid } from "./errors.ts";
import { insertMission, insertQuest } from "./missions.ts";
import { type Runner, runnerOf } from "./runners.ts";
import { readSettings } from "./settings.ts";
import type { ArgumentsOf, ToolAnswer } from "./threadTools.ts";
import { proposeTitle, titleOf } from "./titles.ts";

// The Guildmaster (quest coordination): one permanent thread the owner talks to, which looks for a quest that fits a
// request, offers to continue it, or opens a new one. It is stored as a hidden quest so its turns, messages, usage, and
// cards are the quests' own; every list, search, and ending leaves it out.

/** The Guildmaster's title, in its thread tree and its usage. */
export const guildmasterTitle = "Guildmaster";

/** How many quests the Guildmaster's dashboard text lists at most; the latest ones. */
const maxListedQuests = 60;

/** The Guildmaster's quest and thread, made on first use. Callers run it in a transaction. */
export const ensureGuildmaster = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [existing] = yield* sql<{ missionId: string; threadId: string }>`
    SELECT id AS missionId, top_thread_id AS threadId FROM missions WHERE is_guildmaster = 1`;
  if (existing !== undefined) return { ...existing, isCreated: false } as const;
  const settings = yield* readSettings;
  const started = yield* insertQuest(
    { firstMessage: null, isTitleByOwner: true, realm: null, shouldRememberChoices: false, title: guildmasterTitle },
    { effort: "default", harness: settings.defaultHarness, model: "default" },
    null,
  );
  yield* sql`UPDATE missions SET is_guildmaster = 1 WHERE id = ${started.missionId}`;
  return { isCreated: true, missionId: started.missionId, threadId: started.threadId } as const;
});

/** Where the Guildmaster's conversation is, made when it is not there yet. */
export const readGuildmaster = ensureGuildmaster.pipe(
  Effect.map(({ missionId, threadId }) => ({ missionId, threadId }) as GuildmasterPlace),
);

/** Whether the thread belongs to the Guildmaster. */
export const isGuildmasterThread = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`
      SELECT t.id FROM threads t JOIN missions m ON m.id = t.mission_id WHERE t.id = ${threadId} AND m.is_guildmaster = 1`;
    return rows.length > 0;
  });

/** Whether the quest is the Guildmaster's. */
export const isGuildmasterQuest = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`SELECT id FROM missions WHERE id = ${missionId} AND is_guildmaster = 1`;
    return rows.length > 0;
  });

/** Refuses to end, delete, or rename the Guildmaster's quest: it is permanent (quest coordination, Place). */
export const refuseGuildmaster = (missionId: string, action: string) =>
  Effect.gen(function* () {
    if (yield* isGuildmasterQuest(missionId))
      return yield* invalid(`The Guildmaster is permanent: it cannot be ${action}.`);
  });

/** A realm the owner or the Guildmaster named, by its folder or its name; null when none matches. */
export const findRealm = (given: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const wanted = given.trim();
    const [byPath] = yield* sql<{
      name: string;
      path: string;
    }>`SELECT name, path FROM workspaces WHERE path = ${wanted}`;
    if (byPath !== undefined) return byPath;
    const [byName] = yield* sql<{ name: string; path: string }>`
      SELECT name, path FROM workspaces WHERE lower(name) = lower(${wanted}) ORDER BY created_at LIMIT 1`;
    return byName ?? null;
  });

/** The realms known, one line each, so the Guildmaster can name one when it opens a quest. */
const realmLinesOf = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const realms = yield* sql<{ name: string; path: string }>`SELECT name, path FROM workspaces ORDER BY name`;
  return realms.length === 0
    ? ["No realm exists yet; a quest opens with no realm."]
    : realms.map((realm) => `- ${realm.name}: ${realm.path}`);
});

const firstSentenceOf = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  const end = flat.search(/[.!?](\s|$)/);
  return (end === -1 ? flat : flat.slice(0, end + 1)).slice(0, 240);
};

/**
 * What the Guildmaster's turn starts from besides its instructions: the realms, and the dashboard as text, one line
 * per quest that is not archived (quest coordination, Context). Built from stored data; the Guildmaster never keeps it.
 */
export const guildmasterContextOf = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{
    briefing: string | null;
    ending: string | null;
    id: string;
    lastActivityAt: number;
    opening: string | null;
    realm: string | null;
    title: string;
  }>`
    SELECT m.id, m.title, m.ending, m.last_activity_at AS lastActivityAt, j.briefing, w.name AS realm,
      (SELECT x.text FROM messages x WHERE x.thread_id = m.top_thread_id AND x.sender_kind = 'user'
        ORDER BY x.sequence LIMIT 1) AS opening
    FROM missions m
      JOIN threads top ON top.id = m.top_thread_id
      LEFT JOIN journals j ON j.mission_id = m.id
      LEFT JOIN workspaces w ON w.id = top.workspace_id
    WHERE m.is_guildmaster = 0 AND top.is_deleting = 0 AND (m.ending IS NULL OR m.ending = 'Done')
      AND NOT EXISTS (SELECT 1 FROM rituals r WHERE r.mission_id = m.id)
    ORDER BY m.last_activity_at DESC LIMIT ${maxListedQuests}`;
  const lines = rows.map((row) => {
    const about = firstSentenceOf(row.briefing?.trim() ? row.briefing : (row.opening ?? ""));
    const when = new Date(row.lastActivityAt).toISOString().slice(0, 16).replace("T", " ");
    return `- "${row.title}" (id ${row.id}) · ${row.ending ?? "Open"} · ${row.realm ?? "no realm"} · last active ${when} UTC${about === "" ? "" : ` · ${about}`}`;
  });
  return [
    "# Realms",
    ...(yield* realmLinesOf),
    "",
    "# Quests, latest first (this is the dashboard; look deeper with find_missions)",
    ...(lines.length === 0 ? ["No quest yet."] : lines),
  ].join("\n");
});

/** What `open_mission` came to: the new quest's top thread, or why it was refused. */
export type OpenedByGuildmaster =
  | { readonly _tag: "Opened"; readonly text: string; readonly threadId: string }
  | { readonly _tag: "Refused"; readonly reason: string };

/** A refused `open_mission`, which changes nothing. */
export const refusedOpening = (reason: string) => unchanged<OpenedByGuildmaster>({ _tag: "Refused", reason });

/**
 * Records the quest the Guildmaster opened or the owner's choice opened, in a realm or none, with the Guildmaster's
 * runner unless chosen. Callers run it in a transaction; the caller wakes the new top thread.
 */
export const openQuestFor = (
  guildmasterThreadId: string,
  quest: {
    readonly choice: Parameters<typeof runnerOf>[1];
    readonly realmPath: string | null;
    readonly request: string;
    readonly title: string | null;
  },
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [caller] = yield* sql<Runner>`
      SELECT harness, account_id AS accountId, model, effort FROM threads WHERE id = ${guildmasterThreadId}`;
    const base: Runner = caller ?? { accountId: null, effort: "default", harness: "claude", model: "default" };
    const runner = runnerOf(base, quest.choice);
    const started = yield* insertMission(quest.request, runner, quest.realmPath, false);
    if (quest.title !== null && titleOf(quest.title) !== "") yield* proposeTitle(started.missionId, quest.title);
    const [mission] = yield* sql<{ title: string }>`SELECT title FROM missions WHERE id = ${started.missionId}`;
    return { runner, started, title: mission?.title ?? titleOf(quest.request) };
  });

/**
 * `open_mission`: the Guildmaster opens a new quest with the request, in a realm it names or none, on its own runner
 * unless it chooses one. The owner sees it as a card with a link. Only the Guildmaster calls it.
 */
export const openMissionByGuildmaster = (callerId: string, args: ArgumentsOf<"open_mission">) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (!(yield* isGuildmasterThread(callerId))) return refusedOpening("Only the Guildmaster opens quests.");
    if (args.request.trim() === "") return refusedOpening("The request is empty.");
    const realm = args.realm === undefined || args.realm.trim() === "" ? null : yield* findRealm(args.realm);
    if (args.realm !== undefined && args.realm.trim() !== "" && realm === null)
      return refusedOpening(
        `Not opened: no realm "${args.realm}". Name one of the realms listed in your context, or leave it out.`,
      );
    const opened = yield* openQuestFor(callerId, {
      choice: { effort: args.effort, harness: args.harness, model: args.model },
      realmPath: realm?.path ?? null,
      request: args.request,
      title: args.title ?? null,
    });
    const [guildmaster] = yield* sql<{
      missionId: string;
    }>`SELECT mission_id AS missionId FROM threads WHERE id = ${callerId}`;
    const now = yield* Clock.currentTimeMillis;
    // The conversation shows the new quest as a card with a link, as it shows a resolved suggestion.
    yield* sql`INSERT INTO suggestions (id, mission_id, thread_id, text, title, matches, asked_at, outcome, is_automatic,
        target_mission_id, target_thread_id, target_title, resolved_at, realm_path)
      VALUES (${crypto.randomUUID()}, ${guildmaster?.missionId ?? ""}, ${callerId}, ${args.request}, ${opened.title}, '[]', ${now},
        'MovedToMission', 1, ${opened.started.missionId}, ${opened.started.threadId}, ${opened.title}, ${now}, ${realm?.path ?? null})`;
    const where = realm === null ? "with no realm" : `in the realm ${realm.name}`;
    return changed<OpenedByGuildmaster>(
      {
        _tag: "Opened",
        text: `Opened the quest "${opened.title}" (id ${opened.started.missionId}) ${where}, on ${opened.runner.harness}, model ${opened.runner.model}, effort ${opened.runner.effort}. Its top thread starts on the request at once. Tell the owner in a sentence what you opened and why; do not repeat the request.`,
        threadId: opened.started.threadId,
      },
      { threadsToWake: [opened.started.threadId] },
    );
  });

/** The answer `open_mission` gives the Guildmaster. */
export const openedAnswerOf = (opened: OpenedByGuildmaster): ToolAnswer =>
  opened._tag === "Opened" ? { isError: false, text: opened.text } : { isError: true, text: opened.reason };
