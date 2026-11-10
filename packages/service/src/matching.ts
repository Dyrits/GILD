import type { MissionSummary } from "@gild/contracts";
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

// A ticket key (ABC-123) or a link names one thing exactly, so two requests that share one are about the same work.
const linkPattern = /https?:\/\/[^\s<>"')\]]+/g;
// Keys are written in capitals, as trackers do; a key inside a link counts too, so "ABC-123" meets a quest that holds the ticket's link.
const keyPattern = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;

/** The ticket keys and links in a text, lowercased, with a link's final punctuation and trailing slash dropped. */
export const identifiersOf = (text: string) =>
  new Set([
    ...(text.match(linkPattern) ?? []).map((link) => link.toLowerCase().replace(/[.,;:!?/]+$/, "")),
    ...(text.match(keyPattern) ?? []).map((key) => key.toLowerCase()),
  ]);

/** What an exact shared ticket key or link adds to a quest's score: more than any few shared words. */
const identifierScore = 20;

/**
 * Other missions whose titles, briefings, or opening requests share words with the request, best first, at most 3:
 * a title word counts twice, a briefing or opening word once (provisional, work-in-progress Batch 10), and a shared
 * ticket key or link counts 20. Every mission not deleted counts, whatever its state; the caller's own mission and the
 * Guildmaster's do not.
 */
export const findMissions = (callerId: string, request: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const wanted = wordsOf(request);
    const wantedKeys = identifiersOf(request);
    const rows = yield* sql<{
      id: string;
      title: string;
      briefing: string | null;
      lastActivityAt: number;
      opening: string | null;
    }>`
      SELECT m.id, m.title, j.briefing, m.last_activity_at AS lastActivityAt,
        (SELECT x.text FROM messages x WHERE x.thread_id = m.top_thread_id AND x.sender_kind = 'user'
          ORDER BY x.sequence LIMIT 1) AS opening
      FROM missions m JOIN threads top ON top.id = m.top_thread_id LEFT JOIN journals j ON j.mission_id = m.id
      WHERE top.is_deleting = 0 AND m.is_guildmaster = 0 AND m.id <> (SELECT mission_id FROM threads WHERE id = ${callerId})`;
    const scored = rows
      .map((row) => {
        const title = wordsOf(row.title);
        const briefing = wordsOf(`${row.briefing ?? ""} ${row.opening ?? ""}`);
        let score = 0;
        for (const word of wanted) score += (title.has(word) ? 2 : 0) + (briefing.has(word) ? 1 : 0);
        const keys = identifiersOf(`${row.title} ${row.briefing ?? ""} ${row.opening ?? ""}`);
        for (const key of wantedKeys) if (keys.has(key)) score += identifierScore;
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
