import type { MissionId, RealmArchivePreview } from "@iskios/contracts";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CrestBadge } from "../crest/crest";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, outline, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { MissionCard } from "../quests/board";
import { matchingArchivedRealmsOf } from "../realms/realmArchive";
import { RealmRecoveryModal } from "../realms/realmRecoveryModal";
import { Button } from "../ui/button";

/** Archived realms, including empty ones, and archived quests remain recoverable from the same destination. */
export function ArchiveScreen({ client, onOpen }: { client: ServiceClient; onOpen: (id: MissionId) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const request = { _tag: "ListMissions", isArchived: true, search, state: null, workspaceId: null } as const;
  const { data, error } = useServiceQuery(client, request, `archive:${search}:${attempt}`);
  const realms = useServiceQuery(client, { _tag: "ListArchivedRealms" }, `archived-realms:${attempt}`);
  const [restoring, setRestoring] = useState<RealmArchivePreview | null>(null);
  const shown = matchingArchivedRealmsOf(realms.data ?? [], search);
  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={local.content}>
        <TextInput
          accessibilityLabel="Search archive"
          onChangeText={setSearch}
          placeholder="Search the Archive"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={search}
        />
        {(error ?? realms.error) !== null && (
          <View style={styles.inlineRow}>
            <Text accessibilityRole="alert" style={styles.error}>
              {error ?? realms.error}
            </Text>
            <Button label="Retry" onPress={() => setAttempt((current) => current + 1)} />
          </View>
        )}
        {(data === null || realms.data === null) && error === null && realms.error === null && (
          <Text style={styles.muted}>Loading the Archive…</Text>
        )}
        {shown.length > 0 && <Text style={styles.title}>Realms</Text>}
        {shown.map((preview) => (
          <View key={preview.realm.id} style={local.realm}>
            <CrestBadge crest={preview.realm.crest} id={preview.realm.id} size={40} />
            <View style={styles.flex}>
              <Text style={styles.body}>{preview.realm.name}</Text>
              <Text style={styles.muted}>
                {preview.questCount} quests · {preview.loreCount} lore entries
              </Text>
              <Text style={styles.muted}>{preview.realm.path ?? "Tied to no folder"}</Text>
            </View>
            <Button label="Restore" onPress={() => setRestoring(preview)} />
          </View>
        ))}
        {(data?.missions.length ?? 0) > 0 && (
          <>
            <Text style={styles.title}>Quests</Text>
            <Text style={styles.muted}>A quest in an archived realm can continue once that realm is restored.</Text>
            <View style={local.quests}>
              {data?.missions.map((mission) => (
                <View key={mission.id} style={local.quest}>
                  <MissionCard
                    client={client}
                    column={null}
                    mission={mission}
                    onOpen={() => onOpen(mission.id)}
                    onOpenQuest={() => onOpen(mission.id)}
                  />
                </View>
              ))}
            </View>
          </>
        )}
        {data !== null && realms.data !== null && shown.length === 0 && data.missions.length === 0 && (
          <Text style={styles.muted}>
            {search.trim() === "" ? "No archived realms or quests." : "No matches. Try another search."}
          </Text>
        )}
      </ScrollView>
      {restoring !== null && (
        <RealmRecoveryModal
          client={client}
          initial={restoring}
          onCancel={() => setRestoring(null)}
          onRecovered={() => setRestoring(null)}
          proposed={null}
        />
      )}
    </View>
  );
}

const local = StyleSheet.create({
  content: { gap: 18, paddingHorizontal: 28, paddingVertical: 20 },
  page: { backgroundColor: colors.page, flex: 1 },
  quest: { maxWidth: "100%", width: 360 },
  quests: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 16 },
  realm: { ...outline, alignItems: "center", borderRadius: radii.md, flexDirection: "row", gap: 16, padding: 16 },
});
