import type { MissionId, MissionSummary, ThreadId, ThreadSummary, WorkspaceId } from "@iskios/contracts";
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
import { agoOf, questListRowsOf, type RealmListing, recencyGroupsOf, toggledFold } from "./questTree";

const isHovered = (state: unknown) => (state as { hovered?: boolean }).hovered === true;

/** How far each level of side-quests steps in. */
const indentStep = 18;

/**
 * One quest or side-quest as a line: its fold mark where something lies beneath it, its state, its title, and at the end
 * its harness, model, and how long ago it last moved. Side-quests step in by their depth.
 */
function QuestLine({
  depth,
  harness,
  isOpen,
  lastActivityAt,
  model,
  now,
  onOpen,
  onToggle,
  state,
  title,
}: {
  depth: number;
  harness: MissionSummary["harness"];
  isOpen: boolean;
  lastActivityAt: number;
  model: MissionSummary["model"];
  now: number;
  onOpen: () => void;
  /** Null where nothing lies beneath the line. */
  onToggle: (() => void) | null;
  state: keyof typeof stateTones;
  title: string;
}) {
  const tone = stateTones[state];
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onOpen}
      style={(pressed) => [
        local.line,
        { paddingLeft: 4 + depth * indentStep },
        (pressed.pressed || isHovered(pressed)) && local.lineHovered,
      ]}
    >
      {onToggle === null ? (
        <View style={local.fold} />
      ) : (
        <Pressable
          accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${title}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          hitSlop={6}
          onPress={onToggle}
          style={local.fold}
        >
          <Text style={[local.foldMark, isOpen && local.foldMarkOpen]}>›</Text>
        </Pressable>
      )}
      <View accessibilityLabel={stateLabels[state]} style={[local.dot, { backgroundColor: tone.color }]} />
      <Text numberOfLines={1} style={local.title}>
        {title}
      </Text>
      <Text numberOfLines={1} style={local.meta}>
        {harnessLabels[harness]} · {modelLabelOf(model)} · {agoOf(lastActivityAt, now)}
      </Text>
    </Pressable>
  );
}

/** A quest with its side-quests nested beneath it, as the sidebar nests them; its tree is read once it has any. */
function QuestTreeLines({
  client,
  collapsed,
  mission,
  now,
  onOpen,
  onOpenThread,
  onToggle,
  shouldShowAgentThreads,
}: {
  client: ServiceClient;
  collapsed: ReadonlySet<string>;
  mission: MissionSummary;
  now: number;
  onOpen: (missionId: MissionId) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  onToggle: (id: string) => void;
  shouldShowAgentThreads: boolean;
}) {
  const { data } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId: mission.id, threadId: null },
    `${mission.id}:top`,
  );
  const threads: ReadonlyArray<ThreadSummary> | null =
    mission.threadCount > 1 && data !== null && data.mission.id === mission.id ? data.threads : null;
  return (
    <>
      {questListRowsOf(mission, threads, collapsed, shouldShowAgentThreads).map((row) => (
        <QuestLine
          depth={row.depth}
          harness={row.thread?.harness ?? mission.harness}
          isOpen={!collapsed.has(row.id)}
          key={row.id}
          lastActivityAt={row.thread?.lastActivityAt ?? mission.lastActivityAt}
          model={row.thread?.model ?? mission.model}
          now={now}
          onOpen={() =>
            row.thread === null ? onOpen(mission.id) : onOpenThread(mission.id, row.thread.id as ThreadId)
          }
          onToggle={row.hasChildren ? () => onToggle(row.id) : null}
          state={row.thread?.state ?? mission.state}
          title={row.thread?.title ?? mission.title}
        />
      ))}
    </>
  );
}

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
  const { data: realms } = useServiceQuery(client, allMissions.request, allMissions.key);
  const realm = listing === null ? null : (realms?.workspaces.find((each) => each.id === listing.id) ?? null);
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
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  fold: { alignItems: "center", height: 20, justifyContent: "center", width: 14 },
  foldMark: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 16, lineHeight: 18 },
  foldMarkOpen: { transform: [{ rotate: "90deg" }] },
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
