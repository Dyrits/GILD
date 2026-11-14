import type { MissionId, ThreadId } from "@iskios/contracts";
import type { ReactNode } from "react";
import { Conversation } from "../conversation/conversation";
import { GuildmasterScreen } from "../conversation/guildmaster";
import { PermissionsScreen } from "../editors/permissions";
import type { ServiceClient } from "../foundation/client";
import { LoreScreen } from "../lore/lore";
import { RitualsScreen } from "../rituals/rituals";
import { SettingsScreen } from "../settings/settings";
import type { SettingsSectionId } from "../settings/settingsSections";
import { ArchiveScreen } from "./archivePage";
import { Dashboard } from "./dashboard";
import { UnbuiltScreen } from "./places";
import { QuestListScreen } from "./questListPage";
import type { RealmListing } from "./questTree";
import { RealmsScreen } from "./realmsPage";
import type { Place } from "./sidebar";
import { UsageScreen } from "./usagePage";

/** The selected destination and its page-owned selection, without connection or frame state. */
type Destination = {
  isPermissionsOpen: boolean;
  listedRealm: RealmListing | null;
  openCount: number;
  openMission: MissionId | null;
  openThread: ThreadId | null;
  place: Place;
  selectedMission: MissionId | null;
  settingsSection: SettingsSectionId;
};

/** Navigation operations exposed to the selected page, with top-level state kept in App. */
interface Navigation {
  closeMission: () => void;
  goTo: (place: Place) => void;
  openMission: (id: MissionId) => void;
  openRealm: (realm: RealmListing) => void;
  openThread: (missionId: MissionId, threadId: ThreadId) => void;
  selectMission: (id: MissionId | null) => void;
  selectThread: (id: ThreadId | null) => void;
  setGuildmasterRealm: (path: string | null) => void;
  setPermissions: (isOpen: boolean) => void;
  setSettingsSection: (section: SettingsSectionId) => void;
  showDetails: (isOpen: boolean) => void;
}

/** Exhaustive destination rendering; adding a place requires choosing its screen at compile time. */
export function AppScreen({
  client,
  navigation,
  view,
}: {
  client: ServiceClient;
  navigation: Navigation;
  view: Destination;
}) {
  if (view.openMission !== null)
    return (
      <Conversation
        client={client}
        key={`${view.openMission}:${view.openCount}`}
        missionId={view.openMission}
        onBack={navigation.closeMission}
        onOpenMission={navigation.openMission}
        onSelectThread={navigation.selectThread}
        onSetDetails={navigation.showDetails}
        selectedThreadId={view.openThread}
      />
    );
  const quests = (listing: RealmListing | null) => (
    <QuestListScreen
      client={client}
      listing={listing}
      onOpen={navigation.openMission}
      onOpenThread={navigation.openThread}
    />
  );
  const screens = {
    Archived: <ArchiveScreen client={client} onOpen={navigation.openMission} />,
    Borderlands: quests(null),
    Charter: <UnbuiltScreen place="Charter" />,
    Craft: <UnbuiltScreen place="Craft" />,
    Guildmaster: (
      <GuildmasterScreen
        client={client}
        onOpenMission={navigation.openMission}
        onViewAll={() => navigation.goTo("Quests")}
      />
    ),
    Library: <UnbuiltScreen place="Library" />,
    Lore: <LoreScreen client={client} onBack={() => navigation.goTo("Guildmaster")} threadId={null} title="All lore" />,
    Quests: (
      <Dashboard
        client={client}
        isArchived={false}
        key={view.place}
        onArchived={() => navigation.goTo("Archived")}
        onBack={() => navigation.goTo("Guildmaster")}
        onLore={() => navigation.goTo("Lore")}
        onOpen={navigation.openMission}
        onSelect={navigation.selectMission}
        onSendToGuildmaster={(path) => {
          navigation.goTo("Guildmaster");
          navigation.setGuildmasterRealm(path);
        }}
        onSettings={() => navigation.goTo("Settings")}
        selectedId={view.selectedMission}
        workspaceId={null}
      />
    ),
    RealmQuests: quests(view.listedRealm),
    Realms: (
      <RealmsScreen
        client={client}
        onOpen={navigation.openMission}
        onOpenRealm={navigation.openRealm}
        onOpenThread={navigation.openThread}
      />
    ),
    Reserves: <UsageScreen client={client} />,
    Rituals: <RitualsScreen client={client} onOpen={navigation.openMission} />,
    Settings: view.isPermissionsOpen ? (
      <PermissionsScreen client={client} onBack={() => navigation.setPermissions(false)} />
    ) : (
      <SettingsScreen
        active={view.settingsSection}
        client={client}
        onBack={() => navigation.goTo("Guildmaster")}
        onPermissions={() => navigation.setPermissions(true)}
        onSection={navigation.setSettingsSection}
      />
    ),
  } satisfies Record<Place, ReactNode>;
  return screens[view.place];
}
