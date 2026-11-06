import { Effect, Exit, Schema } from "effect";
import type { SqlClient } from "effect/sql";
import { journalTextOf, latestEntryCount, missionOf, readJournalText, updateJournal } from "./journal.ts";
import { isAside } from "./tree.ts";

/** A thread tool's answer before it is wrapped for MCP. */
export interface ToolAnswer {
  readonly isError: boolean;
  readonly text: string;
}

const ReadJournalArguments = Schema.Struct({
  before: Schema.optional(Schema.Int),
  count: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
});
const UpdateJournalArguments = Schema.Struct({
  basedOn: Schema.optional(Schema.Int),
  briefing: Schema.optional(Schema.String),
  entry: Schema.String,
});
const decodeReadJournal = Schema.decodeUnknownExit(ReadJournalArguments);
const decodeUpdateJournal = Schema.decodeUnknownExit(UpdateJournalArguments);

/** The journal's thread tools as MCP lists them (mission-journal, External contract). */
export const journalToolDefinitions = [
  {
    description: `Read the mission's journal: the briefing of where the mission stands, its version, and change log entries. Without arguments it gives the ${latestEntryCount} latest entries.`,
    inputSchema: {
      properties: {
        before: { description: "Only entries numbered below this one, to read older entries.", type: "integer" },
        count: { description: `How many entries, ${latestEntryCount} by default.`, type: "integer" },
      },
      type: "object",
    },
    name: "read_journal",
  },
  {
    description:
      "Record a change in the mission's journal: an entry when you settle a decision, change direction, or finish a piece of work. Rewrite the briefing only when where the mission stands has changed; every rewrite comes with an entry.",
    inputSchema: {
      properties: {
        basedOn: {
          description: "With briefing: the briefing version your rewrite starts from, as read_journal gave it.",
          type: "integer",
        },
        briefing: {
          description: "The whole new briefing of where the mission stands, short enough for its limit.",
          type: "string",
        },
        entry: { description: "One entry for the change log: what was decided, changed, or done.", type: "string" },
      },
      required: ["entry"],
      type: "object",
    },
    name: "update_journal",
  },
];

/** Answers the journal's thread tools; `commit` runs a change in one transaction and announces it. */
export const journalToolsOf = (
  commit: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
): Record<string, (threadId: string, args: unknown) => Effect.Effect<ToolAnswer>> => ({
  read_journal: (threadId, args) => {
    const decoded = decodeReadJournal(args);
    if (Exit.isFailure(decoded))
      return Effect.succeed({ isError: true, text: "Invalid arguments: before and count are whole numbers." });
    const { before, count } = decoded.value;
    return commit(readJournalText(threadId, before ?? null, count ?? null)).pipe(
      Effect.map((text) => ({ isError: false, text })),
    );
  },
  update_journal: (threadId, args) => {
    const decoded = decodeUpdateJournal(args);
    if (Exit.isFailure(decoded)) return Effect.succeed({ isError: true, text: "Invalid arguments: give entry." });
    const { basedOn, briefing, entry } = decoded.value;
    const rewrite = briefing === undefined ? null : { basedOn: basedOn ?? null, briefing };
    return commit(
      Effect.gen(function* () {
        if (yield* isAside(threadId)) return { _tag: "Aside" } as const;
        const missionId = yield* missionOf(threadId);
        return yield* updateJournal(missionId, { kind: "thread", threadId }, entry, rewrite);
      }),
    ).pipe(
      Effect.map((outcome) =>
        outcome._tag === "Aside"
          ? {
              isError: true,
              text: "Not recorded: an aside does not update the journal. Send your parent a thread message with what is relevant; it decides what to record.",
            }
          : outcome._tag === "Recorded"
            ? {
                isError: false,
                text: `Recorded entry ${outcome.number}. The briefing is at version ${outcome.version}.`,
              }
            : {
                isError: true,
                text:
                  outcome.reason === "Stale"
                    ? `${outcome.text}\n\n${journalTextOf(outcome, [])}`
                    : `${outcome.text} The current briefing is at version ${outcome.version}.`,
              },
      ),
    );
  },
});
