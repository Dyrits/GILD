import type { MissionId, WorkspaceId } from "@gild/contracts";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ServiceClient } from "./src/client";
import { Conversation } from "./src/conversation";
import { Dashboard } from "./src/dashboard";
import { LoreScreen } from "./src/lore";
import { useAttentionNotice } from "./src/notifications";
import { PermissionsScreen } from "./src/permissions";
import { GuildmasterScreen, KeepScreen, RealmsScreen } from "./src/places";
import { RitualsScreen } from "./src/rituals";
import { SettingsScreen } from "./src/settings";
import { type Place, Shell } from "./src/sidebar";
import { colors, fontSizes, fonts } from "./src/theme";

export default function App() {
  const [client, setClient] = useState<ServiceClient | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [openMission, setOpenMission] = useState<MissionId | null>(null);
  // The place the rail leads to; a quest, when one is open, shows in its stead.
  const [place, setPlace] = useState<Place>("Guildmaster");
  // The quest picked on the board, shown in the side panel without opening it.
  const [selectedMission, setSelectedMission] = useState<MissionId | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  // The realm whose quests the Quests place shows, or null for every quest.
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | null>(null);
  // Counts openings from the sidebar, so choosing the open mission again goes back to its threads.
  const [openCount, setOpenCount] = useState(0);
  // The quest's side panel starts open on a wide window; the top bar's icon shows or hides it.
  const { width } = useWindowDimensions();
  const [areDetailsOpen, setAreDetailsOpen] = useState(width >= 1280);
  // Bundled fonts keep the board available offline without a heading jump during loading.
  const [areFontsLoaded, fontError] = useFonts({
    Alegreya: require("./assets/fonts/Alegreya.ttf"),
    Cinzel: require("./assets/fonts/Cinzel.ttf"),
  });
  useAttentionNotice(client);

  useEffect(() => {
    ServiceClient.connect().then(setClient, (error: Error) => setFailure(error.message));
  }, []);

  if (client === null || (!areFontsLoaded && fontError === null)) {
    return (
      <View style={styles.center}>
        <Text style={styles.connecting}>{failure ?? "Connecting to the local service…"}</Text>
      </View>
    );
  }
  // The sidebar leads to one place at a time: going there closes whatever else is open.
  const goTo = (next: Place) => {
    setOpenMission(null);
    setSelectedMission(null);
    setIsPermissionsOpen(false);
    setPlace(next);
    // Going to a place clears the realm filter, so Quests shows every quest; a realm sets it again right after.
    setWorkspaceId(null);
  };
  const openWorkspace = (id: WorkspaceId) => {
    goTo("Quests");
    setWorkspaceId(id);
  };
  const openMissionFromAnywhere = (id: MissionId) => {
    setIsPermissionsOpen(false);
    setSelectedMission(null);
    setOpenMission(id);
    setOpenCount(openCount + 1);
  };
  const selectMission = (id: MissionId | null) => {
    setSelectedMission(id);
    if (id !== null) setAreDetailsOpen(true);
  };
  // The quest board always has its panel open, with the overview when no quest is chosen.
  const isBoard = openMission === null && place === "Quests";
  // The Charter's guide is pinned open like the board's panel; the Permissions screen it leads to has none.
  const isCharter = openMission === null && place === "Settings" && !isPermissionsOpen;
  const content =
    openMission !== null ? (
      <Conversation
        client={client}
        key={`${openMission}:${openCount}`}
        missionId={openMission}
        onBack={() => setOpenMission(null)}
        onOpenMission={setOpenMission}
        onSetDetails={setAreDetailsOpen}
      />
    ) : place === "Lore" ? (
      <LoreScreen client={client} onBack={() => goTo("Keep")} threadId={null} title="All lore" />
    ) : place === "Settings" && isPermissionsOpen ? (
      <PermissionsScreen client={client} onBack={() => setIsPermissionsOpen(false)} />
    ) : place === "Settings" ? (
      <SettingsScreen
        client={client}
        onBack={() => goTo("Guildmaster")}
        onPermissions={() => setIsPermissionsOpen(true)}
      />
    ) : place === "Guildmaster" ? (
      <GuildmasterScreen client={client} onOpen={openMissionFromAnywhere} />
    ) : place === "Realms" ? (
      <RealmsScreen client={client} onWorkspace={openWorkspace} />
    ) : place === "Rituals" ? (
      <RitualsScreen client={client} onOpen={openMissionFromAnywhere} />
    ) : place === "Keep" ? (
      <KeepScreen client={client} onPlace={goTo} />
    ) : (
      <Dashboard
        client={client}
        isArchived={place === "Archived"}
        key={place}
        onArchived={() => goTo("Archived")}
        onBack={() => goTo("Keep")}
        onLore={() => goTo("Lore")}
        onOpen={openMissionFromAnywhere}
        onSelect={selectMission}
        onSettings={() => goTo("Settings")}
        selectedId={selectedMission}
        workspaceId={workspaceId}
      />
    );
  return (
    <Shell
      client={client}
      details={
        isBoard || isCharter
          ? { isOpen: true, isPinned: true, onToggle: () => {} }
          : openMission === null && selectedMission === null
            ? null
            : { isOpen: areDetailsOpen, onToggle: () => setAreDetailsOpen(!areDetailsOpen) }
      }
      onOpenMission={openMissionFromAnywhere}
      onPlace={goTo}
      onWorkspace={openWorkspace}
      openMission={openMission}
      place={place}
      workspaceId={workspaceId}
    >
      {content}
    </Shell>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", backgroundColor: colors.frame, flex: 1, justifyContent: "center" },
  connecting: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base },
});
