import type { MissionId } from "@canopy/contracts";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ServiceClient } from "./src/client";
import { Conversation } from "./src/conversation";
import { Dashboard } from "./src/dashboard";
import { IntelScreen } from "./src/intel";
import { useAttentionNotice } from "./src/notifications";
import { PermissionsScreen } from "./src/permissions";
import { SettingsScreen } from "./src/settings";
import { type Place, Shell } from "./src/sidebar";
import { colors, fontSizes, fonts } from "./src/theme";

export default function App() {
  const [client, setClient] = useState<ServiceClient | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [openMission, setOpenMission] = useState<MissionId | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [isIntelOpen, setIsIntelOpen] = useState(false);
  // Counts openings from the sidebar, so choosing the open mission again goes back to its threads.
  const [openCount, setOpenCount] = useState(0);
  useAttentionNotice(client);

  useEffect(() => {
    ServiceClient.connect().then(setClient, (error: Error) => setFailure(error.message));
  }, []);

  if (client === null) {
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
  };
  const openMissionFromAnywhere = (id: MissionId) => {
    goTo("Missions");
    setOpenMission(id);
    setOpenCount(openCount + 1);
  };
  const place: Place =
    isSettingsOpen || isPermissionsOpen ? "Settings" : isIntelOpen ? "Intel" : isArchivedOpen ? "Archived" : "Missions";
  const content = isIntelOpen ? (
    <IntelScreen client={client} onBack={() => setIsIntelOpen(false)} threadId={null} title="All intel" />
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
      onNewMission={() => goTo("Missions")}
      onOpenMission={openMissionFromAnywhere}
      onPlace={goTo}
      openMission={openMission}
      place={place}
    >
      {content}
    </Shell>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", backgroundColor: colors.frame, flex: 1, justifyContent: "center" },
  connecting: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base },
});
