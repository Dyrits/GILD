import { Effect, Match } from "effect";
import type { SqlClient } from "effect/sql";
import { journalTextOf, missionOf, readJournalText, updateJournal } from "./journal.ts";
import type { ToolAnswer, ToolHandlers } from "./threadTools.ts";
import { isAside } from "./tree.ts";

/** Answers the journal's thread tools; `commit` runs a change in one transaction and announces it. */
export const journalToolsOf = (
  commit: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
): Pick<ToolHandlers, "read_journal" | "update_journal"> => ({
  read_journal: (threadId, { before, count }) => {
    return commit(readJournalText(threadId, before ?? null, count ?? null)).pipe(
      Effect.map((text) => ({ isError: false, text })),
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
