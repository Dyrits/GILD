import type { MissionId, ThreadId } from "@iskios/contracts";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ArchiveNavigation } from "./src/foundation/archiveNavigation";
import { applyAppearance, rememberPlace, resumedPlace } from "./src/foundation/colorScheme";
import { ActiveHostContext, HostMenuContext } from "./src/foundation/hostContext";
import { colors } from "./src/foundation/theme";
import { useHostConnection } from "./src/foundation/useHostConnection";
import { useRightPanel } from "./src/foundation/useRightPanel";
import { type SettingsSectionId, settingsSectionOf } from "./src/settings/settingsSections";
import { AddHostModal } from "./src/shell/addHostModal";
import { AppScreen } from "./src/shell/appScreen";
import { appStyles as styles } from "./src/shell/appStyles";
import { archiveParentOf, detailsModeOf, resumablePlaces } from "./src/shell/navigation";
import { useAttentionNotice } from "./src/shell/notifications";
import type { RealmListing } from "./src/shell/questTree";
import { Shell } from "./src/shell/shell";
import type { Place } from "./src/shell/sidebar";

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
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>(() => settingsSectionOf(resumedPlace));
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
  const openRealm = (listing: RealmListing) => {
    setListedRealm(listing);
    goTo("RealmQuests");
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
      onOpenRealmQuests={openRealm}
      onOpenThread={openSideQuest}
      onPlace={goTo}
      openMission={openMission}
      openThread={openThread}
      place={place}
      rightPanel={rightPanel}
    >
      <AppScreen
        client={client}
        navigation={{
          closeMission: () => setOpenMission(null),
          goTo,
          openMission: openMissionFromAnywhere,
          openRealm,
          openThread: openSideQuest,
          selectMission,
          selectThread: setOpenThread,
          setGuildmasterRealm,
          setPermissions: setIsPermissionsOpen,
          setSettingsSection,
          showDetails: (isOpen) => rightPanel.show(isOpen ? { tab: "quest" } : null),
        }}
        view={{
          isPermissionsOpen,
          listedRealm,
          openCount,
          openMission,
          openThread,
          place,
          selectedMission,
          settingsSection,
        }}
      />
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
          <ArchiveNavigation.Provider
            value={{
              quest: (mission) => {
                const parent = archiveParentOf(mission);
                setListedRealm(parent.listing);
                goTo(parent.place);
              },
              realm: () => goTo("Realms"),
            }}
          >
            <View style={styles.root}>{shell}</View>
          </ArchiveNavigation.Provider>
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
