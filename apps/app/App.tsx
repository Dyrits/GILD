import type { MissionId } from "@openmission/contracts";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ServiceClient } from "./src/client";
import { Conversation, Dashboard, SettingsScreen } from "./src/screens";

export default function App() {
  const [client, setClient] = useState<ServiceClient>();
  const [failure, setFailure] = useState<string>();
  const [openMission, setOpenMission] = useState<MissionId>();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    ServiceClient.connect().then(setClient, (error: Error) => setFailure(error.message));
  }, []);

  if (client === undefined) {
    return (
      <View style={styles.center}>
        <Text>{failure ?? "Connecting to the local service…"}</Text>
      </View>
    );
  }
  if (showSettings) return <SettingsScreen client={client} onBack={() => setShowSettings(false)} />;
  return openMission === undefined ? (
    <Dashboard client={client} onOpen={setOpenMission} onSettings={() => setShowSettings(true)} />
  ) : (
    <Conversation client={client} missionId={openMission} onBack={() => setOpenMission(undefined)} />
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center" } });
