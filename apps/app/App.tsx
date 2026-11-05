import type { MissionId } from "@openmission/contracts";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ServiceClient } from "./src/client";
import { Conversation } from "./src/conversation";
import { Dashboard } from "./src/dashboard";
import { SettingsScreen } from "./src/settings";

export default function App() {
  const [client, setClient] = useState<ServiceClient | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [openMission, setOpenMission] = useState<MissionId | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
  if (isSettingsOpen) return <SettingsScreen client={client} onBack={() => setIsSettingsOpen(false)} />;
  return openMission === null ? (
    <Dashboard client={client} onOpen={setOpenMission} onSettings={() => setIsSettingsOpen(true)} />
  ) : (
    <Conversation client={client} missionId={openMission} onBack={() => setOpenMission(null)} />
  );
}

const styles = StyleSheet.create({ center: { alignItems: "center", flex: 1, justifyContent: "center" } });
