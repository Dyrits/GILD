import type { Place } from "./sidebar";

/** What the top bar's panel toggle does for the screen in view: nothing, a panel pinned open, or a panel the owner shows or hides. */
export type DetailsMode = "none" | "pinned" | "toggle";

/** Whether the quest board is in view, which always has its panel open. */
export const isBoardOf = (view: { openMission: string | null; place: Place }) =>
  view.openMission === null && view.place === "Quests";

/** The side panel's mode: pinned on the board, a toggle when a quest is open or chosen or a realm is listed, otherwise none. */
export const detailsModeOf = (view: {
  hasListedRealm: boolean;
  openMission: string | null;
  place: Place;
  selectedMission: string | null;
}): DetailsMode => {
  if (isBoardOf(view)) return "pinned";
  if (view.openMission !== null || view.selectedMission !== null) return "toggle";
  return view.place === "RealmQuests" && view.hasListedRealm ? "toggle" : "none";
};
