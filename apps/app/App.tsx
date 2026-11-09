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
import { SettingsScreen } from "./src/settings";
import { type Place, Shell } from "./src/sidebar";
import { colors, fontSizes, fonts } from "./src/theme";

/** The sidebar place the open screen belongs to; the Permissions page belongs to Settings. */
const placeOf = (open: { isArchivedOpen: boolean; isIntelOpen: boolean; isSettingsOpen: boolean }): Place => {
  if (open.isSettingsOpen) return "Settings";
  if (open.isIntelOpen) return "Intel";
  if (open.isArchivedOpen) return "Archived";
  return "Control";
};

export default function App() {
  const [client, setClient] = useState<ServiceClient | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [openMission, setOpenMission] = useState<MissionId | null>(null);
  const { width } = useWindowDimensions();
  const isDocked = width >= 1280 && openMission !== null;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [isIntelOpen, setIsIntelOpen] = useState(false);
  // The workspace whose board Control shows, or null for every mission.
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | null>(null);
  // Counts openings from the sidebar, so choosing the open mission again goes back to its threads.
  const [openCount, setOpenCount] = useState(0);
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
  const goTo = (place: Place) => {
    setOpenMission(null);
    setIsPermissionsOpen(false);
    setIsIntelOpen(place === "Intel");
    setIsArchivedOpen(place === "Archived");
    setIsSettingsOpen(place === "Settings");
    if (place === "Control") setWorkspaceId(null);
  };
  const openWorkspace = (id: WorkspaceId) => {
    goTo("Control");
    setWorkspaceId(id);
  };
  const openMissionFromAnywhere = (id: MissionId) => {
    setOpenMission(null);
    setIsPermissionsOpen(false);
    setIsIntelOpen(false);
    setIsArchivedOpen(false);
    setIsSettingsOpen(false);
    setOpenMission(id);
    setOpenCount(openCount + 1);
  };
  const place = placeOf({ isArchivedOpen, isIntelOpen, isSettingsOpen: isSettingsOpen || isPermissionsOpen });
  const content = isIntelOpen ? (
    <IntelScreen client={client} onBack={() => setIsIntelOpen(false)} threadId={null} title="All lore" />
  ) : isPermissionsOpen ? (
    <PermissionsScreen client={client} onBack={() => setIsPermissionsOpen(false)} />
  ) : isSettingsOpen ? (
    <SettingsScreen
      client={client}
      onBack={() => setIsSettingsOpen(false)}
      onPermissions={() => setIsPermissionsOpen(true)}
    />
  ) : openMission === null ? (
    <Dashboard
      client={client}
      isArchived={isArchivedOpen}
      key={isArchivedOpen ? "archived" : "missions"}
      onArchived={() => setIsArchivedOpen(true)}
      onBack={() => setIsArchivedOpen(false)}
      onIntel={() => setIsIntelOpen(true)}
      onOpen={setOpenMission}
      onSettings={() => setIsSettingsOpen(true)}
      onWorkspace={setWorkspaceId}
      workspaceId={workspaceId}
    />
  ) : (
    <Conversation
      client={client}
      key={`${openMission}:${openCount}`}
      missionId={openMission}
      onBack={() => setOpenMission(null)}
      onOpenMission={setOpenMission}
    />
  );
  return (
    <Shell
      client={client}
      onOpenMission={openMissionFromAnywhere}
      onPlace={goTo}
      onWorkspace={openWorkspace}
      openMission={openMission}
      place={place}
      workspaceId={workspaceId}
    >
      <View style={{ flex: 1, flexDirection: "row" }}>
        {isDocked && (
          <View style={{ flex: 1, minWidth: 0 }}>
            <Dashboard
              client={client}
              isArchived={false}
              onArchived={() => goTo("Archived")}
              onBack={() => setOpenMission(null)}
              onIntel={() => goTo("Intel")}
              onOpen={setOpenMission}
              onSettings={() => goTo("Settings")}
              onWorkspace={(id) => {
                setWorkspaceId(id);
                setOpenMission(null);
              }}
              workspaceId={workspaceId}
            />
          </View>
        )}
        <View style={isDocked ? { width: 540 } : { flex: 1, minWidth: 0 }}>{content}</View>
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", backgroundColor: colors.frame, flex: 1, justifyContent: "center" },
  connecting: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base },
});
