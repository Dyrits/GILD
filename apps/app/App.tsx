import type { MissionId } from "@openmission/contracts";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ServiceClient } from "./src/client";
import { Conversation } from "./src/conversation";
import { Dashboard } from "./src/dashboard";
import { IntelScreen } from "./src/intel";
import { useAttentionNotice } from "./src/notifications";
import { PermissionsScreen } from "./src/permissions";
import { SettingsScreen } from "./src/settings";

export default function App() {
  const [client, setClient] = useState<ServiceClient | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [openMission, setOpenMission] = useState<MissionId | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [isIntelOpen, setIsIntelOpen] = useState(false);
  useAttentionNotice(client);

  useEffect(() => {
    ServiceClient.connect().then(setClient, (error: Error) => setFailure(error.message));
  }, []);

  if (client === null) {
    return (
      <View style={styles.center}>
        <Text>{failure ?? "Connecting to the local service…"}</Text>
      </View>
    );
  }
  if (isIntelOpen) {
    return <IntelScreen client={client} onBack={() => setIsIntelOpen(false)} threadId={null} title="All intel" />;
  }
  if (isPermissionsOpen) return <PermissionsScreen client={client} onBack={() => setIsPermissionsOpen(false)} />;
  if (isSettingsOpen) {
    return (
      <SettingsScreen
        client={client}
        onBack={() => setIsSettingsOpen(false)}
        onPermissions={() => setIsPermissionsOpen(true)}
      />
    );
  }
  return openMission === null ? (
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
      key={openMission}
      missionId={openMission}
      onBack={() => setOpenMission(null)}
      onOpenMission={setOpenMission}
    />
  );
}

const styles = StyleSheet.create({ center: { alignItems: "center", flex: 1, justifyContent: "center" } });
