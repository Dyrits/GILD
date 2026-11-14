import type { MissionId, ThreadId, WorkspaceId } from "@iskios/contracts";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CrestStudio } from "../crest/crestStudio";
import type { ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { useHasSidebar, useQuestPanel } from "../foundation/shellContext";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { LoreScreen } from "../lore/lore";
import { RealmPanel } from "../quests/questPanel";
import { RealmArchiveAction } from "../realms/realmArchiveAction";
import { EmptyBoard } from "../ui/brand";
import { QuestTreeLines } from "./questListRows";
import { type RealmListing, recencyGroupsOf, toggledFold } from "./questTree";

/**
 * The page of a realm's quests or the Borderlands': every one of them, latest first by the quest's own activity, under Today,
 * Yesterday, and the months. A realm's page has the realm's panel in the window's side column, as its board has.
 */
export function QuestListScreen({
  client,
  listing,
  onOpen,
  onOpenThread,
}: {
  client: ServiceClient;
  /** The realm to list, or null for the Borderlands' quests. */
  listing: RealmListing | null;
  onOpen: (missionId: MissionId) => void;
  /** Opens a side-quest of a quest. */
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
}) {
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  // Quests start unfolded here, so their side-quests show; the owner folds any quest or side-quest.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setCollapsed((current) => toggledFold(current, id));
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const quests = (data?.missions ?? []).filter((mission) => mission.workspaceId === (listing?.id ?? null));
  const now = Date.now();
  const hasSidebar = useHasSidebar();
  const realm = listing === null ? null : (data?.workspaces.find((each) => each.id === listing.id) ?? null);
  // The realm whose crest studio or lore is open; showing another realm closes them.
  const [designingId, setDesigningId] = useState<WorkspaceId | null>(null);
  const [loreId, setLoreId] = useState<WorkspaceId | null>(null);
  useQuestPanel(
    hasSidebar && realm !== null && (
      <RealmPanel
        client={client}
        key={realm.id}
        missions={quests}
        onCustomize={() => setDesigningId(realm.id)}
        onOpenLore={() => setLoreId(realm.id)}
        onSelect={onOpen}
        realm={realm}
      />
    ),
    "Realm",
  );
  if (realm !== null && loreId === realm.id) {
    return (
      <LoreScreen
        client={client}
        onBack={() => setLoreId(null)}
        threadId={null}
        title={`Lore · ${realm.name}`}
        workspaceId={realm.id}
      />
    );
  }
  return (
    <View style={local.page}>
      {realm !== null && (
        <View style={{ alignItems: "flex-end", paddingHorizontal: 28, paddingTop: 16 }}>
          <RealmArchiveAction client={client} isIcon workspaceId={realm.id} />
        </View>
      )}
      {realm !== null && designingId === realm.id && (
        <CrestStudio
          id={realm.id}
          initial={realm.crest}
          name={realm.name}
          onCancel={() => setDesigningId(null)}
          onDone={(crest) =>
            client.request({ _tag: "SetRealmCrest", crest, workspaceId: realm.id }).then(() => setDesigningId(null))
          }
        />
      )}
      <ScrollView contentContainerStyle={local.content} style={local.page}>
        {quests.length === 0 && (
          <EmptyBoard line={listing === null ? "No quest in the Borderlands yet." : "No quest in this realm yet."} />
        )}
        {recencyGroupsOf(quests, now).map((group) => (
          <View key={group.heading} style={local.group}>
            <Text style={local.heading}>{group.heading}</Text>
            {group.quests.map((mission) => (
              <QuestTreeLines
                client={client}
                collapsed={collapsed}
                key={mission.id}
                mission={mission}
                now={now}
                onOpen={onOpen}
                onOpenThread={onOpenThread}
                onToggle={toggle}
                shouldShowAgentThreads={settings?.shouldShowAgentThreads ?? true}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  content: { gap: 22, paddingHorizontal: 28, paddingVertical: 20 },
  group: { gap: 2 },
  heading: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "600",
    paddingBottom: 6,
  },
  page: { backgroundColor: colors.page, flex: 1 },
});
