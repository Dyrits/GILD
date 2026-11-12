import type { MissionId, ThreadId } from "@iskios/contracts";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Conversation } from "./src/conversation/conversation";
import { GuildmasterScreen } from "./src/conversation/guildmaster";
import { PermissionsScreen } from "./src/editors/permissions";
import { applyAppearance, rememberPlace, resumedPlace } from "./src/foundation/colorScheme";
import { ActiveHostContext, HostMenuContext } from "./src/foundation/hostContext";
import { colors, fontSizes, fonts } from "./src/foundation/theme";
import { useHostConnection } from "./src/foundation/useHostConnection";
import { LoreScreen } from "./src/lore/lore";
import { RitualsScreen } from "./src/rituals/rituals";
import { SettingsScreen } from "./src/settings/settings";
import { AddHostModal } from "./src/shell/addHostModal";
import { Dashboard } from "./src/shell/dashboard";
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
  // The realm chosen for the Guildmaster's next message: from a realm's page.
  const [guildmasterRealm, setGuildmasterRealm] = useState<string | null>(null);
  // Counts openings from the sidebar, so choosing the open mission again goes back to its threads.
  const [openCount, setOpenCount] = useState(0);
  // The quest's side panel starts open on a wide window; the top bar's icon shows or hides it.
  const { width } = useWindowDimensions();
  const [areDetailsOpen, setAreDetailsOpen] = useState(width >= 1280);
  useAttentionNotice(client);

  useEffect(() => rememberPlace(place), [place]);
  // The browser's own chrome, the page behind the app, and the Dock's icon follow the theme and look in use.
  useEffect(() => applyAppearance(colors.ground), []);
  // With the Guildmaster hidden in the Charter, the window opens on the Rituals instead.
  useEffect(() => {
    client
      ?.request({ _tag: "ReadSettings" })
      .then((settings) => {
        if (!settings.shouldShowGuildmaster) setPlace((current) => (current === "Guildmaster" ? "Rituals" : current));
      })
      .catch(() => {});
  }, [client]);

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
    if (id !== null) setAreDetailsOpen(true);
  };
  // The quest board always has its panel open, with the overview when no quest is chosen.
  const isBoard = openMission === null && place === "Quests";
  const content =
    openMission !== null ? (
      <Conversation
        client={client}
        key={`${openMission}:${openCount}`}
        missionId={openMission}
        onBack={() => setOpenMission(null)}
        onOpenMission={openMissionFromAnywhere}
        onSelectThread={setOpenThread}
        onSetDetails={setAreDetailsOpen}
        selectedThreadId={openThread}
      />
    ) : place === "Lore" ? (
      <LoreScreen client={client} onBack={() => goTo("Guildmaster")} threadId={null} title="All lore" />
    ) : place === "Settings" && isPermissionsOpen ? (
      <PermissionsScreen client={client} onBack={() => setIsPermissionsOpen(false)} />
    ) : place === "Settings" ? (
      <SettingsScreen
        client={client}
        onBack={() => goTo("Guildmaster")}
        onPermissions={() => setIsPermissionsOpen(true)}
      />
    ) : place === "Guildmaster" ? (
      <GuildmasterScreen client={client} onOpenMission={openMissionFromAnywhere} onViewAll={() => goTo("Quests")} />
    ) : place === "Borderlands" ? (
      <QuestListScreen client={client} listing={null} onOpen={openMissionFromAnywhere} onOpenThread={openSideQuest} />
    ) : place === "RealmQuests" ? (
      <QuestListScreen
        client={client}
        listing={listedRealm}
        onOpen={openMissionFromAnywhere}
        onOpenThread={openSideQuest}
      />
    ) : place === "Rituals" ? (
      <RitualsScreen client={client} onOpen={openMissionFromAnywhere} />
    ) : place === "Charter" || place === "Craft" || place === "Library" || place === "Realms" ? (
      <UnbuiltScreen place={place} />
    ) : place === "Reserves" ? (
      <UsageScreen client={client} />
    ) : (
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
  const shell = (
    <Shell
      client={client}
      details={
        isBoard
          ? { isOpen: true, isPinned: true, onToggle: () => {} }
          : openMission === null && selectedMission === null && !(place === "RealmQuests" && listedRealm !== null)
            ? null
            : { isOpen: areDetailsOpen, onToggle: () => setAreDetailsOpen(!areDetailsOpen) }
      }
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
    >
      {content}
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

const styles = StyleSheet.create({
  backButton: { marginTop: 16 },
  backText: { color: colors.highlight, fontSize: fontSizes.md, textDecorationLine: "underline" },
  banner: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderBottomColor: colors.danger,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bannerLink: { color: colors.highlight, fontSize: fontSizes.md, textDecorationLine: "underline" },
  bannerText: { color: colors.dangerText, flex: 1, fontSize: fontSizes.md },
  center: { alignItems: "center", backgroundColor: colors.frame, flex: 1, justifyContent: "center" },
  connecting: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base },
  root: { flex: 1 },
});
