import type { Suggestion, SuggestionAnswer, SuggestionOutcome } from "@canopy/contracts";
import { Clock, Context, Effect, Layer, Match } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { makeOwnerWaits } from "./attention.ts";
import { Changes } from "./changes.ts";
import { invalid, notFound, type ServiceFailure } from "./errors.ts";
import { resumeInTurn } from "./lifecycle.ts";
import { findMissions, findMissionsTextOf, maxMatches } from "./matching.ts";
import { insertUserMessage } from "./messaging.ts";
import { insertMission } from "./missions.ts";
import { readSettings } from "./settings.ts";
import { readSuggestion } from "./suggestionStore.ts";
import { type ArgumentsOf, type ToolAnswer, type ToolHandlers, threadTools } from "./threadTools.ts";
import { proposeTitle, titleOf } from "./titles.ts";
import { openAside } from "./tree.ts";

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
    Withdrawn: "Withdrawn: the turn that asked ended before the owner answered.",
  }) satisfies Record<SuggestionOutcome, string>;

/** Owns off-topic suggestions: asking the owner, carrying out the choice, and withdrawal (thread-tree). */
export class Suggestions extends Context.Service<
  Suggestions,
  {
    readonly answer: (
      suggestionId: string,
      given: SuggestionAnswer,
    ) => Effect.Effect<Suggestion, ServiceFailure | SqlError.SqlError>;
    readonly findMissions: ToolHandlers["find_missions"];
    /** Answers `suggest_mission`, with the thread to wake when a mission opened without asking. */
    readonly suggest: (
      threadId: string,
      args: ArgumentsOf<"suggest_mission">,
    ) => Effect.Effect<{ readonly answer: ToolAnswer; readonly threadToWake: string | null }>;
    readonly withdraw: (threadId: string) => Effect.Effect<void>;
  }
>()("canopy/Suggestions") {}

/** Owns off-topic suggestions; a restart withdraws those left open. */
export const suggestionsLayer = Layer.effect(
  Suggestions,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const waits = makeOwnerWaits<Resolution>(sql, changes);

    // Provisional until recovery is settled (work-in-progress, Open questions: recovery of interrupted turns),
    // as for questions: a restart ends the turn that was waiting.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE suggestions SET outcome = 'Withdrawn', resolved_at = ${startedAt} WHERE outcome IS NULL`;

    /** Records the resolution and returns the thread to Running once nothing else waits on the owner. */
    const resolve = (suggestionId: string, threadId: string, resolution: Resolution) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        yield* sql`UPDATE suggestions SET outcome = ${resolution.outcome}, target_mission_id = ${resolution.targetMissionId},
            target_thread_id = ${resolution.targetThreadId}, target_title = ${resolution.targetTitle}, resolved_at = ${now}
          WHERE id = ${suggestionId} AND outcome IS NULL`;
        yield* resumeInTurn(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
        yield* sql.afterCommit(changes.publish);
      });

    /** Opens a mission with only the off-topic part, under the proposed title, with no workspace. */
    const openMission = (text: string, title: string, choice: Parameters<typeof insertMission>[1]) =>
      Effect.gen(function* () {
        const started = yield* insertMission(text, choice, null, false);
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
        NewMission: (chosen) =>
          // Left out, the harness and account are the suggesting thread's, as Open as new mission prefills them.
          openMission(suggestion.text, suggestion.title, {
            accountId:
              chosen.harness === undefined && chosen.accountId === undefined ? suggestion.accountId : chosen.accountId,
            effort: chosen.effort,
            harness: chosen.harness ?? suggestion.harness,
            model: chosen.model,
          }),
      });

    const answer = (suggestionId: string, given: SuggestionAnswer) =>
      Effect.gen(function* () {
        const suggestion = yield* readSuggestion(suggestionId);
        if (suggestion === null) return yield* notFound("No such suggestion.");
        if (suggestion.outcome !== null) return yield* invalid("This suggestion was already answered.");
        if (!waits.isWaiting(suggestionId)) return yield* invalid("This suggestion is no longer waiting.");
        const resolution = yield* sql.withTransaction(
          carryOut(suggestion, given).pipe(Effect.tap((done) => resolve(suggestionId, suggestion.threadId, done))),
        );
        yield* waits.settle(suggestionId, resolution);
        return (yield* readSuggestion(suggestionId)) ?? suggestion;
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql));

    /**
     * Opens the suggestion, puts the thread in Attention, and waits with no time limit for the owner; null
     * when the thread is not at work in a turn, so nobody is asked.
     */
    const ask = (threadId: string, missionId: string, text: string, title: string, matches: ReadonlyArray<string>) =>
      waits.ask({
        // A caller that gave up leaves nobody to carry on: the suggestion is withdrawn.
        abandon: (id) => sql.withTransaction(resolve(id, threadId, withdrawn)),
        missionId,
        record: (id, now) =>
          sql`INSERT INTO suggestions (id, mission_id, thread_id, text, title, matches, asked_at)
            VALUES (${id}, ${missionId}, ${threadId}, ${text}, ${title}, ${JSON.stringify(matches)}, ${now})`.pipe(
            Effect.asVoid,
          ),
        threadId,
      });

    /** With the setting on and nothing matching, the new mission opens without asking. */
    const openWithoutAsking = (threadId: string, missionId: string, text: string, title: string) =>
      Effect.gen(function* () {
        const resolution = yield* sql.withTransaction(
          Effect.gen(function* () {
            const [thread] = yield* sql<Pick<Suggestion, "model" | "effort" | "harness" | "accountId">>`
              SELECT model, effort, harness, account_id AS accountId FROM threads WHERE id = ${threadId}`;
            const opened = yield* openMission(text, title, {
              accountId: thread?.accountId ?? null,
              effort: thread?.effort ?? "default",
              harness: thread?.harness ?? null,
              model: thread?.model ?? "default",
            });
            const now = yield* Clock.currentTimeMillis;
            yield* sql`INSERT INTO suggestions (id, mission_id, thread_id, text, title, matches, asked_at, outcome,
                is_automatic, target_mission_id, target_thread_id, target_title, resolved_at)
              VALUES (${crypto.randomUUID()}, ${missionId}, ${threadId}, ${text}, ${title}, '[]', ${now}, ${opened.outcome},
                1, ${opened.targetMissionId}, ${opened.targetThreadId}, ${opened.targetTitle}, ${now})`;
            yield* sql.afterCommit(changes.publish);
            return opened;
          }),
        );
        return resolution;
      });

    const suggestAnswer = (threadId: string, args: ArgumentsOf<"suggest_mission">) =>
      Effect.gen(function* () {
        if (args.text.trim() === "") return { answer: threadTools.suggest_mission.invalid, threadToWake: null };
        const { missions = [], text, title } = args;
        const [caller] = yield* sql<{
          missionId: string;
        }>`SELECT mission_id AS missionId FROM threads WHERE id = ${threadId}`;
        if (caller === undefined) return { answer: { isError: true, text: "Unknown thread." }, threadToWake: null };
        const existing = new Set(
          (missions.length === 0
            ? []
            : yield* sql<{ id: string }>`SELECT m.id FROM missions m JOIN threads top ON top.id = m.top_thread_id
                WHERE m.id IN ${sql.in([...missions])} AND top.is_deleting = 0`
          ).map((row) => row.id),
        );
        const named = [...new Set(missions)]
          .filter((id) => existing.has(id) && id !== caller.missionId)
          .slice(0, maxMatches);
        const { shouldOpenOffTopicMissions } = yield* readSettings;
        // Opening without asking needs no mission to match, so it is checked here, not taken from the thread.
        const matches =
          shouldOpenOffTopicMissions && named.length === 0
            ? (yield* findMissions(threadId, text)).map((match) => match.id)
            : named;
        // A mission that cannot open, such as at a reached global budget, is left to the owner's choice.
        const opened =
          shouldOpenOffTopicMissions && matches.length === 0
            ? yield* openWithoutAsking(threadId, caller.missionId, text, title).pipe(
                Effect.catch(() => Effect.succeed(null)),
              )
            : null;
        if (opened !== null) {
          return {
            answer: {
              isError: false,
              text: `No mission fits, so Canopy opened it as a new mission "${opened.targetTitle}" (id ${opened.targetMissionId}), as the owner's settings ask. ${carryOn}`,
            },
            threadToWake: opened.targetThreadId,
          };
        }
        const resolution = yield* ask(threadId, caller.missionId, text, title, matches);
        if (resolution === null)
          return {
            answer: {
              isError: true,
              text: "Not asked: this thread is not at work in a turn, so the owner was not asked.",
            },
            threadToWake: null,
          };
        return {
          answer: { isError: resolution.outcome === "Withdrawn", text: textOf(resolution)[resolution.outcome] },
          threadToWake: null,
        };
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie);

    const findMissionsAnswer = (threadId: string, args: ArgumentsOf<"find_missions">) =>
      Effect.gen(function* () {
        return { isError: false, text: findMissionsTextOf(yield* findMissions(threadId, args.request)) };
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie);

    const withdraw = (threadId: string) =>
      Effect.gen(function* () {
        const open = yield* sql<{
          id: string;
        }>`SELECT id FROM suggestions WHERE thread_id = ${threadId} AND outcome IS NULL`;
        for (const { id } of open) {
          yield* sql.withTransaction(resolve(id, threadId, withdrawn));
          yield* waits.settle(id, withdrawn);
        }
      }).pipe(Effect.orDie);

    return { answer, findMissions: findMissionsAnswer, suggest: suggestAnswer, withdraw };
  }),
);
