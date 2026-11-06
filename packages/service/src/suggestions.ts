import type { Suggestion, SuggestionAnswer, SuggestionOutcome } from "@openmission/contracts";
import { Clock, Context, Deferred, Effect, Exit, Layer, Match, Schema } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { Changes } from "./changes.ts";
import { invalid, notFound, type ServiceFailure } from "./errors.ts";
import type { ToolAnswer } from "./journalTools.ts";
import { findMissions, findMissionsTextOf, maxMatches } from "./matching.ts";
import { insertUserMessage } from "./messaging.ts";
import { insertMission, titleOf } from "./missions.ts";
import { readSettings } from "./settings.ts";
import { readSuggestion } from "./suggestionStore.ts";
import { proposeTitle } from "./titles.ts";
import { openAside } from "./tree.ts";
import { Waker } from "./waker.ts";

/** Where an off-topic request went, as the suggesting thread is told and its conversation links to. */
interface Resolution {
  readonly outcome: SuggestionOutcome;
  readonly targetMissionId: string | null;
  readonly targetThreadId: string | null;
  readonly targetTitle: string | null;
}

const withdrawn: Resolution = { outcome: "Withdrawn", targetMissionId: null, targetThreadId: null, targetTitle: null };

const carryOn = "Carry on as if that message had not been sent to you; do not answer it.";

/** What `suggest_mission` answers the thread for each outcome. */
const textOf = (resolution: Resolution) =>
  ({
    Continued: `The owner continued it in mission "${resolution.targetTitle}" (id ${resolution.targetMissionId}). ${carryOn}`,
    KeptAsAside: `The owner kept it as an aside beneath you: thread "${resolution.targetTitle}" (id ${resolution.targetThreadId}). It will message you what is relevant to the mission. ${carryOn}`,
    MovedToMission: `The owner opened it as a new mission "${resolution.targetTitle}" (id ${resolution.targetMissionId}). ${carryOn}`,
    Withdrawn: "Withdrawn: the owner stopped this thread.",
  }) satisfies Record<SuggestionOutcome, string>;

/** Owns off-topic suggestions: asking the owner, carrying out the choice, and withdrawal (thread-tree). */
export class Suggestions extends Context.Service<
  Suggestions,
  {
    readonly answer: (
      suggestionId: string,
      given: SuggestionAnswer,
    ) => Effect.Effect<Suggestion, ServiceFailure | SqlError.SqlError>;
    readonly findMissions: (threadId: string, args: unknown) => Effect.Effect<ToolAnswer>;
    readonly suggest: (threadId: string, args: unknown) => Effect.Effect<ToolAnswer>;
    readonly withdraw: (threadId: string) => Effect.Effect<void>;
  }
>()("openmission/Suggestions") {}

const FindMissionsArguments = Schema.Struct({ request: Schema.String });
const SuggestMissionArguments = Schema.Struct({
  missions: Schema.optional(Schema.Array(Schema.String)),
  text: Schema.String,
  title: Schema.String,
});
const decodeFindMissions = Schema.decodeUnknownExit(FindMissionsArguments);
const decodeSuggestMission = Schema.decodeUnknownExit(SuggestMissionArguments);

/** The off-topic thread tools as MCP lists them (thread-tree, External contract). */
export const offTopicToolDefinitions = [
  {
    description:
      "Find other missions that may fit an off-topic request, by their titles and briefings: up to 3, best first, with their ids, states, and briefings.",
    inputSchema: {
      properties: { request: { description: "The off-topic part of the owner's message.", type: "string" } },
      required: ["request"],
      type: "object",
    },
    name: "find_missions",
  },
  {
    description:
      "Ask the owner where an off-topic message goes: continue in a matching mission, open a new mission, or keep it as an aside beneath you. Wait for the answer, then carry on as if the message had not been sent to you.",
    inputSchema: {
      properties: {
        missions: {
          description: "The ids of the missions from find_missions that fit, best first, at most 3.",
          items: { type: "string" },
          type: "array",
        },
        text: { description: "The off-topic part of the owner's message, as written.", type: "string" },
        title: { description: "A short title of a few words for a new mission or aside.", type: "string" },
      },
      required: ["text", "title"],
      type: "object",
    },
    name: "suggest_mission",
  },
];

export const suggestionsLayer = Layer.effect(
  Suggestions,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const waker = yield* Waker;
    const waiting = new Map<string, Deferred.Deferred<Resolution>>();

    // Provisional until recovery is settled, as for questions: a restart ends the turn that was waiting.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE suggestions SET outcome = 'Withdrawn', resolved_at = ${startedAt} WHERE outcome IS NULL`;

    /** Records the resolution and returns the thread to Running once nothing else waits on the owner. */
    const resolve = (suggestionId: string, threadId: string, resolution: Resolution) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        yield* sql`UPDATE suggestions SET outcome = ${resolution.outcome}, target_mission_id = ${resolution.targetMissionId},
            target_thread_id = ${resolution.targetThreadId}, target_title = ${resolution.targetTitle}, resolved_at = ${now}
          WHERE id = ${suggestionId} AND outcome IS NULL`;
        yield* sql`UPDATE threads SET state = 'Running'
          WHERE id = ${threadId} AND state = 'Attention' AND blocker IS NULL
            AND NOT EXISTS (SELECT 1 FROM questions WHERE thread_id = ${threadId} AND outcome IS NULL)
            AND NOT EXISTS (SELECT 1 FROM suggestions WHERE thread_id = ${threadId} AND outcome IS NULL)`;
        yield* sql.afterCommit(changes.publish);
      });

    /** Opens a mission with only the off-topic part, under the proposed title, with no workspace. */
    const openMission = (text: string, title: string, model: Suggestion["model"], effort: Suggestion["effort"]) =>
      Effect.gen(function* () {
        const started = yield* insertMission(text, model, effort, null, false);
        if (titleOf(title) !== "") yield* proposeTitle(started.missionId, title);
        const [mission] = yield* sql<{ title: string }>`SELECT title FROM missions WHERE id = ${started.missionId}`;
        return {
          outcome: "MovedToMission",
          targetMissionId: started.missionId,
          targetThreadId: started.threadId,
          targetTitle: mission?.title ?? title,
        } satisfies Resolution;
      });

    /** Carries out the owner's choice. Runs in a transaction; the caller wakes the target thread. */
    const carryOut = (suggestion: Suggestion, given: SuggestionAnswer) =>
      Match.valueTags(given, {
        Aside: () =>
          openAside(suggestion.threadId, suggestion.text, suggestion.title).pipe(
            Effect.flatMap((opened) =>
              sql<{ title: string }>`SELECT title FROM threads WHERE id = ${opened.threadId}`.pipe(
                Effect.map(
                  ([row]): Resolution => ({
                    outcome: "KeptAsAside",
                    targetMissionId: null,
                    targetThreadId: opened.threadId,
                    targetTitle: row?.title ?? suggestion.title,
                  }),
                ),
              ),
            ),
          ),
        Continue: ({ missionId }) =>
          Effect.gen(function* () {
            if (!suggestion.matches.some((match) => match.missionId === missionId))
              return yield* invalid("That mission was not offered for this message.");
            const [mission] = yield* sql<{ title: string; topThreadId: string }>`
              SELECT title, top_thread_id AS topThreadId FROM missions WHERE id = ${missionId}`;
            if (mission === undefined) return yield* notFound("No such mission.");
            const { defaultDelivery } = yield* readSettings;
            yield* insertUserMessage(mission.topThreadId, suggestion.text, defaultDelivery === "Queue");
            return {
              outcome: "Continued",
              targetMissionId: missionId,
              targetThreadId: mission.topThreadId,
              targetTitle: mission.title,
            } satisfies Resolution;
          }),
        NewMission: ({ effort, model }) => openMission(suggestion.text, suggestion.title, model, effort),
      });

    const answer = (suggestionId: string, given: SuggestionAnswer) =>
      Effect.gen(function* () {
        const suggestion = yield* readSuggestion(suggestionId);
        if (suggestion === null) return yield* notFound("No such suggestion.");
        if (suggestion.outcome !== null) return yield* invalid("This suggestion was already answered.");
        const deferred = waiting.get(suggestionId);
        // An open row without a waiter belongs to a turn that already ended.
        if (deferred === undefined) return yield* invalid("This suggestion is no longer waiting.");
        const resolution = yield* sql.withTransaction(
          carryOut(suggestion, given).pipe(Effect.tap((done) => resolve(suggestionId, suggestion.threadId, done))),
        );
        yield* Deferred.succeed(deferred, resolution);
        if (resolution.targetThreadId !== null) yield* waker.wake(resolution.targetThreadId);
        return (yield* readSuggestion(suggestionId)) ?? suggestion;
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql));

    /** Opens the suggestion, puts the thread in Attention, and waits with no time limit for the owner. */
    const ask = (threadId: string, missionId: string, text: string, title: string, matches: ReadonlyArray<string>) =>
      Effect.gen(function* () {
        const id = crypto.randomUUID();
        const deferred = yield* Deferred.make<Resolution>();
        const isAtWork = yield* sql.withTransaction(
          Effect.gen(function* () {
            const [thread] = yield* sql<{ state: string; blocker: string | null }>`
              SELECT state, blocker FROM threads WHERE id = ${threadId}`;
            if (thread === undefined || thread.blocker !== null || !["Running", "Attention"].includes(thread.state))
              return false;
            waiting.set(id, deferred);
            const now = yield* Clock.currentTimeMillis;
            yield* sql`INSERT INTO suggestions (id, mission_id, thread_id, text, title, matches, asked_at)
              VALUES (${id}, ${missionId}, ${threadId}, ${text}, ${title}, ${JSON.stringify(matches)}, ${now})`;
            yield* sql`UPDATE threads SET state = 'Attention' WHERE id = ${threadId} AND state = 'Running'`;
            yield* sql`UPDATE missions SET last_activity_at = ${now} WHERE id = ${missionId}`;
            yield* sql.afterCommit(changes.publish);
            return true;
          }),
        );
        if (!isAtWork) return withdrawn;
        return yield* Deferred.await(deferred).pipe(
          // A caller that gave up leaves nobody to carry on: the suggestion is withdrawn.
          Effect.onInterrupt(() => sql.withTransaction(resolve(id, threadId, withdrawn)).pipe(Effect.ignore)),
          Effect.ensuring(Effect.sync(() => waiting.delete(id))),
        );
      });

    /** With the setting on and nothing matching, the new mission opens without asking. */
    const openWithoutAsking = (threadId: string, missionId: string, text: string, title: string) =>
      Effect.gen(function* () {
        const resolution = yield* sql.withTransaction(
          Effect.gen(function* () {
            const [thread] = yield* sql<{ model: Suggestion["model"]; effort: Suggestion["effort"] }>`
              SELECT model, effort FROM threads WHERE id = ${threadId}`;
            const opened = yield* openMission(text, title, thread?.model ?? "default", thread?.effort ?? "default");
            const now = yield* Clock.currentTimeMillis;
            yield* sql`INSERT INTO suggestions (id, mission_id, thread_id, text, title, matches, asked_at, outcome,
                is_automatic, target_mission_id, target_thread_id, target_title, resolved_at)
              VALUES (${crypto.randomUUID()}, ${missionId}, ${threadId}, ${text}, ${title}, '[]', ${now}, ${opened.outcome},
                1, ${opened.targetMissionId}, ${opened.targetThreadId}, ${opened.targetTitle}, ${now})`;
            yield* sql.afterCommit(changes.publish);
            return opened;
          }),
        );
        if (resolution.targetThreadId !== null) yield* waker.wake(resolution.targetThreadId);
        return resolution;
      });

    const suggest = (threadId: string, args: unknown) =>
      Effect.gen(function* () {
        const decoded = decodeSuggestMission(args);
        if (Exit.isFailure(decoded) || decoded.value.text.trim() === "")
          return { isError: true, text: "Invalid arguments: give text, title, and missions." } satisfies ToolAnswer;
        const { missions = [], text, title } = decoded.value;
        const [caller] = yield* sql<{
          missionId: string;
        }>`SELECT mission_id AS missionId FROM threads WHERE id = ${threadId}`;
        if (caller === undefined) return { isError: true, text: "Unknown thread." } satisfies ToolAnswer;
        const existing = new Set(
          (missions.length === 0
            ? []
            : yield* sql<{ id: string }>`SELECT m.id FROM missions m JOIN threads top ON top.id = m.top_thread_id
                WHERE m.id IN ${sql.in([...missions])} AND top.is_deleting = 0`
          ).map((row) => row.id),
        );
        const matches = [...new Set(missions)]
          .filter((id) => existing.has(id) && id !== caller.missionId)
          .slice(0, maxMatches);
        const { shouldOpenOffTopicMissions } = yield* readSettings;
        // A mission that cannot open, such as at a reached global budget, is left to the owner's choice.
        const opened =
          shouldOpenOffTopicMissions && matches.length === 0
            ? yield* openWithoutAsking(threadId, caller.missionId, text, title).pipe(
                Effect.catch(() => Effect.succeed(null)),
              )
            : null;
        if (opened !== null) {
          return {
            isError: false,
            text: `No mission fits, so OpenMission opened it as a new mission "${opened.targetTitle}" (id ${opened.targetMissionId}), as the owner's settings ask. ${carryOn}`,
          };
        }
        const resolution = yield* ask(threadId, caller.missionId, text, title, matches);
        return { isError: resolution.outcome === "Withdrawn", text: textOf(resolution)[resolution.outcome] };
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie);

    const findMissionsAnswer = (threadId: string, args: unknown) =>
      Effect.gen(function* () {
        const decoded = decodeFindMissions(args);
        if (Exit.isFailure(decoded)) return { isError: true, text: "Invalid arguments: give request." };
        return { isError: false, text: findMissionsTextOf(yield* findMissions(threadId, decoded.value.request)) };
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie);

    const withdraw = (threadId: string) =>
      Effect.gen(function* () {
        const open = yield* sql<{
          id: string;
        }>`SELECT id FROM suggestions WHERE thread_id = ${threadId} AND outcome IS NULL`;
        for (const { id } of open) {
          yield* sql.withTransaction(resolve(id, threadId, withdrawn));
          const deferred = waiting.get(id);
          if (deferred !== undefined) yield* Deferred.succeed(deferred, withdrawn);
        }
      }).pipe(Effect.orDie);

    return { answer, findMissions: findMissionsAnswer, suggest, withdraw };
  }),
);
