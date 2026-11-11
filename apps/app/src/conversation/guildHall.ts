import type { GuildHallRecap, MissionSummary } from "@iskios/contracts";
import { costTextOf, countedOf, tokenCountOf, totalTokensOf } from "../foundation/labels";

// The Guild Hall hub (quest coordination, Guild Hall as a hub): what waits for the owner, the quests touched last, and
// a recap of the period since the last visit. This is what the hub shows, apart from how it looks.

/** How many quests the hub lists as recent activity. */
const recentLimit = 5;

/** What a quest waits on the owner for, shown beside its title. */
export type WaitReason = "Failed" | "Needs your answer" | "Result to confirm";

export interface WaitingQuest {
  readonly mission: MissionSummary;
  readonly reason: WaitReason;
}

const reasonOf = (mission: MissionSummary): WaitReason | null =>
  mission.state === "Failed"
    ? "Failed"
    : mission.state === "Attention"
      ? "Needs your answer"
      : mission.prompt === "MarkDone"
        ? "Result to confirm"
        : null;

/** The quests that wait for the owner and the ones touched last, each newest first (a quest may be in both), and how many are underway. */
export const hubOf = (missions: ReadonlyArray<MissionSummary>) => {
  const newestFirst = missions.toSorted((a, b) => b.lastActivityAt - a.lastActivityAt);
  return {
    recent: newestFirst.slice(0, recentLimit),
    running: missions.filter((mission) => mission.state === "Running").length,
    waiting: newestFirst.flatMap((mission): WaitingQuest[] => {
      const reason = reasonOf(mission);
      return reason === null ? [] : [{ mission, reason }];
    }),
  };
};

/** The line over the hub: how many quests wait for the owner. */
export const heroOf = (waitingCount: number) =>
  waitingCount === 0
    ? "Nothing waits for you"
    : `${countedOf(waitingCount, "quest")} ${waitingCount === 1 ? "waits" : "wait"} for you`;

/** One figure of the hub's band: a big value beside a small label; its key picks the icon. */
export interface HubTile {
  readonly key: "finished" | "rituals" | "running" | "spent" | "waiting";
  readonly label: string;
  readonly value: string;
}

/** The band's first figures, about now: the quests that wait for the owner and the quests underway. */
export const nowOf = (waitingCount: number, running: number) =>
  [
    { key: "waiting", label: "waiting for you", value: String(waitingCount) },
    { key: "running", label: "underway", value: String(running) },
  ] satisfies ReadonlyArray<HubTile>;

/**
 * The recap's heading and its figures: quests finished, what the turns used (the cost, marked as an estimate where it
 * is one, else the tokens), and Ritual runs.
 */
export const recapOf = (recap: GuildHallRecap) => {
  const cost = costTextOf(recap.consumption);
  const tokens = totalTokensOf(recap.consumption);
  return {
    finishedHeading: recap.isFirstVisit ? "Finished in the last 24 hours" : "Finished since your last visit",
    heading: recap.isFirstVisit ? "In the last 24 hours" : "Since your last visit",
    tiles: [
      {
        key: "finished",
        label: recap.finishedCount === 1 ? "quest finished" : "quests finished",
        value: String(recap.finishedCount),
      },
      cost === null
        ? { key: "spent", label: "tokens used", value: tokenCountOf(tokens) }
        : { key: "spent", label: `${tokenCountOf(tokens)} tokens`, value: cost },
      { key: "rituals", label: recap.ritualRuns === 1 ? "Ritual run" : "Ritual runs", value: String(recap.ritualRuns) },
    ] satisfies ReadonlyArray<HubTile>,
  };
};
