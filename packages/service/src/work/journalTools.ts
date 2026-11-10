import { Effect, Match } from "effect";
import { SqlClient } from "effect/sql";
import type { ToolAnswer } from "../core/index.ts";
import { isGuildmasterThread } from "./guildmaster.ts";
import { journalTextOf, missionOf, readJournalText, updateJournal } from "./journal.ts";
import type { ToolHandlers } from "./threadTools.ts";
import { isAside } from "./tree.ts";

/** Answers the journal's thread tools; `commit` runs a change in one transaction and announces it. */
export const journalToolsOf = (
  commit: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
): Pick<ToolHandlers, "read_journal" | "update_journal"> => ({
  read_journal: (threadId, { before, count, mission }) => {
    return commit(
      Effect.gen(function* () {
        if (mission === undefined)
          return { isError: false, text: yield* readJournalText(threadId, before ?? null, count ?? null) };
        // Another quest's journal is the Guildmaster's to read, whatever the quest.
        if (!(yield* isGuildmasterThread(threadId)))
          return { isError: true, text: "Only the Guildmaster reads another quest's journal." };
        const sql = yield* SqlClient.SqlClient;
        const rows = yield* sql<{ id: string }>`SELECT m.id FROM missions m JOIN threads top ON top.id = m.top_thread_id
          WHERE m.id = ${mission} AND m.is_guildmaster = 0 AND top.is_deleting = 0`;
        if (rows.length === 0) return { isError: true, text: "No such quest." };
        return { isError: false, text: yield* readJournalText(threadId, before ?? null, count ?? null, mission) };
      }),
    );
  },
  update_journal: (threadId, { basedOn, briefing, entry }) => {
    const rewrite = briefing === undefined ? null : { basedOn: basedOn ?? null, briefing };
    return commit(
      Effect.gen(function* () {
        if (yield* isAside(threadId)) return { _tag: "Aside" } as const;
        const missionId = yield* missionOf(threadId);
        return yield* updateJournal(missionId, { kind: "thread", threadId }, entry, rewrite);
      }),
    ).pipe(
      Effect.map(
        (outcome): ToolAnswer =>
          Match.valueTags(outcome, {
            Aside: () => ({
              isError: true,
              text: "Not recorded: an aside does not update the journal. Send your parent a thread message with what is relevant; it decides what to record.",
            }),
            Recorded: (recorded) => ({
              isError: false,
              text: `Recorded entry ${recorded.number}. The briefing is at version ${recorded.version}.`,
            }),
            Refused: (refused) => ({
              isError: true,
              text:
                refused.reason === "Stale"
                  ? `${refused.text}\n\n${journalTextOf(refused, [])}`
                  : `${refused.text} The current briefing is at version ${refused.version}.`,
            }),
          }),
      ),
    );
  },
});
