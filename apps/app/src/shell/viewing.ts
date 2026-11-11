import type { MissionId, Viewing } from "@iskios/contracts";
import type { Place } from "./sidebar";

// Where the owner has Iskios open from (quest coordination, Context): the screen's name as the owner knows it, and the
// quest when the screen is one. Iskios reads it with each message, to know what "this quest" or "this page" means.

/** The names of the screens, as the sidebar and the top bar call them. */
const screenNames: Record<Place, string> = {
  Archived: "Archive",
  Borderlands: "Borderlands quests",
  Charter: "Charter",
  Craft: "Craft",
  Guildmaster: "Guild Hall",
  Library: "Library",
  Lore: "Lore",
  Quests: "Quest board",
  RealmQuests: "Realm quests",
  Realms: "Realms",
  Reserves: "Reserves",
  Rituals: "Rituals",
  Settings: "Settings",
};

/** What Iskios is told: the quest that is open, else the screen. */
export const viewingOf = (
  place: Place | null,
  openMission: MissionId | null,
  listedRealmName: string | null,
): Viewing => {
  if (openMission !== null) return { missionId: openMission, screen: "Quest" };
  if (place === null) return { screen: "App" };
  return {
    screen: place === "RealmQuests" && listedRealmName !== null ? `Quests of ${listedRealmName}` : screenNames[place],
  };
};
