import type { AccountId, GuildmasterPlace, HarnessName, MissionSummary, ModelChoice, Viewing } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, readSettings, type ToolAnswer } from "../core/index.ts";
import { claudeCheapestModel } from "../harness/index.ts";
import { changed, unchanged } from "./commands.ts";
import { endMission, previewEnding, readWorkingIds } from "./ending.ts";
import { companionLineOf, ritualStartOf } from "./guildmasterCompanions.ts";
import { consumeReceipt, isStructuralCaller, notAuthorizedText } from "./guildmasterProvenance.ts";
import { timeOf } from "./journal.ts";
import { insertMessage } from "./messaging.ts";
import { insertQuest, listMissionSummaries } from "./missions.ts";
import { createRitual } from "./rituals.ts";
import type { ArgumentsOf } from "./threadTools.ts";
import { renameMission, titleOf } from "./titles.ts";

// Iskios, once the Guildmaster (quest coordination): one permanent thread the owner talks to, which looks for a quest
// that fits a request and offers to continue it, or proposes a new one for the owner to open. It is stored as a hidden
// quest so its turns, messages, usage, and cards are the quests' own; every list, search, and ending leaves it out.

/** Iskios's title, in its thread tree and its usage; data made as Guildmaster is renamed by migration 0041. */
export const guildmasterTitle = "Iskios";

/** How many quests the Guildmaster's dashboard text lists at most; the latest ones. */
const maxListedQuests = 60;

/**
 * The cheapest model Iskios knows for a harness, which the Guildmaster starts on: it only routes. Codex and OpenCode list
 * their models only by running, so they start on their own default; the owner can hand it over at any time.
 */
const cheapestModelOf = (harness: HarnessName): ModelChoice => (harness === "claude" ? claudeCheapestModel : "default");

/** The Guildmaster's quest and thread, made on first use. Callers run it in a transaction. */
export const ensureGuildmaster = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [existing] = yield* sql<{ missionId: string; threadId: string }>`
    SELECT id AS missionId, top_thread_id AS threadId FROM missions WHERE is_guildmaster = 1`;
  if (existing !== undefined) return { ...existing, isCreated: false } as const;
  const settings = yield* readSettings;
  const started = yield* insertQuest(
    { firstMessage: null, isTitleByOwner: true, realm: null, shouldRememberChoices: false, title: guildmasterTitle },
    { effort: "default", harness: settings.defaultHarness, model: cheapestModelOf(settings.defaultHarness) },
    null,
  );
  // The default quest budget is for quests; the Guildmaster's own is the owner's to set (budget-control).
  yield* sql`UPDATE missions SET is_guildmaster = 1, budget_cost = NULL, budget_tokens = NULL WHERE id = ${started.missionId}`;
  return { isCreated: true, missionId: started.missionId, threadId: started.threadId } as const;
});

/** Where the Guildmaster's conversation is, made when it is not there yet. */
export const readGuildmaster = ensureGuildmaster.pipe(
  // Only making the place announces a change: a read that always did made every screen that follows changes reload
  // it at once, a loop that froze the Guild Hall.
  Effect.map(({ isCreated, missionId, threadId }) => {
    const place = { missionId, threadId } as GuildmasterPlace;
    return isCreated ? changed(place) : unchanged(place);
  }),
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

/**
 * The line Iskios reads with a message, saying where the owner had Iskios open from: the quest when the screen is one
 * (named from the stored title, not the app's), else the screen's name. Null for a message to any other thread.
 */
export const viewingLineOf = (threadId: string, viewing: Viewing | null | undefined) =>
  Effect.gen(function* () {
    if (viewing === null || viewing === undefined || !(yield* isGuildmasterThread(threadId))) return null;
    const sql = yield* SqlClient.SqlClient;
    const [quest] =
      viewing.missionId === null || viewing.missionId === undefined
        ? []
        : yield* sql<{ id: string; title: string }>`
            SELECT id, title FROM missions WHERE id = ${viewing.missionId} AND is_guildmaster = 0`;
    // The screen's name is the app's words: kept to one plain line, so it cannot pose as an instruction.
    const screen = viewing.screen
      .replace(/[[\]"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return quest === undefined
      ? screen === ""
        ? null
        : `the ${screen} screen`
      : `the quest "${quest.title}" (id ${quest.id})`;
  });

/** Refuses to end, delete, or rename the Guildmaster's quest: it is permanent (quest coordination, Place). */
export const refuseGuildmaster = (missionId: string, action: string) =>
  Effect.gen(function* () {
    if (yield* isGuildmasterQuest(missionId)) return yield* invalid(`Iskios is permanent: it cannot be ${action}.`);
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
      SELECT name, path FROM workspaces WHERE lower(name) = lower(${wanted}) AND path IS NOT NULL
      ORDER BY created_at LIMIT 1`;
    return byName ?? null;
  });

/** The realms known, one line each, so the Guildmaster can name one when it proposes a quest or manages a realm. */
const realmLinesOf = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  // A quest is placed by its realm's folder, so a realm tied to no folder cannot hold a proposed quest yet (CHG-0161,
  // decision record 0015); it is listed for the realm tools, and marked.
  const realms = yield* sql<{ name: string; path: string | null }>`
    SELECT name, path FROM workspaces ORDER BY name`;
  return realms.length === 0
    ? ["No realm exists yet; a quest opens with no realm."]
    : realms.map((realm) =>
        realm.path === null
          ? `- ${realm.name}: tied to no folder (a quest cannot be proposed in it from here yet)`
          : `- ${realm.name}: ${realm.path}`,
      );
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
    id: string;
    lastActivityAt: number;
    opening: string | null;
    realm: string | null;
    title: string;
  }>`
    SELECT m.id, m.title, m.last_activity_at AS lastActivityAt, j.briefing, w.name AS realm,
      (SELECT x.text FROM messages x WHERE x.thread_id = m.top_thread_id AND x.sender_kind = 'user'
        ORDER BY x.sequence LIMIT 1) AS opening
    FROM missions m
      JOIN threads top ON top.id = m.top_thread_id
      LEFT JOIN journals j ON j.mission_id = m.id
      LEFT JOIN workspaces w ON w.id = top.workspace_id
    WHERE m.is_guildmaster = 0 AND top.is_deleting = 0 AND (m.ending IS NULL OR m.ending = 'Done')
      AND NOT EXISTS (SELECT 1 FROM rituals r WHERE r.mission_id = m.id)
    ORDER BY m.last_activity_at DESC LIMIT ${maxListedQuests}`;
  // The state is the one the dashboard shows: Done once ended, else the most urgent state among the quest's threads.
  const states = new Map<string, string>(
    (yield* listMissionSummaries(rows.map((row) => row.id))).map((summary) => [summary.id, summary.state]),
  );
  const lines = rows.map((row) => {
    const about = firstSentenceOf(row.briefing?.trim() ? row.briefing : (row.opening ?? ""));
    const when = timeOf(row.lastActivityAt);
    return `- "${row.title}" (id ${row.id}) · ${states.get(row.id) ?? "Idle"} · ${row.realm ?? "no realm"} · last active ${when} UTC${about === "" ? "" : ` · ${about}`}`;
  });
  const { tiers } = yield* readSettings;
  const set = (["Light", "Balanced", "Heavy"] as const).flatMap((name) => {
    const tier = tiers[name];
    return tier === null ? [] : [`- ${name}: ${tier.harness}, model ${tier.model}, effort ${tier.effort}`];
  });
  const tierLines = set.length === 0 ? ["None set: every quest starts on the owner's default Companion."] : set;
  const rituals = yield* sql<{ isOn: number; schedule: string; title: string }>`
    SELECT m.title, r.schedule, r.is_on AS isOn FROM rituals r JOIN missions m ON m.id = r.mission_id
    WHERE m.ending IS NULL OR m.ending = 'Done' ORDER BY m.title`;
  return [
    "# Realms",
    ...(yield* realmLinesOf),
    "",
    "# Tiers (pass tier to suggest_mission or create_ritual by how demanding the work is)",
    ...tierLines,
    "",
    "# Rituals (instructions that run by themselves on a schedule; create one with create_ritual)",
    ...(rituals.length === 0
      ? ["No Ritual yet."]
      : rituals.map((ritual) => `- "${ritual.title}" · ${ritual.isOn === 1 ? "on" : "off"} · ${ritual.schedule}`)),
    "",
    "# Quests, latest first (this is the dashboard; look deeper with find_missions)",
    ...(lines.length === 0 ? ["No quest yet."] : lines),
  ].join("\n");
});

/** Where a quest or a Ritual the Guildmaster made is, in the words it is told. */
const placeOf = (realm: { readonly name: string } | null) =>
  realm === null ? "with no realm" : `in the realm ${realm.name}`;

/** What a resolved card shows in a conversation: the quest or Ritual a thread opened, as a card with a link. */
export type ResolvedCard = {
  /** The thread whose conversation shows the card. */
  readonly callerId: string;
  readonly isRitual: boolean;
  readonly realmPath: string | null;
  readonly target: { readonly missionId: string; readonly threadId: string; readonly title: string };
  readonly text: string;
  readonly title: string;
};

/** Records, in the caller's conversation, a card for the quest or Ritual it opened for the owner without asking. */
export const recordResolvedCard = (card: ResolvedCard) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [caller] = yield* sql<{
      missionId: string;
    }>`SELECT mission_id AS missionId FROM threads WHERE id = ${card.callerId}`;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO suggestions (id, mission_id, thread_id, text, title, matches, asked_at, outcome, is_automatic,
        is_ritual, target_mission_id, target_thread_id, target_title, resolved_at, realm_path)
      VALUES (${crypto.randomUUID()}, ${caller?.missionId ?? ""}, ${card.callerId}, ${card.text}, ${card.title}, '[]', ${now},
        'MovedToMission', 1, ${card.isRitual ? 1 : 0}, ${card.target.missionId}, ${card.target.threadId}, ${card.target.title}, ${now}, ${card.realmPath})`;
  });

// ----- Hearing back: the quests the Guildmaster opened tell it when they report, need the owner, or fail -----

/** The report a quest stands in, or null: a failure, a Summons, or a result awaiting "Mark as done?", in that order. */
const reportOf = (summary: { readonly prompt: string | null; readonly state: string }) =>
  summary.state === "Failed"
    ? "Failed"
    : summary.state === "Attention"
      ? "Attention"
      : // Only once the turn that reported has ended, so its closing reply can be passed on.
        summary.prompt === "MarkDone" && summary.state !== "Running" && summary.state !== "Waiting"
        ? "Reported"
        : null;

const clip = (text: string, length: number) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);

/** What the Guildmaster is told of one quest's report. */
const reportTextOf = (title: string, id: string, report: "Attention" | "Failed" | "Reported", detail: string) =>
  ({
    Attention: `Quest "${title}" (id ${id}) needs the owner: a thread there waits on a question or a decision. Tell the owner in a sentence, and that they answer it in that quest.${detail}`,
    Failed: `Quest "${title}" (id ${id}) failed.${detail} Tell the owner in a sentence.`,
    Reported: `Quest "${title}" (id ${id}) reported its result.${detail} Tell the owner in a sentence; do not repeat it all.`,
  })[report];

/**
 * Tells the Guildmaster, once, of each quest it opened that now reports, needs the owner, or failed, as a message from
 * that quest's top thread; a quest that no longer stands in a report is forgotten, so a later one is told again. It
 * changes nothing the owner sees when there is nothing to tell, so running it after every change cannot loop.
 */
export const reportToGuildmaster = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const opened = yield* sql<{ id: string; told: string | null; topThreadId: string; title: string }>`
    SELECT m.id, m.guildmaster_told AS told, m.top_thread_id AS topThreadId, m.title
    FROM missions m JOIN threads top ON top.id = m.top_thread_id
    WHERE m.opened_by_guildmaster = 1 AND top.is_deleting = 0`;
  if (opened.length === 0) return unchanged(null);
  const [guildmaster] = yield* sql<{ threadId: string }>`
    SELECT top_thread_id AS threadId FROM missions WHERE is_guildmaster = 1`;
  if (guildmaster === undefined) return unchanged(null);
  const summaries = new Map<string, MissionSummary>(
    (yield* listMissionSummaries(opened.map((quest) => quest.id))).map((summary) => [summary.id, summary]),
  );
  let isTold = false;
  for (const quest of opened) {
    const summary = summaries.get(quest.id);
    const report = summary === undefined ? null : reportOf(summary);
    if (report === quest.told) continue;
    yield* sql`UPDATE missions SET guildmaster_told = ${report} WHERE id = ${quest.id}`;
    if (report === null) continue;
    const [failure] =
      report === "Failed"
        ? yield* sql<{ failure: string | null }>`
            SELECT failure FROM threads WHERE mission_id = ${quest.id} AND state = 'Failed' LIMIT 1`
        : [];
    const [reply] =
      report === "Reported"
        ? yield* sql<{ text: string }>`
            SELECT text FROM messages WHERE thread_id = ${quest.topThreadId} AND sender_kind = 'agent'
            ORDER BY sequence DESC LIMIT 1`
        : [];
    const detail =
      failure?.failure != null
        ? ` Reason: ${clip(failure.failure, 400)}`
        : reply !== undefined
          ? ` Its last reply: ${clip(reply.text, 600)}`
          : "";
    yield* insertMessage({
      fromThreadId: quest.topThreadId,
      isQueued: false,
      isResult: false,
      text: reportTextOf(quest.title, quest.id, report, detail),
      threadId: guildmaster.threadId,
    });
    isTold = true;
  }
  return isTold ? changed(null, { threadsToWake: [guildmaster.threadId] }) : unchanged(null);
});

// ----- Acting on quests, at the owner's request -----

/** What `act_on_mission` came to: done, threads to stop outside the transaction, or a refusal. */
export type ActedOnQuest =
  | { readonly _tag: "Done"; readonly text: string }
  | { readonly _tag: "ToStop"; readonly ids: ReadonlyArray<string>; readonly text: string }
  | { readonly _tag: "Refused"; readonly text: string };

/** The outcome of an action the Guildmaster may not take, with the words that tell it why. */
export const refusedAction = (text: string) => unchanged<ActedOnQuest>({ _tag: "Refused", text });

/**
 * `act_on_mission`: renames a quest, ends it, or stops its threads at work, once its exact action was authorized by
 * provenance (guildmasterProvenance.ts): the owner's own words of this turn, a Ritual's reviewed scope in one of its
 * runs, or the owner's Allow. Iskios calls it, and a Ritual's own thread within its scope; never on its own initiative.
 */
export const actOnMission = (callerId: string, args: ArgumentsOf<"act_on_mission">) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (!(yield* isStructuralCaller(callerId, "act_on_mission"))) return refusedAction("Only Iskios acts on quests.");
    const [quest] = yield* sql<{ title: string }>`
      SELECT m.title FROM missions m JOIN threads top ON top.id = m.top_thread_id
      WHERE m.id = ${args.mission} AND m.is_guildmaster = 0 AND top.is_deleting = 0`;
    if (quest === undefined) return refusedAction("Not done: no such quest.");
    if (args.action === "Rename" && (args.title === undefined || titleOf(args.title) === ""))
      return refusedAction("Not done: give the new title.");
    const ids = args.action === "Stop" ? yield* readWorkingIds(args.mission) : [];
    if (args.action === "Stop" && ids.length === 0)
      return refusedAction(`"${quest.title}" has no thread at work to stop.`);
    if (!(yield* consumeReceipt(callerId, "act_on_mission", args))) return refusedAction(notAuthorizedText);
    if (args.action === "Rename") {
      yield* renameMission(args.mission, args.title ?? "");
      return changed<ActedOnQuest>({
        _tag: "Done",
        text: `Renamed the quest "${quest.title}" to "${titleOf(args.title ?? "")}".`,
      });
    }
    if (args.action === "Stop") {
      // Stopping runs outside the transaction, in the tool handler, which ends each turn; the receipt bound this set.
      return unchanged<ActedOnQuest>({
        _tag: "ToStop",
        ids,
        text: `Stopped ${ids.length === 1 ? "1 thread" : `${ids.length} threads`} of "${quest.title}".`,
      });
    }
    const ending = args.action === "Done" ? "Done" : "Archived";
    // The receipt matched the threads at work the question named, so the snapshot taken now is that one.
    const preview = yield* previewEnding(args.mission, ending);
    const done = yield* endMission(args.mission, ending, preview.snapshot);
    return changed<ActedOnQuest>(
      { _tag: "Done", text: `Marked "${quest.title}" ${ending === "Done" ? "Done" : "Archived"}.` },
      { turnsToCancel: done.followUps.turnsToCancel },
    );
  });

/** What `read_control_history` answers: the Guildmaster's own older messages, newest first. */
export const readControlHistory = (callerId: string, args: ArgumentsOf<"read_control_history">) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (!(yield* isGuildmasterThread(callerId)))
      return { isError: true, text: "Only Iskios reads this." } satisfies ToolAnswer;
    const count = Math.min(Math.max(args.count ?? 10, 1), 40);
    const query = (args.query ?? "").trim().toLowerCase();
    const rows = yield* sql<{ sequence: number; sender: string; text: string }>`
      SELECT sequence, sender_kind AS sender, text FROM messages
      WHERE thread_id = ${callerId} AND (${args.before ?? null} IS NULL OR sequence < ${args.before ?? null})
        AND (${query} = '' OR instr(lower(text), ${query}) > 0)
      ORDER BY sequence DESC LIMIT ${count}`;
    if (rows.length === 0) return { isError: false, text: "No such messages." } satisfies ToolAnswer;
    const who = { agent: "You", thread: "A quest", user: "The owner" } as const;
    return {
      isError: false,
      text: rows
        .map((row) => `#${row.sequence} ${who[row.sender as keyof typeof who] ?? row.sender}: ${clip(row.text, 800)}`)
        .join("\n\n"),
    } satisfies ToolAnswer;
  });

// ----- Creating Rituals -----

/** What `create_ritual` came to. */
export type RitualCreatedByGuildmaster =
  | { readonly _tag: "Created"; readonly text: string }
  | { readonly _tag: "Refused"; readonly reason: string };

/** A refused `create_ritual`, which changes nothing. */
export const refusedRitual = (reason: string) => unchanged<RitualCreatedByGuildmaster>({ _tag: "Refused", reason });

/**
 * `create_ritual`: the Guildmaster makes a Ritual, an instruction that runs by itself on a schedule in a quest of its
 * own, in a realm it names or none, on its own Companion unless it chooses another, once authorized by provenance. Its
 * reviewed scope starts empty: only the owner sets it, in the Ritual's form. Nothing runs until it is due. The owner sees
 * it as a card with a link. Only the Guildmaster calls it.
 */
export const createRitualByGuildmaster = (callerId: string, args: ArgumentsOf<"create_ritual">) =>
  Effect.gen(function* () {
    if (!(yield* isGuildmasterThread(callerId))) return refusedRitual("Only Iskios creates Rituals.");
    if (args.instruction.trim() === "" || titleOf(args.title) === "")
      return refusedRitual("Give an instruction and a title.");
    const realm = args.realm === undefined || args.realm.trim() === "" ? null : yield* findRealm(args.realm);
    if (args.realm !== undefined && args.realm.trim() !== "" && realm === null)
      return refusedRitual(
        `Not created: no realm "${args.realm}". Name one of the realms in your context, or leave it out.`,
      );
    if (!(yield* consumeReceipt(callerId, "create_ritual", args))) return refusedRitual(notAuthorizedText);
    const { companion: runner, fallbacks } = ritualStartOf(yield* readSettings, args);
    const title = titleOf(args.title).slice(0, 80);
    const created = yield* createRitual({
      fallbacks,
      instruction: args.instruction,
      primary: { ...runner, accountId: runner.accountId as AccountId | null },
      realm: null,
      schedule: args.schedule,
      title,
      workspacePath: realm?.path ?? null,
    });
    yield* recordResolvedCard({
      callerId,
      isRitual: true,
      realmPath: realm?.path ?? null,
      target: { missionId: created.value.missionId, threadId: created.value.threadId, title },
      text: args.instruction,
      title,
    });
    const where = placeOf(realm);
    return changed<RitualCreatedByGuildmaster>({
      _tag: "Created",
      text: `Created the Ritual "${title}" ${where}, ${JSON.stringify(args.schedule)}, on ${companionLineOf(args.tier, runner)}. It runs by itself in its own quest when due and is on. Tell the owner in a sentence what it will do and when; do not repeat the instruction.`,
    });
  });
