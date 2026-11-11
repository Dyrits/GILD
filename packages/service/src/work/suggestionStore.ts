import type { MissionSummary, Suggestion, SuggestionMatch } from "@iskios/contracts";
import { Effect, Exit, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { readSettings } from "../core/index.ts";
import { companionOf } from "./guildmaster.ts";
import { listMissionSummaries } from "./missions.ts";

type SuggestionRow = Omit<Suggestion, "isAutomatic" | "isFromGuildmaster" | "isRitual" | "matches"> & {
  isAutomatic: number;
  isFromGuildmaster: number;
  isRitual: number;
  tier: string | null;
  matches: string;
};

const selectSuggestions = (sql: SqlClient.SqlClient) => sql`
  SELECT s.id, s.thread_id AS threadId, s.text, s.title, s.matches, s.asked_at AS askedAt, s.outcome,
    s.is_automatic AS isAutomatic, m.is_guildmaster AS isFromGuildmaster, s.is_ritual AS isRitual, s.tier AS tier, s.realm_path AS realmPath, s.target_mission_id AS targetMissionId, s.target_thread_id AS targetThreadId,
    s.target_title AS targetTitle, s.resolved_at AS resolvedAt, t.model, t.effort, t.harness,
    t.account_id AS accountId
  FROM suggestions s JOIN threads t ON t.id = s.thread_id JOIN missions m ON m.id = t.mission_id`;

// Offered mission ids are stored as JSON text; a value that no longer decodes offers none.
const decodeMatchIds = Schema.decodeUnknownExit(Schema.fromJsonString(Schema.Array(Schema.String)));
const matchIdsOf = (text: string): ReadonlyArray<string> => {
  const decoded = decodeMatchIds(text);
  return Exit.isSuccess(decoded) ? decoded.value : [];
};

const tierOf = (stored: string | null) =>
  stored === "Light" || stored === "Balanced" || stored === "Heavy" ? stored : undefined;

/** Suggestions with their offered missions as they stand now; a mission deleted since is no longer offered. */
const withMatches = (rows: ReadonlyArray<SuggestionRow>) =>
  Effect.gen(function* () {
    const ids = [...new Set(rows.flatMap((row) => matchIdsOf(row.matches)))];
    const summaries = new Map<string, MissionSummary>(
      (yield* listMissionSummaries(ids)).map((summary) => [summary.id, summary]),
    );
    const settings = yield* readSettings;
    return rows.map(({ isAutomatic, isFromGuildmaster, isRitual, matches, tier, ...row }) => ({
      ...row,
      // The Guildmaster's own Companion only routes: a new quest it offers starts on the tier chosen, else the default.
      ...(isFromGuildmaster === 1 ? companionOf(settings, tierOf(tier), {}) : {}),
      isAutomatic: isAutomatic === 1,
      isFromGuildmaster: isFromGuildmaster === 1,
      isRitual: isRitual === 1,
      matches: matchIdsOf(matches).flatMap((id): Array<SuggestionMatch> => {
        const summary = summaries.get(id);
        return summary === undefined ? [] : [{ missionId: summary.id, state: summary.state, title: summary.title }];
      }),
    })) as Array<Suggestion>;
  });

/** A thread's suggestions, open and resolved, in the order made. */
export const listThreadSuggestions = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* withMatches(
      yield* sql<SuggestionRow>`${selectSuggestions(sql)} WHERE s.thread_id = ${threadId} ORDER BY s.asked_at, s.rowid`,
    );
  });

/** One suggestion by its identifier, or null. */
export const readSuggestion = (suggestionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [suggestion] = yield* withMatches(
      yield* sql<SuggestionRow>`${selectSuggestions(sql)} WHERE s.id = ${suggestionId}`,
    );
    return suggestion ?? null;
  });
