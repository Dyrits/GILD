import type { Suggestion, SuggestionMatch } from "@openmission/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { listMissionSummaries } from "./missions.ts";

type SuggestionRow = Omit<Suggestion, "isAutomatic" | "matches"> & { isAutomatic: number; matches: string };

const selectSuggestions = (sql: SqlClient.SqlClient) => sql`
  SELECT s.id, s.thread_id AS threadId, s.text, s.title, s.matches, s.asked_at AS askedAt, s.outcome,
    s.is_automatic AS isAutomatic, s.target_mission_id AS targetMissionId, s.target_thread_id AS targetThreadId,
    s.target_title AS targetTitle, s.resolved_at AS resolvedAt, t.model, t.effort
  FROM suggestions s JOIN threads t ON t.id = s.thread_id`;

/** Suggestions with their offered missions as they stand now; a mission deleted since is no longer offered. */
const withMatches = (rows: ReadonlyArray<SuggestionRow>) =>
  Effect.gen(function* () {
    const ids = [...new Set(rows.flatMap((row) => JSON.parse(row.matches) as Array<string>))];
    const summaries = new Map((yield* listMissionSummaries(ids)).map((summary) => [summary.id as string, summary]));
    return rows.map(({ isAutomatic, matches, ...row }) => ({
      ...row,
      isAutomatic: isAutomatic === 1,
      matches: (JSON.parse(matches) as Array<string>).flatMap((id): Array<SuggestionMatch> => {
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
