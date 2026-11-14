import type { MissionId, ThreadId, WorkspaceId } from "@iskios/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CrestBadge } from "../crest/crest";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { NewRealmModal } from "../realms/newRealmModal";
import { realmLabelOf } from "../realms/realmLabels";
import { Button } from "../ui/button";
import { QuestTreeLines } from "./questListRows";
import { placementsOf, type RealmListing, toggledFold } from "./questTree";

/** The full compact overview grouped by active realm, including realms with no quest yet. */
export function RealmsScreen({
  client,
  onOpen,
  onOpenRealm,
  onOpenThread,
}: {
  client: ServiceClient;
  onOpen: (id: MissionId) => void;
  onOpenRealm: (realm: RealmListing) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const { data, error } = useServiceQuery(client, allMissions.request, `${allMissions.key}:${attempt}`);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [isCreating, setCreating] = useState(false);
  const [startingId, setStarting] = useState<WorkspaceId | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const start = async (realmId: WorkspaceId) => {
    if (startingId !== null) return;
    setStarting(realmId);
    try {
      const quest = await client.request({ _tag: "StartEmptyQuest", realmId, requestId: newRequestId() });
      onOpen(quest.missionId);
    } catch (reason) {
      setFailure(messageOf(reason));
    } finally {
      setStarting(null);
    }
  };
  const groups = placementsOf(data?.missions ?? [], data?.workspaces ?? []).realms;
  return (
    <View accessibilityLabel="Realms overview" style={local.page}>
      <ScrollView contentContainerStyle={local.content}>
        <View style={local.toolbar}>
          <Text style={styles.muted}>Quests by realm</Text>
          <Button label="New realm" onPress={() => setCreating(true)} />
        </View>
        {error !== null && (
          <View style={local.toolbar}>
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
            <Button label="Retry" onPress={() => setAttempt((current) => current + 1)} />
          </View>
        )}
        {failure !== null && (
          <Text accessibilityRole="alert" style={styles.error}>
            {failure}
          </Text>
        )}
        {data === null && error === null && <Text style={styles.muted}>Loading realms…</Text>}
        {data !== null && groups.length === 0 && (
          <Text style={styles.muted}>No active realm yet. Create one to group quests and share lore.</Text>
        )}
        {groups.map(({ workspace, quests }) => (
          <View key={workspace.id} style={local.group}>
            <View style={local.toolbar}>
              <Pressable
                accessibilityLabel={`Open ${workspace.name} overview`}
                accessibilityRole="button"
                onPress={() => onOpenRealm({ id: workspace.id, name: workspace.name })}
                style={local.realm}
              >
                <CrestBadge crest={workspace.crest} id={workspace.id} size={28} />
                <Text style={local.name}>{realmLabelOf(workspace, data?.workspaces ?? [])}</Text>
                <Text style={styles.muted}>{quests.length}</Text>
              </Pressable>
              <Button
                isDisabled={startingId !== null}
                label="New quest"
                onPress={() => {
                  void start(workspace.id);
                }}
              />
            </View>
            {quests.length === 0 && <Text style={styles.muted}>No quest in this realm yet.</Text>}
            {quests.map((mission) => (
              <QuestTreeLines
                client={client}
                collapsed={collapsed}
                key={mission.id}
                mission={mission}
                now={Date.now()}
                onOpen={onOpen}
                onOpenThread={onOpenThread}
                onToggle={(id) => setCollapsed((current) => toggledFold(current, id))}
                shouldShowAgentThreads={settings?.shouldShowAgentThreads ?? true}
              />
            ))}
          </View>
        ))}
      </ScrollView>
      {isCreating && (
        <NewRealmModal
          client={client}
          initial={{ crest: null, name: "", path: "" }}
          isFolderRequired={false}
          onCancel={() => setCreating(false)}
        />
      )}
    </View>
  );
}

const local = StyleSheet.create({
  content: { gap: 24, paddingHorizontal: 28, paddingVertical: 20 },
  group: { gap: 6 },
  name: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  page: { backgroundColor: colors.page, flex: 1 },
  realm: { alignItems: "center", flex: 1, flexDirection: "row", gap: 10 },
  toolbar: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
});
