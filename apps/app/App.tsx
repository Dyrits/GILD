import type { MissionId, ThreadId, WorkspaceId } from "@iskios/contracts";
import { useEffect, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Conversation } from "./src/conversation/conversation";
import { GuildmasterScreen } from "./src/conversation/guildmaster";
import { PermissionsScreen } from "./src/editors/permissions";
import { ServiceClient } from "./src/foundation/client";
import { colors, fontSizes, fonts } from "./src/foundation/theme";
import { LoreScreen } from "./src/lore/lore";
import { RitualsScreen } from "./src/rituals/rituals";
import { SettingsScreen } from "./src/settings/settings";
import { Dashboard } from "./src/shell/dashboard";
import { useAttentionNotice } from "./src/shell/notifications";
import { UnbuiltScreen } from "./src/shell/places";
import { Shell } from "./src/shell/shell";
import type { Place } from "./src/shell/sidebar";

export default function App() {
  const [client, setClient] = useState<ServiceClient | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [openMission, setOpenMission] = useState<MissionId | null>(null);
  // The place the rail leads to; a quest, when one is open, shows in its stead.
  const [place, setPlace] = useState<Place>("Guildmaster");
  // The quest picked on the board, shown in the side panel without opening it.
  const [selectedMission, setSelectedMission] = useState<MissionId | null>(null);
  // The side-quest open in the open quest, chosen in the sidebar or the conversation; null for the quest itself.
  const [openThread, setOpenThread] = useState<ThreadId | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  // The realm chosen for the Guildmaster's next message: from its side panel, or from a realm's page.
  const [guildmasterRealm, setGuildmasterRealm] = useState<string | null>(null);
  // The realm whose quests the Quests place shows, or null for every quest.
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId | null>(null);
  // Counts openings from the sidebar, so choosing the open mission again goes back to its threads.
  const [openCount, setOpenCount] = useState(0);
  // The quest's side panel starts open on a wide window; the top bar's icon shows or hides it.
  const { width } = useWindowDimensions();
  const [areDetailsOpen, setAreDetailsOpen] = useState(width >= 1280);
  useAttentionNotice(client);

  useEffect(() => {
    ServiceClient.connect().then(setClient, (error: Error) => setFailure(error.message));
  }, []);
  // With the Guildmaster hidden in the Charter, the window opens on the Rituals instead.
  useEffect(() => {
    client
      ?.request({ _tag: "ReadSettings" })
      .then((settings) => {
        if (!settings.shouldShowGuildmaster) setPlace((current) => (current === "Guildmaster" ? "Rituals" : current));
      })
      .catch(() => {});
  }, [client]);

  if (client === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.connecting}>{failure ?? "Connecting to the local service…"}</Text>
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
  // The Charter's guide is pinned open like the board's panel; the Permissions screen it leads to has none.
  const isCharter = openMission === null && place === "Settings" && !isPermissionsOpen;
  // The Guildmaster's realm tiles stand in a pinned panel, as the board's overview does.
  const isGuildmaster = openMission === null && place === "Guildmaster";
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
      <GuildmasterScreen
        client={client}
        onOpenMission={openMissionFromAnywhere}
        onRealm={setGuildmasterRealm}
        realmPath={guildmasterRealm}
      />
    ) : place === "Rituals" ? (
      <RitualsScreen client={client} onOpen={openMissionFromAnywhere} />
    ) : place === "Craft" || place === "Library" || place === "Reserves" ? (
      <UnbuiltScreen place={place} />
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
        workspaceId={workspaceId}
      />
    );
  return (
    <Shell
      client={client}
      details={
        isBoard || isCharter || isGuildmaster
          ? { isOpen: true, isPinned: true, onToggle: () => {} }
          : openMission === null && selectedMission === null
            ? null
            : { isOpen: areDetailsOpen, onToggle: () => setAreDetailsOpen(!areDetailsOpen) }
      }
      onOpenMission={openMissionFromAnywhere}
      onOpenThread={openSideQuest}
      onPlace={goTo}
      onWorkspace={openWorkspace}
      openMission={openMission}
      openThread={openThread}
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
