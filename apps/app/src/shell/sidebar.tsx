import type { MissionId, MissionSummary, ThreadId, WorkspaceChoice, WorkspaceId } from "@iskios/contracts";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CrestBadge } from "../crest/crest";
import { ReserveRows } from "../editors/budgets";
import { PlanLimitLines } from "../editors/planLimitLines";
import type { ServiceClient } from "../foundation/client";
import { usedTextOf } from "../foundation/labels";
import { allMissions } from "../foundation/queries";
import { colors, fontSizes, fonts, radii, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { NewRealmModal } from "../realms/newRealmModal";
import { NavIcon, type NavIconName } from "./navIcons";
import { ancestorIdsOf, placementsOf, sideQuestRowsOf } from "./questTree";
import { expandedWidth } from "./railStorage";

/** The places the sidebar leads to; a quest is opened from its own row instead, a realm's quests from its own list. */
export type Place =
  | "Guildmaster"
  | "Quests"
  | "Rituals"
  | "Craft"
  | "Library"
  | "Lore"
  | "Archived"
  | "Reserves"
  | "Settings";

/** How far each level of side-quests steps in, and the width of the chevron's place at the start of a row. */
const indentStep = 14;
const chevronWidth = 16;

const isHovered = (state: unknown) => (state as { hovered?: boolean }).hovered === true;

/** The mark that folds or unfolds what lies beneath a row; a row with nothing beneath it keeps the place empty. */
function Chevron({
  isOpen,
  label,
  onPress,
}: {
  isOpen: boolean;
  label: string;
  /** Null where nothing lies beneath the row. */
  onPress: (() => void) | null;
}) {
  if (onPress === null) return <View style={local.chevron} />;
  return (
    <Pressable
      accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${label}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      hitSlop={6}
      onPress={onPress}
      style={local.chevron}
    >
      <Text style={[local.chevronMark, isOpen && local.chevronMarkOpen]}>›</Text>
    </Pressable>
  );
}

/** One row of the sidebar: a label, and at its end a mark such as a state dot or a count. */
function Row({
  accessory,
  icon,
  indent = 0,
  isMain = false,
  isSelected,
  label,
  lead,
  onPress,
  textStyle,
}: {
  accessory?: ReactNode;
  /** The destination's icon, standing after an empty place for a chevron so it lines up with the headings'. */
  icon?: NavIconName;
  indent?: number;
  /** A main destination, set like a group's heading: its icon as large and its name in bold. */
  isMain?: boolean;
  isSelected: boolean;
  label: string;
  /** What stands before the label: a chevron, or an empty place that keeps the labels aligned. */
  lead?: ReactNode;
  onPress: () => void;
  textStyle?: object;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        local.row,
        { paddingLeft: 6 + indent },
        (state.pressed || isHovered(state)) && local.rowHovered,
        isSelected && local.rowSelected,
      ]}
    >
      {lead}
      {icon !== undefined && (
        <View style={local.headingIcon}>
          <NavIcon name={icon} size={isMain ? 28 : 22} />
        </View>
      )}
      <Text
        numberOfLines={1}
        style={[local.rowText, isSelected && local.rowTextSelected, isMain && local.rowTextMain, textStyle]}
      >
        {label}
      </Text>
      {accessory}
    </Pressable>
  );
}

/** A state's dot: the color the state reads in everywhere else. */
function StateDot({ state }: { state: keyof typeof stateTones }) {
  return <View style={[local.dot, { backgroundColor: stateTones[state].color }]} />;
}

/** The number at the end of a row, such as the archived quests. */
function Count({ value }: { value: number }) {
  return value > 0 ? <Text style={local.count}>{value}</Text> : null;
}

/**
 * The heading of a group of quests: its icon, its name, and beneath it what the group is. Pressing it goes where the
 * group leads: for the quest groups it folds or unfolds the rows beneath it.
 */
function Heading({
  icon,
  label,
  note,
  onAdd,
  onPress,
}: {
  icon: NavIconName;
  label: string;
  note: string;
  /** Makes a new one of what the group holds; null where that cannot be done yet, and the button is left out. */
  onAdd?: () => void;
  /** Null for a group that leads nowhere. */
  onPress: (() => void) | null;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress ?? undefined}
      style={(state) => [local.heading, (state.pressed || isHovered(state)) && local.rowHovered]}
    >
      <View style={local.headingIcon}>
        <NavIcon name={icon} size={28} />
      </View>
      <View style={local.headingText}>
        <Text style={local.headingTitle}>{label}</Text>
        <Text numberOfLines={1} style={local.headingNote}>
          {note}
        </Text>
      </View>
      {onAdd !== undefined && (
        <Pressable
          accessibilityLabel={`New ${label.toLowerCase().replace(/s$/, "")}`}
          accessibilityRole="button"
          onPress={onAdd}
          style={(state) => [local.add, (state.pressed || isHovered(state)) && local.addHovered]}
        >
          <Text style={local.addMark}>+</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

/** The line between two main destinations of the sidebar, with a diamond at its middle. */
function Divider() {
  return (
    <View style={local.divider}>
      <View style={local.dividerLine} />
      <View style={local.diamond} />
      <View style={local.dividerLine} />
    </View>
  );
}

/** The space between two groups of quests. */
function Gap() {
  return <View style={local.gap} />;
}

/** A quest's side-quests, nested beneath it with their branch guides; each can collapse its own side-quests. */
function SideQuests({
  client,
  collapsed,
  missionId,
  onOpenThread,
  onReveal,
  onToggle,
  selectedThread,
  shouldShowAgentThreads,
}: {
  client: ServiceClient;
  collapsed: ReadonlySet<string>;
  missionId: MissionId;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  /** Asks for these side-quests to be expanded, so the open one shows. */
  onReveal: (ids: ReadonlyArray<string>) => void;
  onToggle: (id: string) => void;
  /** The thread open in this quest, or null when the quest itself or another quest is open. */
  selectedThread: ThreadId | null;
  shouldShowAgentThreads: boolean;
}) {
  const { data } = useServiceQuery(client, { _tag: "ReadMission", missionId, threadId: null }, `${missionId}:top`);
  const threads = data !== null && data.mission.id === missionId ? data.threads : null;
  // The sidebar always shows where the owner is: the path to the open side-quest expands.
  useEffect(() => {
    if (threads !== null && selectedThread !== null) onReveal(ancestorIdsOf(threads, selectedThread));
  }, [threads, selectedThread, onReveal]);
  if (threads === null) return null;
  const rows = sideQuestRowsOf(threads, { collapsed, shouldShowAgentThreads });
  return (
    <>
      {rows.map(({ depth, foldedCount, hasChildren, thread }) => (
        <View key={thread.id}>
          {Array.from({ length: depth }, (_, level) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: the guides of a row are told apart by their level
              key={level}
              pointerEvents="none"
              style={[local.guide, { left: chevronWidth / 2 + level * indentStep }]}
            />
          ))}
          <Row
            accessory={<StateDot state={thread.state} />}
            indent={depth * indentStep}
            isSelected={selectedThread === thread.id}
            label={foldedCount > 0 ? `${thread.title} +${foldedCount}` : thread.title}
            lead={
              <Chevron
                isOpen={!collapsed.has(thread.id)}
                label={thread.title}
                onPress={hasChildren ? () => onToggle(thread.id) : null}
              />
            }
            onPress={() => onOpenThread(missionId, thread.id)}
            textStyle={local.sideQuestText}
          />
        </View>
      ))}
    </>
  );
}

/** One quest of a placement, with its side-quests beneath it while it is expanded. */
function Quest({
  client,
  collapsed,
  isOpen,
  mission,
  onOpenMission,
  onOpenThread,
  onReveal,
  onToggle,
  onToggleThread,
  openMission,
  openThread,
  shouldShowAgentThreads,
}: {
  client: ServiceClient;
  collapsed: ReadonlySet<string>;
  isOpen: boolean;
  mission: MissionSummary;
  onOpenMission: (id: MissionId) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  onReveal: (ids: ReadonlyArray<string>) => void;
  onToggle: (id: string) => void;
  onToggleThread: (id: string) => void;
  openMission: MissionId | null;
  openThread: ThreadId | null;
  shouldShowAgentThreads: boolean;
}) {
  const isHere = openMission === mission.id;
  return (
    <>
      <Row
        accessory={<StateDot state={mission.state} />}
        indent={chevronWidth}
        isSelected={isHere && (openThread === null || openThread === mission.topThreadId)}
        label={mission.title}
        lead={
          <Chevron
            isOpen={isOpen}
            label={mission.title}
            onPress={mission.threadCount > 1 ? () => onToggle(mission.id) : null}
          />
        }
        onPress={() => onOpenMission(mission.id)}
      />
      {isOpen && mission.threadCount > 1 && (
        <View style={{ paddingLeft: chevronWidth }}>
          <SideQuests
            client={client}
            collapsed={collapsed}
            missionId={mission.id}
            onOpenThread={onOpenThread}
            onReveal={onReveal}
            onToggle={onToggleThread}
            selectedThread={isHere ? openThread : null}
            shouldShowAgentThreads={shouldShowAgentThreads}
          />
        </View>
      )}
    </>
  );
}

/** The rows under The Keep, in order. */
const keepRooms: ReadonlyArray<{ icon: NavIconName; label: string; place: Place }> = [
  { icon: "library", label: "Library", place: "Library" },
  { icon: "lore", label: "Lore", place: "Lore" },
  { icon: "archive", label: "Archive", place: "Archived" },
];

/** A set of ids the owner toggles, as the expanded and collapsed rows of the tree. */
const useToggles = () => {
  const [set, setSet] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setSet((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return { set, setSet, toggle };
};

/**
 * The left sidebar, in the agreed order: Guild Hall, the Realms with their quests, Free Realms, quests outside any
 * realm, Rituals, Craft, The Keep, Reserves, and the Workshop (the settings). Quests nest their side-quests at every depth,
 * and the sidebar opens the path to the thread that is open.
 */
export function Sidebar({
  client,
  width,
  onOpenMission,
  onOpenThread,
  onPlace,
  onWorkspace,
  openMission,
  openThread,
  place,
  workspaceId,
}: {
  client: ServiceClient;
  /** The open rail's width, as dragged. */
  width: number;
  onOpenMission: (id: MissionId) => void;
  /** Opens a side-quest of a quest. */
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  onPlace: (place: Place) => void;
  /** Opens the board of one workspace's quests. */
  onWorkspace: (id: WorkspaceId) => void;
  openMission: MissionId | null;
  /** The side-quest open in the open quest, or null for the quest itself. */
  openThread: ThreadId | null;
  place: Place | null;
  /** The workspace whose board shows, or null for every quest. */
  workspaceId: WorkspaceId | null;
}) {
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const placements = placementsOf(data?.missions ?? [], data?.workspaces ?? []);
  const isHere = (each: Place) => openMission === null && place === each;
  // A setting hides the Guild Hall's entry; its screen is still where a realm page's message goes.
  const hasGuildHall = settings?.shouldShowGuildmaster !== false;
  // The menu that makes a realm: one tied to a folder, or a free realm with none.
  const [creating, setCreating] = useState<"folder" | "free" | null>(null);
  const { data: freeRealms } = useServiceQuery(client, { _tag: "ListFreeRealms" }, "free-realms");
  // Realms start open and quests start closed, so a long list of quests stays short; side-quests start open.
  const closedRealms = useToggles();
  // The groups folded away: pressing a group's heading folds or unfolds what lies beneath it.
  const foldedGroups = useToggles();
  const openQuests = useToggles();
  const collapsedThreads = useToggles();
  // The sidebar always shows where the owner is: the open quest expands, and the quest reveals the open side-quest.
  const setOpenQuests = openQuests.setSet;
  const setCollapsedThreads = collapsedThreads.setSet;
  useEffect(() => {
    if (openMission !== null)
      setOpenQuests((current) => (current.has(openMission) ? current : new Set(current).add(openMission)));
  }, [openMission, setOpenQuests]);
  const reveal = (ids: ReadonlyArray<string>) =>
    setCollapsedThreads((current) =>
      ids.some((id) => current.has(id)) ? new Set([...current].filter((id) => !ids.includes(id))) : current,
    );
  const questProps = {
    client,
    collapsed: collapsedThreads.set,
    onOpenMission,
    onOpenThread,
    onReveal: reveal,
    onToggle: openQuests.toggle,
    onToggleThread: collapsedThreads.toggle,
    openMission,
    openThread,
    shouldShowAgentThreads: settings?.shouldShowAgentThreads ?? true,
  };

  const realmRows = (realm: { quests: ReadonlyArray<MissionSummary>; workspace: WorkspaceChoice }) => {
    const isClosed = closedRealms.set.has(realm.workspace.id);
    return (
      <View key={realm.workspace.id}>
        <Pressable
          accessibilityLabel={realm.workspace.name}
          accessibilityRole="button"
          onPress={() => onWorkspace(realm.workspace.id)}
          style={(state) => [
            local.row,
            { paddingLeft: 6 },
            (state.pressed || isHovered(state)) && local.rowHovered,
            isHere("Quests") && workspaceId === realm.workspace.id && local.rowSelected,
          ]}
        >
          <CrestBadge crest={realm.workspace.crest} id={realm.workspace.id} size={22} />
          <Text numberOfLines={1} style={[local.rowText, local.realmText]}>
            {realm.workspace.name}
          </Text>
          <Count value={realm.quests.length} />
          <Chevron
            isOpen={!isClosed}
            label={realm.workspace.name}
            onPress={realm.quests.length > 0 ? () => closedRealms.toggle(realm.workspace.id) : null}
          />
        </Pressable>
        {!isClosed &&
          realm.quests.map((mission) => (
            <Quest {...questProps} isOpen={openQuests.set.has(mission.id)} key={mission.id} mission={mission} />
          ))}
      </View>
    );
  };

  return (
    <View style={[local.sidebar, { width }]}>
      <ScrollView contentContainerStyle={local.group} style={local.flex}>
        {hasGuildHall && (
          <>
            <Row
              icon="guild-hall"
              isMain
              isSelected={isHere("Guildmaster")}
              label="Guild Hall"
              onPress={() => onPlace("Guildmaster")}
            />
            <Divider />
          </>
        )}

        <Heading
          icon="realms"
          label="Realms"
          note="Tied to a real folder or repository"
          onAdd={() => setCreating("folder")}
          onPress={() => foldedGroups.toggle("Realms")}
        />
        {!foldedGroups.set.has("Realms") && placements.realms.length === 0 && (
          <Text style={local.empty}>No realm yet.</Text>
        )}
        {!foldedGroups.set.has("Realms") && placements.realms.map(realmRows)}

        <Gap />
        <Heading
          icon="free-realms"
          label="Free Realms"
          note="No workspace; groups related quests"
          onAdd={() => setCreating("free")}
          onPress={() => foldedGroups.toggle("FreeRealms")}
        />
        {!foldedGroups.set.has("FreeRealms") && (freeRealms ?? []).length === 0 && (
          <Text style={local.empty}>No free realm yet.</Text>
        )}
        {!foldedGroups.set.has("FreeRealms") &&
          (freeRealms ?? []).map((realm) => (
            <View key={realm.id} style={[local.row, { paddingLeft: 6 }]}>
              <CrestBadge crest={realm.crest} id={realm.id} size={22} />
              <Text numberOfLines={1} style={[local.rowText, local.realmText]}>
                {realm.name}
              </Text>
            </View>
          ))}

        <Gap />
        <Heading
          icon="realmless"
          label="Realmless"
          note="Independent quest, outside any realm"
          onPress={() => foldedGroups.toggle("Realmless")}
        />
        {!foldedGroups.set.has("Realmless") && placements.realmless.length === 0 && (
          <Text style={local.empty}>No quest yet.</Text>
        )}
        {!foldedGroups.set.has("Realmless") &&
          placements.realmless.map((mission) => (
            <Quest {...questProps} isOpen={openQuests.set.has(mission.id)} key={mission.id} mission={mission} />
          ))}

        <Divider />
        <Row icon="rituals" isMain isSelected={isHere("Rituals")} label="Rituals" onPress={() => onPlace("Rituals")} />
        <Row icon="craft" isMain isSelected={isHere("Craft")} label="Craft" onPress={() => onPlace("Craft")} />
        <Divider />
        <Heading
          icon="the-keep"
          label="The Keep"
          note="Library, lore, and the archive"
          onPress={() => foldedGroups.toggle("Keep")}
        />
        {!foldedGroups.set.has("Keep") &&
          keepRooms.map((room) => (
            <Row
              accessory={room.place === "Archived" ? <ArchiveCount client={client} /> : undefined}
              icon={room.icon}
              indent={chevronWidth}
              isSelected={isHere(room.place)}
              key={room.place}
              label={room.label}
              onPress={() => onPlace(room.place)}
            />
          ))}
      </ScrollView>
      <View style={local.footer}>
        <Divider />
        <Row
          icon="reserves"
          isMain
          isSelected={isHere("Reserves")}
          label="Reserves"
          onPress={() => onPlace("Reserves")}
        />
        <Spending client={client} />
        <Divider />
        <Row
          icon="workshop"
          isMain
          isSelected={isHere("Settings")}
          label="Workshop"
          onPress={() => onPlace("Settings")}
        />
      </View>
      {creating !== null && (
        <NewRealmModal
          hasFolder={creating === "folder"}
          initial={{ crest: null, name: "", path: "" }}
          onCancel={() => setCreating(null)}
          onCreate={(realm) =>
            creating === "folder"
              ? client.request({ _tag: "CreateRealm", crest: realm.crest, name: realm.name, path: realm.path })
              : client.request({ _tag: "CreateFreeRealm", crest: realm.crest, name: realm.name })
          }
        />
      )}
    </View>
  );
}

/** The number of archived quests, at the end of the Archive row. */
function ArchiveCount({ client }: { client: ServiceClient }) {
  const request = { _tag: "ListMissions", isArchived: true, search: null, state: null, workspaceId: null } as const;
  const { data } = useServiceQuery(client, request, `missions:${JSON.stringify(request)}`);
  return <Count value={data?.missions.length ?? 0} />;
}

/** The compact usage summary under Reserves: the global budget's meters, or what is used, and the plans' limits. */
function Spending({ client }: { client: ServiceClient }) {
  const { data: global } = useServiceQuery(client, { _tag: "ReadBudget", missionId: null }, "budget:global");
  if (global === null) return null;
  const hasLimits = global.limits.cost !== null || global.limits.tokens !== null;
  return (
    <View style={local.spending}>
      {hasLimits ? <ReserveRows use={global} /> : <Text style={local.empty}>{usedTextOf(global.consumption)}</Text>}
      <PlanLimitLines client={client} />
    </View>
  );
}

const local = StyleSheet.create({
  add: {
    alignItems: "center",
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    marginLeft: 6,
    width: 28,
  },
  addHovered: { backgroundColor: colors.controlActive },
  addMark: { color: colors.highlight, fontFamily: fonts.sans, fontSize: 18, lineHeight: 20 },
  chevron: { alignItems: "center", height: 20, justifyContent: "center", width: chevronWidth },
  chevronMark: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 16, lineHeight: 18 },
  chevronMarkOpen: { transform: [{ rotate: "90deg" }] },
  count: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  diamond: {
    backgroundColor: colors.edge,
    height: 7,
    marginHorizontal: 6,
    transform: [{ rotate: "45deg" }],
    width: 7,
  },
  divider: { alignItems: "center", flexDirection: "row", marginHorizontal: 6, marginVertical: 8 },
  dividerLine: { backgroundColor: colors.border, flex: 1, height: 1 },
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  empty: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  flex: { flex: 1 },
  footer: { paddingBottom: 8, paddingLeft: 8, paddingRight: 16 },
  gap: { height: 12 },
  group: { gap: 1, paddingBottom: 12, paddingLeft: 8, paddingRight: 16, paddingTop: 8 },
  guide: { backgroundColor: colors.border, bottom: 0, position: "absolute", top: 0, width: 1 },
  heading: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  headingIcon: { alignItems: "center", marginRight: 8, width: 28 },
  headingNote: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontStyle: "italic" },
  headingText: { flex: 1, gap: 1 },
  headingTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
  iconColumn: { gap: 4, padding: 8 },
  iconRow: { alignItems: "center", borderRadius: radii.md, height: 36, justifyContent: "center" },
  realmText: { fontWeight: "600" },
  row: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 4,
    minHeight: 28,
    paddingRight: 8,
    paddingVertical: 4,
  },
  rowHovered: { backgroundColor: colors.controlHover },
  rowSelected: { backgroundColor: colors.controlActive },
  rowText: { color: colors.onGround, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base },
  rowTextMain: { color: colors.text, fontSize: fontSizes.lg, fontWeight: "700" },
  rowTextSelected: { color: colors.text, fontWeight: "600" },
  sidebar: {
    backgroundColor: colors.sidebar,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    width: expandedWidth,
  },
  sideQuestText: { fontSize: fontSizes.md },
  spending: { paddingHorizontal: 6, paddingVertical: 4 },
});
