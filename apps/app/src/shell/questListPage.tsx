import type { MissionId, MissionSummary, WorkspaceId } from "@iskios/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CrestStudio } from "../crest/crestStudio";
import type { ServiceClient } from "../foundation/client";
import { harnessLabels, modelLabelOf } from "../foundation/formatting";
import { allMissions } from "../foundation/queries";
import { useHasSidebar, useQuestPanel } from "../foundation/shellContext";
import { colors, fontSizes, fonts, radii, stateLabels, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { LoreScreen } from "../lore/lore";
import { RealmPanel } from "../quests/questPanel";
import { EmptyBoard } from "../ui/brand";
import { agoOf, type RealmListing, recencyGroupsOf } from "./questTree";

const isHovered = (state: unknown) => (state as { hovered?: boolean }).hovered === true;

/** One quest as a line: its state, its title, and at the end its harness, model, and how long ago it last moved. */
function QuestLine({ mission, now, onOpen }: { mission: MissionSummary; now: number; onOpen: () => void }) {
  const tone = stateTones[mission.state];
  return (
    <Pressable
      accessibilityLabel={mission.title}
      accessibilityRole="button"
      onPress={onOpen}
      style={(state) => [local.line, (state.pressed || isHovered(state)) && local.lineHovered]}
    >
      <View accessibilityLabel={stateLabels[mission.state]} style={[local.dot, { backgroundColor: tone.color }]} />
      <Text numberOfLines={1} style={local.title}>
        {mission.title}
      </Text>
      <Text numberOfLines={1} style={local.meta}>
        {harnessLabels[mission.harness]} · {modelLabelOf(mission.model)} · {agoOf(mission.lastActivityAt, now)}
      </Text>
    </Pressable>
  );
}

/**
 * The page of a realm's, a Free Realm's, or the Realmless quests: every one of them, latest first, under Today,
 * Yesterday, and the months. A realm's page has the realm's panel in the window's side column, as its board has.
 */
export function QuestListScreen({
  client,
  listing,
  onOpen,
}: {
  client: ServiceClient;
  /** The realm or Free Realm to list, or null for the quests outside any realm. */
  listing: RealmListing | null;
  onOpen: (missionId: MissionId) => void;
}) {
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const quests = (data?.missions ?? []).filter((mission) =>
    listing === null
      ? mission.workspaceId === null && mission.freeRealmId === null
      : listing.kind === "realm"
        ? mission.workspaceId === listing.id
        : mission.freeRealmId === listing.id,
  );
  const now = Date.now();
  const hasSidebar = useHasSidebar();
  const { data: realms } = useServiceQuery(client, allMissions.request, allMissions.key);
  const realm = listing?.kind === "realm" ? (realms?.workspaces.find((each) => each.id === listing.id) ?? null) : null;
  // The realm whose crest studio or lore is open; showing another realm closes them.
  const [designingId, setDesigningId] = useState<WorkspaceId | null>(null);
  const [loreId, setLoreId] = useState<WorkspaceId | null>(null);
  useQuestPanel(
    hasSidebar && realm !== null && (
      <RealmPanel
        key={realm.id}
        missions={quests}
        onCustomize={() => setDesigningId(realm.id)}
        onOpenLore={() => setLoreId(realm.id)}
        onRename={(name) => client.request({ _tag: "RenameRealm", name, workspaceId: realm.id })}
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
          <EmptyBoard line={listing === null ? "No quest outside a realm yet." : "No quest in this realm yet."} />
        )}
        {recencyGroupsOf(quests, now).map((group) => (
          <View key={group.heading} style={local.group}>
            <Text style={local.heading}>{group.heading}</Text>
            {group.quests.map((mission) => (
              <QuestLine key={mission.id} mission={mission} now={now} onOpen={() => onOpen(mission.id)} />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  content: { gap: 22, paddingHorizontal: 28, paddingVertical: 20 },
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  group: { gap: 2 },
  heading: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "600",
    paddingBottom: 6,
  },
  line: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  lineHovered: { backgroundColor: colors.controlHover },
  meta: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  page: { backgroundColor: colors.page, flex: 1 },
  title: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base },
});
