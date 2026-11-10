import type { MissionId, MissionSummary } from "@gild/contracts";

/**
 * The quests the rail lists: finished (Done) ones only when the Charter says so, or while the owner has one open, so the
 * rail still shows where they are. The board lists every quest whatever this says.
 */
export const railQuestsOf = (
  missions: ReadonlyArray<MissionSummary>,
  options: { readonly openMission: MissionId | null; readonly shouldShowFinished: boolean },
) =>
  missions.filter(
    (mission) => options.shouldShowFinished || mission.state !== "Done" || mission.id === options.openMission,
  );
