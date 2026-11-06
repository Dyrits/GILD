import { Effect, Exit, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "./errors.ts";
import type { ToolAnswer } from "./journalTools.ts";
import { titleOf } from "./missions.ts";

/** Sets the mission's title and its top thread's, which follows it. Callers run it in a transaction. */
const writeTitle = (missionId: string, title: string, isByUser: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE missions SET title = ${title}, is_title_by_user = ${isByUser ? 1 : sql`is_title_by_user`}
      WHERE id = ${missionId}`;
    yield* sql`UPDATE threads SET title = ${title} WHERE id = (SELECT top_thread_id FROM missions WHERE id = ${missionId})`;
  });

/** Names a mission with a thread's proposed title, which the top thread may still change. Callers run it in a transaction. */
export const proposeTitle = (missionId: string, title: string) => writeTitle(missionId, titleOf(title), false);

/** The owner renames a mission; `set_mission_title` is refused from then on (mission-tracking, Title). */
export const renameMission = Effect.fn("renameMission")(function* (missionId: string, title: string) {
  const sql = yield* SqlClient.SqlClient;
  const cleaned = titleOf(title);
  if (cleaned === "") return yield* invalid("The title is empty.");
  const [mission] = yield* sql<{ id: string }>`SELECT id FROM missions WHERE id = ${missionId}`;
  if (mission === undefined) return yield* notFound("No such mission.");
  yield* writeTitle(missionId, cleaned, true);
  return null;
});

const SetMissionTitleArguments = Schema.Struct({ title: Schema.String });
const decodeSetMissionTitle = Schema.decodeUnknownExit(SetMissionTitleArguments);

/** The mission-tracking thread tool as MCP lists it (mission-tracking, External contract). */
export const titleToolDefinitions = [
  {
    description:
      "Name the mission. Only the mission's top thread uses it, on its first turn, with a short title of a few words.",
    inputSchema: {
      properties: { title: { description: "A short title of a few words.", type: "string" } },
      required: ["title"],
      type: "object",
    },
    name: "set_mission_title",
  },
];

/** Answers `set_mission_title`; `commit` runs a change in one transaction and announces it. */
export const titleToolsOf = (
  commit: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
): Record<string, (threadId: string, args: unknown) => Effect.Effect<ToolAnswer>> => ({
  set_mission_title: (threadId, args) => {
    const decoded = decodeSetMissionTitle(args);
    const title = Exit.isSuccess(decoded) ? titleOf(decoded.value.title) : "";
    if (title === "") return Effect.succeed({ isError: true, text: "Not named: give a title." });
    return commit(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const [mission] = yield* sql<{ id: string; isTitleByUser: number }>`
          SELECT id, is_title_by_user AS isTitleByUser FROM missions WHERE top_thread_id = ${threadId}`;
        if (mission === undefined)
          return { isError: true, text: "Not named: only the mission's top thread names the mission." };
        if (mission.isTitleByUser === 1)
          return { isError: true, text: "Not named: the owner named this mission, so its title stays." };
        yield* writeTitle(mission.id, title, false);
        return { isError: false, text: `Named the mission "${title}".` };
      }),
    );
  },
});
