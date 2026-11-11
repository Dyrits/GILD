import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import { refuseGuildmaster } from "./guildmaster.ts";
import type { ToolHandlers } from "./threadTools.ts";

/** The title of a quest or thread whose first message holds only images. */
export const attachmentsTitle = "Attached images";

/** The title of a quest started without a message, until its first message names it. */
export const newQuestTitle = "New quest";

/** A title from a text: its first line, trimmed, at most 200 characters. */
export const titleOf = (text: string) => text.trim().split("\n", 1)[0]?.trim().slice(0, 200) ?? "";

/** Sets the mission's title and its top thread's, which follows it. Callers run it in a transaction. */
const writeTitle = (missionId: string, title: string, isByUser: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE missions SET title = ${title}, is_title_by_user = ${isByUser ? 1 : sql`is_title_by_user`}
      WHERE id = ${missionId}`;
    yield* sql`UPDATE threads SET title = ${title} WHERE id = (SELECT top_thread_id FROM missions WHERE id = ${missionId})`;
  });

/**
 * Names a quest still called "New quest" after the first message sent to its top thread, as a quest started with a message
 * is named. Callers run it in a transaction.
 */
export const nameNewQuest = (threadId: string, text: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [mission] = yield* sql<{ id: string }>`
      SELECT id FROM missions
      WHERE top_thread_id = ${threadId} AND title = ${newQuestTitle} AND is_title_by_user = 0 AND is_guildmaster = 0`;
    if (mission !== undefined) yield* writeTitle(mission.id, titleOf(text) || attachmentsTitle, false);
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
  yield* refuseGuildmaster(missionId, "renamed");
  yield* writeTitle(missionId, cleaned, true);
  return null;
});

/** Answers `set_mission_title`; `commit` runs a change in one transaction and announces it. */
export const titleToolsOf = (
  commit: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
): Pick<ToolHandlers, "set_mission_title"> => ({
  set_mission_title: (threadId, args) => {
    const title = titleOf(args.title);
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
