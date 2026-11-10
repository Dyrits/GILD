import type { Suggestion, SuggestionAnswer, SuggestionOutcome } from "@gild/contracts";
import { Clock, Context, Effect, Layer, Match } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { makeOwnerWaits } from "./attention.ts";
import { Changes } from "./changes.ts";
import { changed, unchanged, type WithFollowUps } from "./commands.ts";
import { invalid, notFound, type ServiceFailure } from "./errors.ts";
import { findRealm, isGuildmasterThread, recordResolvedCard } from "./guildmaster.ts";
import { resumeInTurn } from "./lifecycle.ts";
import { findMissions, findMissionsTextOf, maxMatches } from "./matching.ts";
import { insertUserMessage } from "./messaging.ts";
import { insertMission } from "./missions.ts";
import { readSettings } from "./settings.ts";
import { readSuggestion } from "./suggestionStore.ts";
import type { ArgumentsOf, ToolHandlers } from "./threadTools.ts";
import { proposeTitle, titleOf } from "./titles.ts";
import { openAside } from "./tree.ts";

/** Where an off-topic request went, as the suggesting thread is told and its conversation links to. */
export interface Resolution {
  readonly outcome: SuggestionOutcome;
  readonly targetMissionId: string | null;
  readonly targetThreadId: string | null;
  readonly targetTitle: string | null;
}

const withdrawn: Resolution = { outcome: "Withdrawn", targetMissionId: null, targetThreadId: null, targetTitle: null };

/** What a thread's off-topic suggestion came to; what the thread is told is the tool's concern. */
export type Suggested =
  | { readonly _tag: "UnknownThread" }
  /** The thread is not at work in a turn, so the owner was not asked. */
  | { readonly _tag: "NotAsked" }
  /** With the setting on and nothing matching, a new mission opened without asking. */
  | { readonly _tag: "OpenedWithoutAsking"; readonly resolution: Resolution }
  | { readonly _tag: "Resolved"; readonly resolution: Resolution };

/** Owns off-topic suggestions: asking the owner, carrying out the choice, and withdrawal (thread-tree). */
export class Suggestions extends Context.Service<
  Suggestions,
  {
    /**
     * Carries out the owner's answer and commits it; the follow-ups, which wake the request's new home, are
     * the caller's to apply (commands.ts), since the waiting turn is settled after the commit.
     */
    readonly answer: (
      suggestionId: string,
      given: SuggestionAnswer,
    ) => Effect.Effect<WithFollowUps<Suggestion>, ServiceFailure | SqlError.SqlError>;
    readonly findMissions: ToolHandlers["find_missions"];
    /**
     * Carries out `suggest_mission` and commits it, asking the owner when needed; the follow-ups, which wake
     * a mission opened without asking, are the caller's to apply.
     */
    readonly suggest: (
      threadId: string,
      args: ArgumentsOf<"suggest_mission">,
    ) => Effect.Effect<WithFollowUps<Suggested>>;
    readonly withdraw: (threadId: string) => Effect.Effect<void>;
  }
>()("gild/Suggestions") {}

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
      });

    /**
     * Withdraws a suggestion whose turn ended. Threads withdraws while cancelling a turn, beneath the command
     * runner, so this announces its own change.
     */
    const withdrawOne = (suggestionId: string, threadId: string) =>
      sql.withTransaction(
        resolve(suggestionId, threadId, withdrawn).pipe(Effect.tap(() => sql.afterCommit(changes.publish))),
      );

    /** Opens a mission with only the off-topic part, under the proposed title, with no workspace unless the Guildmaster's owner chose a realm. */
    const openMission = (
      text: string,
      title: string,
      choice: Parameters<typeof insertMission>[1],
      realmPath: string | null = null,
      isFromGuildmaster = false,
    ) =>
      Effect.gen(function* () {
        const started = yield* insertMission(text, choice, realmPath, false);
        // The Guildmaster hears of this quest's result, Summons, and failure from now on (hearing back).
        if (isFromGuildmaster)
          yield* sql`UPDATE missions SET opened_by_guildmaster = 1 WHERE id = ${started.missionId}`;
        if (titleOf(title) !== "") yield* proposeTitle(started.missionId, title);
        const [mission] = yield* sql<{ title: string }>`SELECT title FROM missions WHERE id = ${started.missionId}`;
        return {
          outcome: "MovedToMission",
          targetMissionId: started.missionId,
          targetThreadId: started.threadId,
          targetTitle: mission?.title ?? title,
        } satisfies Resolution;
      });

    /** Carries out the owner's choice in the answer's transaction; the request's new home is then woken. */
    const carryOut = (suggestion: Suggestion, given: SuggestionAnswer) =>
      Match.valueTags(given, {
        Aside: () =>
          Effect.gen(function* () {
            if (suggestion.isFromGuildmaster)
              return yield* invalid("The Guildmaster keeps no asides: continue in a quest or open a new one.");
            const { value: opened } = yield* openAside(suggestion.threadId, suggestion.text, suggestion.title);
            const [row] = yield* sql<{ title: string }>`SELECT title FROM threads WHERE id = ${opened.threadId}`;
            return {
              outcome: "KeptAsAside",
              targetMissionId: null,
              targetThreadId: opened.threadId,
              targetTitle: row?.title ?? suggestion.title,
            } satisfies Resolution;
          }),
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
          Effect.gen(function* () {
            const [stored] = yield* sql<{ realmPath: string | null }>`
              SELECT realm_path AS realmPath FROM suggestions WHERE id = ${suggestion.id}`;
            // Left out, the harness and account are the suggesting thread's, as Open as new mission prefills them.
            return yield* openMission(
              suggestion.text,
              suggestion.title,
              {
                accountId:
                  chosen.harness === undefined && chosen.accountId === undefined
                    ? suggestion.accountId
                    : chosen.accountId,
                effort: chosen.effort,
                harness: chosen.harness ?? suggestion.harness,
                model: chosen.model,
              },
              stored?.realmPath ?? null,
              suggestion.isFromGuildmaster,
            );
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
        const answered = (yield* readSuggestion(suggestionId)) ?? suggestion;
        return changed(answered, {
          threadsToWake: answered.targetThreadId === null ? [] : [answered.targetThreadId],
        });
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql));

    /**
     * Opens the suggestion, puts the thread in Attention, and waits with no time limit for the owner; null
     * when the thread is not at work in a turn, so nobody is asked.
     */
    const ask = (
      threadId: string,
      missionId: string,
      text: string,
      title: string,
      matches: ReadonlyArray<string>,
      realmPath: string | null,
      tier: string | null,
    ) =>
      waits.ask({
        // A caller that gave up leaves nobody to carry on: the suggestion is withdrawn.
        abandon: (id) => withdrawOne(id, threadId),
        missionId,
        record: (id, now) =>
          sql`INSERT INTO suggestions (id, mission_id, thread_id, text, title, matches, asked_at, realm_path, tier)
            VALUES (${id}, ${missionId}, ${threadId}, ${text}, ${title}, ${JSON.stringify(matches)}, ${now}, ${realmPath}, ${tier})`.pipe(
            Effect.asVoid,
          ),
        threadId,
      });

    /** With the setting on and nothing matching, the new mission opens without asking. */
    const openWithoutAsking = (threadId: string, text: string, title: string) =>
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
            yield* recordResolvedCard({
              callerId: threadId,
              isRitual: false,
              realmPath: null,
              target: { missionId: opened.targetMissionId, threadId: opened.targetThreadId, title: opened.targetTitle },
              text,
              title,
            });
            return opened;
          }),
        );
        return resolution;
      });

    const suggest = (threadId: string, args: ArgumentsOf<"suggest_mission">) =>
      Effect.gen(function* () {
        const { missions = [], text, title } = args;
        const [caller] = yield* sql<{
          missionId: string;
        }>`SELECT mission_id AS missionId FROM threads WHERE id = ${threadId}`;
        if (caller === undefined) return unchanged<Suggested>({ _tag: "UnknownThread" });
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
        // The Guildmaster always asks: it is where the owner decides whether a quest continues or a new one opens.
        const isGuildmaster = yield* isGuildmasterThread(threadId);
        const realm = isGuildmaster && args.realm !== undefined ? yield* findRealm(args.realm) : null;
        const shouldOpenOffTopicMissions = !isGuildmaster && (yield* readSettings).shouldOpenOffTopicMissions;
        // Opening without asking needs no mission to match, so it is checked here, not taken from the thread.
        const matches =
          shouldOpenOffTopicMissions && named.length === 0
            ? (yield* findMissions(threadId, text)).map((match) => match.id)
            : named;
        // A mission that cannot open, such as at a reached global budget, is left to the owner's choice.
        const opened =
          shouldOpenOffTopicMissions && matches.length === 0
            ? yield* openWithoutAsking(threadId, text, title).pipe(Effect.catch(() => Effect.succeed(null)))
            : null;
        if (opened !== null)
          return changed<Suggested>(
            { _tag: "OpenedWithoutAsking", resolution: opened },
            { threadsToWake: opened.targetThreadId === null ? [] : [opened.targetThreadId] },
          );
        const resolution = yield* ask(
          threadId,
          caller.missionId,
          text,
          title,
          matches,
          realm?.path ?? null,
          isGuildmaster ? (args.tier ?? null) : null,
        );
        return unchanged<Suggested>(resolution === null ? { _tag: "NotAsked" } : { _tag: "Resolved", resolution });
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
          yield* withdrawOne(id, threadId);
          yield* waits.settle(id, withdrawn);
        }
      }).pipe(Effect.orDie);

    return { answer, findMissions: findMissionsAnswer, suggest, withdraw };
  }),
);
