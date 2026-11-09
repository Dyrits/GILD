import type { MissionId, WorkspaceId } from "@gild/contracts";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ServiceClient } from "./src/client";
import { Conversation } from "./src/conversation";
import { Dashboard } from "./src/dashboard";
import { IntelScreen } from "./src/intel";
import { useAttentionNotice } from "./src/notifications";
import { PermissionsScreen } from "./src/permissions";
import { GuildmasterScreen, KeepScreen, RealmsScreen } from "./src/places";
import { SettingsScreen } from "./src/settings";
import { type Place, Shell } from "./src/sidebar";
import { colors, fontSizes, fonts } from "./src/theme";

export default function App() {
  const [client, setClient] = useState<ServiceClient | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [openMission, setOpenMission] = useState<MissionId | null>(null);
  // The place the rail leads to; a quest, when one is open, shows in its stead.
  const [place, setPlace] = useState<Place>("Guildmaster");
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
    setIsPermissionsOpen(false);
    setPlace(next);
    if (next !== "Quests") setWorkspaceId(null);
  };
  const openWorkspace = (id: WorkspaceId) => {
    goTo("Quests");
    setWorkspaceId(id);
  };
  const openMissionFromAnywhere = (id: MissionId) => {
    setIsPermissionsOpen(false);
    setOpenMission(id);
    setOpenCount(openCount + 1);
  };
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
    ) : place === "Intel" ? (
      <IntelScreen client={client} onBack={() => goTo("Keep")} threadId={null} title="All lore" />
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
    ) : place === "Keep" ? (
      <KeepScreen client={client} onPlace={goTo} />
    ) : (
      <Dashboard
        client={client}
        isArchived={place === "Archived"}
        key={place}
        onArchived={() => goTo("Archived")}
        onBack={() => goTo("Keep")}
        onIntel={() => goTo("Intel")}
        onOpen={openMissionFromAnywhere}
        onSettings={() => goTo("Settings")}
        onWorkspace={(id) => (id === null ? goTo("Quests") : openWorkspace(id))}
        workspaceId={workspaceId}
      />
    );
  return (
    <Shell
      client={client}
      details={
        openMission === null ? null : { isOpen: areDetailsOpen, onToggle: () => setAreDetailsOpen(!areDetailsOpen) }
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
