import type { MissionState } from "@gild/contracts";

/** The dashboard board's columns, left to right: what needs the owner first (art direction of 2026-11-08). */
export type BoardColumn = "Attention" | "Running" | "Idle" | "Done";

/** The board's columns in order. */
export const boardColumns: ReadonlyArray<BoardColumn> = ["Attention", "Running", "Idle", "Done"];

/**
 * The column each state sits in: a failed mission needs the owner as much as one in Attention; a mission Waiting
 * has a thread beneath at work, so it sits with Running; an Idle mission has no thread at work and waits for the
 * owner's next message or for being marked Done, so it has its own column. Archived missions have their own view
 * and never reach the board.
 */
const columnOfState = {
  Archived: "Done",
  Attention: "Attention",
  Done: "Done",
  Failed: "Attention",
  Idle: "Idle",
  Running: "Running",
  Waiting: "Running",
} as const satisfies Record<MissionState, BoardColumn>;

/** The column a state sits in, whose banner colors it. */
export const columnOf = (state: MissionState): BoardColumn => columnOfState[state];

/** The missions of each column, keeping their order; a mission with a dashboard prompt stays where its state puts it. */
export const boardOf = <M extends { readonly state: MissionState }>(
  missions: ReadonlyArray<M>,
): Record<BoardColumn, ReadonlyArray<M>> => ({
  Attention: missions.filter((mission) => columnOfState[mission.state] === "Attention"),
  Done: missions.filter((mission) => columnOfState[mission.state] === "Done"),
  Idle: missions.filter((mission) => columnOfState[mission.state] === "Idle"),
  Running: missions.filter((mission) => columnOfState[mission.state] === "Running"),
});

/** Whether a card names its state: only when the state is not the column's own name, such as Failed under Attention. */
export const isStateShownOn = (column: BoardColumn, state: MissionState) => state !== column;

/** The columns that grow without end, and so show only the quests touched today until the owner asks for the rest. */
export const trimmedColumns: ReadonlyArray<BoardColumn> = ["Idle", "Done"];

/** The start of `now`'s local day, in the milliseconds a mission's last activity is stamped with. */
const startOfDay = (now: number) => new Date(now).setHours(0, 0, 0, 0);

/**
 * Splits a trimmed column's missions into those shown at rest and those folded behind "earlier": the ones active
 * today, and any kept on view (the quest whose panel is open), in their order.
 */
export const splitEarlier = <M extends { readonly id: string; readonly lastActivityAt: number }>(
  missions: ReadonlyArray<M>,
  now: number,
  keepId: string | null,
): { earlier: ReadonlyArray<M>; shown: ReadonlyArray<M> } => {
  const today = startOfDay(now);
  const isShown = (mission: M) => mission.lastActivityAt >= today || mission.id === keepId;
  return { earlier: missions.filter((mission) => !isShown(mission)), shown: missions.filter(isShown) };
};
