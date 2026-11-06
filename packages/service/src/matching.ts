import type { MissionSummary } from "@openmission/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { listMissionSummaries } from "./missions.ts";

/** At most this many missions are offered for an off-topic request (thread-tree, Off-topic requests). */
export const maxMatches = 3;

// Words too common to say anything about a mission.
const commonWords = new Set(
  "the and for with from this that into about your our are was were will can have has what how why when where who all any not but you its his her their them then than there here also just some more most very".split(
    " ",
  ),
);

/** The distinct meaningful words of a text, lowercased, with a plural's final s dropped. */
export const wordsOf = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3 && !commonWords.has(word))
      .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word)),
  );

/**
 * Other missions whose titles or briefings share words with the request, best first, at most 3: a title
 * word counts twice, a briefing word once (provisional, work-in-progress Batch 10). Every mission not
 * deleted counts, whatever its state; the caller's own mission does not.
 */
export const findMissions = (callerId: string, request: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const wanted = wordsOf(request);
    const rows = yield* sql<{ id: string; title: string; briefing: string | null; lastActivityAt: number }>`
      SELECT m.id, m.title, j.briefing, m.last_activity_at AS lastActivityAt
      FROM missions m JOIN threads top ON top.id = m.top_thread_id LEFT JOIN journals j ON j.mission_id = m.id
      WHERE top.is_deleting = 0 AND m.id <> (SELECT mission_id FROM threads WHERE id = ${callerId})`;
    const scored = rows
      .map((row) => {
        const title = wordsOf(row.title);
        const briefing = wordsOf(row.briefing ?? "");
        let score = 0;
        for (const word of wanted) score += (title.has(word) ? 2 : 0) + (briefing.has(word) ? 1 : 0);
        return { ...row, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || b.lastActivityAt - a.lastActivityAt)
      .slice(0, maxMatches);
    const summaries = new Map<string, MissionSummary>(
      (yield* listMissionSummaries(scored.map((row) => row.id))).map((summary) => [summary.id, summary]),
    );
    return scored.map((row) => ({
      briefing: row.briefing ?? "",
      id: row.id,
      state: summaries.get(row.id)?.state ?? "Idle",
      title: row.title,
    }));
  });

/** `find_missions`'s answer: the matches with their ids, states, and briefings, or that none fits. */
export const findMissionsTextOf = (
  matches: ReadonlyArray<{ id: string; title: string; state: string; briefing: string }>,
) =>
  matches.length === 0
    ? "No mission fits this request."
    : [
        "Missions that may fit, best first:",
        ...matches.map(
          (match, index) =>
            `${index + 1}. "${match.title}" (id ${match.id}) · ${match.state}\n   Briefing: ${match.briefing.trim() === "" ? "(empty)" : match.briefing.trim()}`,
        ),
      ].join("\n");
