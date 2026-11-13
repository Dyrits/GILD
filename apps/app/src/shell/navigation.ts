import type { Place } from "./sidebar";

/** Whether the screen offers details the owner can explicitly open. */
export type DetailsMode = "none" | "toggle";

/** Offers details for an open or selected quest or a listed realm; no destination opens them automatically. */
export const detailsModeOf = (view: {
  hasListedRealm: boolean;
  openMission: string | null;
  place: Place;
  selectedMission: string | null;
}): DetailsMode => {
  if (view.openMission !== null || view.selectedMission !== null) return "toggle";
  return view.place === "RealmQuests" && view.hasListedRealm ? "toggle" : "none";
};
