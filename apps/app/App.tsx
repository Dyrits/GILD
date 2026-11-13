import type { MissionId, ThreadId } from "@iskios/contracts";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Conversation } from "./src/conversation/conversation";
import { GuildmasterScreen } from "./src/conversation/guildmaster";
import { PermissionsScreen } from "./src/editors/permissions";
import { applyAppearance, rememberPlace, resumedPlace } from "./src/foundation/colorScheme";
import { ActiveHostContext, HostMenuContext } from "./src/foundation/hostContext";
import { colors } from "./src/foundation/theme";
import { useHostConnection } from "./src/foundation/useHostConnection";
import { useRightPanel } from "./src/foundation/useRightPanel";
import { LoreScreen } from "./src/lore/lore";
import { RitualsScreen } from "./src/rituals/rituals";
import { SettingsScreen } from "./src/settings/settings";
import type { SettingsSectionId } from "./src/settings/settingsSections";
import { AddHostModal } from "./src/shell/addHostModal";
import { appStyles as styles } from "./src/shell/appStyles";
import { Dashboard } from "./src/shell/dashboard";
import { detailsModeOf } from "./src/shell/navigation";
import { useAttentionNotice } from "./src/shell/notifications";
import { UnbuiltScreen } from "./src/shell/places";
import { QuestListScreen } from "./src/shell/questListPage";
import type { RealmListing } from "./src/shell/questTree";
import { Shell } from "./src/shell/shell";
import type { Place } from "./src/shell/sidebar";
import { UsageScreen } from "./src/shell/usagePage";

/** The pages a reload for a change of look returns to: those that need nothing else open to show. */
const resumablePlaces: readonly Place[] = [
  "Archived",
  "Craft",
  "Guildmaster",
  "Library",
  "Lore",
  "Quests",
  "Reserves",
  "Rituals",
  "Settings",
];

export default function App() {
  const {
    localClient,
    hostId,
    setHostId,
    hostClient,
    hosts,
    computerName,
    isAddingHost,
    setIsAddingHost,
    linkFailure,
    client,
    failure,
    setFailure,
    activeHost,
  } = useHostConnection();
  const [openMission, setOpenMission] = useState<MissionId | null>(null);
  // The place the rail leads to; a quest, when one is open, shows in its stead.
  const [place, setPlace] = useState<Place>(
    () => resumablePlaces.find((resumable) => resumable === resumedPlace) ?? "Guildmaster",
  );
  // The realm or Free Realm whose quests the quest list page shows.
  const [listedRealm, setListedRealm] = useState<RealmListing | null>(null);
  // The quest picked on the board, shown in the side panel without opening it.
  const [selectedMission, setSelectedMission] = useState<MissionId | null>(null);
  // The side-quest open in the open quest, chosen in the sidebar or the conversation; null for the quest itself.
  const [openThread, setOpenThread] = useState<ThreadId | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>("permissions");
  // The realm chosen for the Guildmaster's next message: from a realm's page.
  const [guildmasterRealm, setGuildmasterRealm] = useState<string | null>(null);
  // Counts openings from the sidebar, so choosing the open mission again goes back to its threads.
  const [openCount, setOpenCount] = useState(0);
  const rightPanel = useRightPanel(hostId, {
    isPermissionsOpen,
    openCount,
    openMission,
    openThread,
    place,
    realm: place === "RealmQuests" ? (listedRealm?.id ?? null) : null,
    section: place === "Settings" ? settingsSection : null,
  });
  useAttentionNotice(client);

  useEffect(() => rememberPlace(place), [place]);
  // The browser's own chrome, the page behind the app, and the Dock's icon follow the theme and look in use.
  useEffect(() => applyAppearance(colors.ground), []);
  const hostMenu = useMemo(
    () => ({
      activeId: hostId,
      computerName,
      hosts,
      onAdd: () => setIsAddingHost(true),
      onChoose: (next: string | null) => {
        // Another computer's quests are not this one's: nothing open stays open.
        setOpenMission(null);
        setOpenThread(null);
        setSelectedMission(null);
        setListedRealm(null);
        setIsPermissionsOpen(false);
        setFailure(null);
        setHostId(next);
      },
    }),
    [computerName, hostId, hosts, setFailure, setHostId, setIsAddingHost],
  );
  if (client === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.connecting}>
          {failure ?? (hostId === null ? "Connecting to the local service…" : `Connecting to ${activeHost.name}…`)}
        </Text>
        {hostId !== null && (
          <Pressable accessibilityRole="button" onPress={() => hostMenu.onChoose(null)} style={styles.backButton}>
            <Text style={styles.backText}>Back to this computer</Text>
          </Pressable>
        )}
      </View>
    );
  }
  // The sidebar leads to one place at a time: going there closes whatever else is open.
  const goTo = (next: Place) => {
    setSettingsSection("permissions");
    setOpenMission(null);
    setOpenThread(null);
    setSelectedMission(null);
    setIsPermissionsOpen(false);
    setPlace(next);
  };
  const openMissionFromAnywhere = (id: MissionId) => {
    setIsPermissionsOpen(false);
    setSelectedMission(null);
    setOpenMission(id);
    setOpenThread(null);
    setOpenCount(openCount + 1);
  };
  // A side-quest of the quest already open shows in place; one of another quest opens that quest on it.
  const openSideQuest = (missionId: MissionId, threadId: ThreadId) => {
    setIsPermissionsOpen(false);
    setSelectedMission(null);
    if (missionId !== openMission) {
      setOpenMission(missionId);
      setOpenCount(openCount + 1);
    }
    setOpenThread(threadId);
  };
  const selectMission = (id: MissionId | null) => {
    setSelectedMission(id);
    rightPanel.show(id === null ? null : { tab: "quest" });
  };
  const screen = () => {
    if (openMission !== null) {
      return (
        <Conversation
          client={client}
          key={`${openMission}:${openCount}`}
          missionId={openMission}
          onBack={() => setOpenMission(null)}
          onOpenMission={openMissionFromAnywhere}
          onSelectThread={setOpenThread}
          onSetDetails={(isOpen) => rightPanel.show(isOpen ? { tab: "quest" } : null)}
          selectedThreadId={openThread}
        />
      );
    }
    switch (place) {
      case "Lore":
        return <LoreScreen client={client} onBack={() => goTo("Guildmaster")} threadId={null} title="All lore" />;
      case "Settings":
        return isPermissionsOpen ? (
          <PermissionsScreen client={client} onBack={() => setIsPermissionsOpen(false)} />
        ) : (
          <SettingsScreen
            active={settingsSection}
            client={client}
            onBack={() => goTo("Guildmaster")}
            onPermissions={() => setIsPermissionsOpen(true)}
            onSection={setSettingsSection}
          />
        );
      case "Guildmaster":
        return (
          <GuildmasterScreen client={client} onOpenMission={openMissionFromAnywhere} onViewAll={() => goTo("Quests")} />
        );
      case "Borderlands":
        return (
          <QuestListScreen
            client={client}
            listing={null}
            onOpen={openMissionFromAnywhere}
            onOpenThread={openSideQuest}
          />
        );
      case "RealmQuests":
        return (
          <QuestListScreen
            client={client}
            listing={listedRealm}
            onOpen={openMissionFromAnywhere}
            onOpenThread={openSideQuest}
          />
        );
      case "Rituals":
        return <RitualsScreen client={client} onOpen={openMissionFromAnywhere} />;
      case "Charter":
      case "Craft":
      case "Library":
      case "Realms":
        return <UnbuiltScreen place={place} />;
      case "Reserves":
        return <UsageScreen client={client} />;
      default:
        return (
          <Dashboard
            client={client}
            isArchived={place === "Archived"}
            key={place}
            onArchived={() => goTo("Archived")}
            onBack={() => goTo("Guildmaster")}
            onLore={() => goTo("Lore")}
            onOpen={openMissionFromAnywhere}
            onSelect={selectMission}
            onSendToGuildmaster={(path) => {
              goTo("Guildmaster");
              setGuildmasterRealm(path);
            }}
            onSettings={() => goTo("Settings")}
            selectedId={selectedMission}
            workspaceId={null}
          />
        );
    }
  };
  const detailsMode = detailsModeOf({ hasListedRealm: listedRealm !== null, openMission, place, selectedMission });
  const details =
    detailsMode === "toggle"
      ? {
          isOpen: rightPanel.content?.tab === "quest",
          onToggle: () => rightPanel.show(rightPanel.content?.tab === "quest" ? null : { tab: "quest" }),
        }
      : null;
  const shell = (
    <Shell
      client={client}
      details={details}
      iskios={{ onRealm: setGuildmasterRealm, realmPath: guildmasterRealm }}
      listedRealm={listedRealm}
      onOpenMission={openMissionFromAnywhere}
      onOpenRealmQuests={(listing) => {
        setListedRealm(listing);
        goTo("RealmQuests");
      }}
      onOpenThread={openSideQuest}
      onPlace={goTo}
      openMission={openMission}
      openThread={openThread}
      place={place}
      rightPanel={rightPanel}
    >
      {screen()}
    </Shell>
  );
  return (
    <ActiveHostContext.Provider value={activeHost}>
      <HostMenuContext.Provider value={localClient === null ? null : hostMenu}>
        <View style={styles.root}>
          {hostId !== null && linkFailure !== null && (
            <View accessibilityRole="alert" style={styles.banner}>
              <Text numberOfLines={2} style={styles.bannerText}>
                {activeHost.name}: {linkFailure}
                {hostClient?.hasGivenUp === true ? "" : " Trying again…"}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => hostMenu.onChoose(null)}>
                <Text style={styles.bannerLink}>Use this computer</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.root}>{shell}</View>
        </View>
        {isAddingHost && localClient !== null && (
          <AddHostModal
            computerName={computerName}
            onCancel={() => setIsAddingHost(false)}
            onPair={(code, deviceName) =>
              localClient.request({ _tag: "AddHost", code, deviceName }).then((host) => {
                setIsAddingHost(false);
                hostMenu.onChoose(host.id);
                return host;
              })
            }
          />
        )}
      </HostMenuContext.Provider>
    </ActiveHostContext.Provider>
  );
}
