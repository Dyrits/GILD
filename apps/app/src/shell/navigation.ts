import type { Place } from "./sidebar";

/** Destinations a look reload can resume without a selected quest or realm. */
export const resumablePlaces: readonly Place[] = [
  "Archived",
  "Craft",
  "Guildmaster",
  "Library",
  "Lore",
  "Quests",
  "Realms",
  "Reserves",
  "Rituals",
  "Settings",
];

/** Returns to the archived quest's actual parent, not the screen it happened to be opened from. */
export const archiveParentOf = <Id extends string>(quest: { workspaceId: Id | null; workspaceName: string | null }) =>
  quest.workspaceId === null
    ? { listing: null, place: "Borderlands" as const }
    : { listing: { id: quest.workspaceId, name: quest.workspaceName ?? "Realm" }, place: "RealmQuests" as const };

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
