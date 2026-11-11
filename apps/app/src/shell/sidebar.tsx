import type { Crest, FreeRealmId, MissionId, MissionSummary, ThreadId } from "@iskios/contracts";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { CrestBadge } from "../crest/crest";
import { ReserveRows } from "../editors/budgets";
import { PlanLimitLines } from "../editors/planLimitLines";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";
import { emblemPaths } from "../foundation/emblems";
import { usedTextOf } from "../foundation/labels";
import { allMissions } from "../foundation/queries";
import { colors, fontSizes, fonts, radii, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { NewRealmModal } from "../realms/newRealmModal";
import { NavIcon, type NavIconName } from "./navIcons";
import { ancestorIdsOf, placementsOf, type RealmListing, sideQuestRowsOf } from "./questTree";
import { expandedWidth } from "./railStorage";

/** The places the sidebar leads to; a quest is opened from its own row instead, a realm's quests from its own list. */
export type Place =
  | "Guildmaster"
  | "Quests"
  | "Realms"
  | "FreeRealms"
  | "Realmless"
  | "RealmQuests"
  | "Rituals"
  | "Craft"
  | "Library"
  | "Lore"
  | "Archived"
  | "Reserves"
  | "Charter"
  | "Settings";

/** How far each level of side-quests steps in, and the width of the chevron's place at the start of a row. */
const indentStep = 14;
const chevronWidth = 16;
/** How many quests the sidebar lists under Realmless, and under each realm; the quest list page lists them all. */
const realmlessShown = 5;
const realmShown = 3;

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

/** The sword that marks a quest elsewhere, with a plus in its open corner: the mark of starting a quest. */
function NewQuestIcon({ color }: { color: string }) {
  return (
    <Svg
      fill="none"
      height={18}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={18}
    >
      {emblemPaths.sword.map((d) => (
        <Path d={d} key={d} />
      ))}
      <Path d="M6 2.5v6" />
      <Path d="M3 5.5h6" />
    </Svg>
  );
}

/** The link under a group that lists only some of its quests: it leads to the page that lists them all. */
function ShowAll({ count, onPress, subject }: { count: number; onPress: () => void; subject: string }) {
  return (
    <Pressable
      accessibilityLabel={`Show all ${count} quests of ${subject}`}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [local.more, (state.pressed || isHovered(state)) && local.rowHovered]}
    >
      <Text style={local.moreText}>Show all {count} quests</Text>
      <Text style={local.moreArrow}>→</Text>
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
 * The heading of a group: its icon and its name. The quest groups are always open, and
 * their headings open the group's own page; a heading that folds what lies beneath it shows a large chevron for it.
 */
function Heading({
  icon,
  isOpen,
  isSelected = false,
  label,
  note,
  onAdd,
  onNewQuest,
  onPress,
}: {
  icon: NavIconName;
  isSelected?: boolean;
  /** Set on a heading that folds the rows beneath it: whether they show. Left out, the heading has no chevron. */
  isOpen?: boolean;
  label: string;
  /** What the group is, for assistive technology; the heading shows only its name. */
  note: string;
  /** Makes a new one of what the group holds; null where that cannot be done yet, and the button is left out. */
  onAdd?: () => void;
  /** Starts a quest in the group, in the place of the add button, for a group whose quests need no realm made first. */
  onNewQuest?: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={note}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        local.heading,
        (state.pressed || isHovered(state)) && local.rowHovered,
        isSelected && local.rowSelected,
      ]}
    >
      <View style={local.headingIcon}>
        <NavIcon name={icon} size={28} />
      </View>
      <View style={local.headingText}>
        <Text style={local.headingTitle}>{label}</Text>
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
      {onNewQuest !== undefined && (
        <Pressable
          accessibilityLabel={`New quest in ${label.toLowerCase()}`}
          accessibilityRole="button"
          onPress={onNewQuest}
          style={(state) => [local.add, (state.pressed || isHovered(state)) && local.addHovered]}
        >
          <NewQuestIcon color={colors.highlight} />
        </Pressable>
      )}
      {isOpen !== undefined && (
        <View style={local.headingChevron}>
          <Text style={[local.headingChevronMark, isOpen && local.chevronMarkOpen]}>›</Text>
        </View>
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
  onOpenRealmQuests,
  onOpenThread,
  onPlace,
  openMission,
  openThread,
  place,
}: {
  client: ServiceClient;
  /** The open rail's width, as dragged. */
  width: number;
  onOpenMission: (id: MissionId) => void;
  /** Opens the page that lists all of a realm's or Free Realm's quests. */
  onOpenRealmQuests: (listing: RealmListing) => void;
  /** Opens a side-quest of a quest. */
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  onPlace: (place: Place) => void;
  openMission: MissionId | null;
  /** The side-quest open in the open quest, or null for the quest itself. */
  openThread: ThreadId | null;
  place: Place | null;
}) {
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: freeRealms } = useServiceQuery(client, { _tag: "ListFreeRealms" }, "free-realms");
  const placements = placementsOf(data?.missions ?? [], data?.workspaces ?? [], freeRealms ?? []);
  const isHere = (each: Place) => openMission === null && place === each;
  // A setting hides the Guild Hall's entry; its screen is still where a realm page's message goes.
  const hasGuildHall = settings?.shouldShowGuildmaster !== false;
  // The menu that makes a realm: one tied to a folder, or a free realm with none.
  const [creating, setCreating] = useState<"folder" | "free" | null>(null);
  // Realms start open and quests start closed, so a long list of quests stays short; side-quests start open.
  const closedRealms = useToggles();
  // The Keep's heading folds or unfolds its rooms; the quest groups are always open.
  const isKeepFolded = useToggles();
  const openQuests = useToggles();
  // The open quest always shows, even when it lies beyond the first few.
  const shownOf = (quests: ReadonlyArray<MissionSummary>, limit: number) =>
    quests.filter((mission, index) => index < limit || mission.id === openMission);
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

  // Starts an empty quest and opens it; its realm unfolds to show it, and a refusal shows under the realm.
  const [newQuestFailure, setNewQuestFailure] = useState<{ message: string; groupId: string } | null>(null);
  const startQuest = (groupId: string, placement: { freeRealmId?: FreeRealmId; workspacePath: string | null }) => {
    setNewQuestFailure(null);
    client
      .request({ _tag: "StartEmptyQuest", requestId: newRequestId(), ...placement })
      .then((started) => {
        closedRealms.setSet((current) => new Set([...current].filter((id) => id !== groupId)));
        onOpenMission(started.missionId);
      })
      .catch((reason) => setNewQuestFailure({ groupId, message: messageOf(reason) }));
  };
  const failureUnder = (groupId: string) =>
    newQuestFailure?.groupId === groupId && <Text style={local.newQuestFailure}>{newQuestFailure.message}</Text>;

  /** A realm or Free Realm: its crest and name, its quests beneath it while it is unfolded, and the button for a new quest. */
  const realmRow = (realm: {
    crest: Crest | null;
    id: string;
    kind: RealmListing["kind"];
    name: string;
    placement: { freeRealmId?: FreeRealmId; workspacePath: string | null };
    quests: ReadonlyArray<MissionSummary>;
  }) => {
    const isClosed = closedRealms.set.has(realm.id);
    return (
      <View key={realm.id}>
        <Pressable
          accessibilityLabel={realm.name}
          accessibilityRole="button"
          onPress={() => closedRealms.toggle(realm.id)}
          style={(state) => [local.row, { paddingLeft: 6 }, (state.pressed || isHovered(state)) && local.rowHovered]}
        >
          <CrestBadge crest={realm.crest} id={realm.id} size={22} />
          <Text numberOfLines={1} style={[local.rowText, local.realmText]}>
            {realm.name}
          </Text>
          <Count value={realm.quests.length} />
          <Chevron isOpen={!isClosed} label={realm.name} onPress={() => closedRealms.toggle(realm.id)} />
          <Pressable
            accessibilityLabel={`New quest in ${realm.name}`}
            accessibilityRole="button"
            hitSlop={4}
            onPress={() => startQuest(realm.id, realm.placement)}
            style={(state) => [local.newQuest, (state.pressed || isHovered(state)) && local.newQuestHovered]}
          >
            <NewQuestIcon color={colors.textMuted} />
          </Pressable>
        </Pressable>
        {failureUnder(realm.id)}
        {!isClosed && realm.quests.length === 0 && <Text style={local.emptyRealm}>No quest in this realm yet.</Text>}
        {!isClosed &&
          shownOf(realm.quests, realmShown).map((mission) => (
            <Quest {...questProps} isOpen={openQuests.set.has(mission.id)} key={mission.id} mission={mission} />
          ))}
        {!isClosed && realm.quests.length > realmShown && (
          <ShowAll
            count={realm.quests.length}
            onPress={() => onOpenRealmQuests({ id: realm.id, kind: realm.kind, name: realm.name })}
            subject={realm.name}
          />
        )}
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
          isSelected={isHere("Realms")}
          label="Realms"
          note="Tied to a real folder or repository"
          onAdd={() => setCreating("folder")}
          onPress={() => onPlace("Realms")}
        />
        {placements.realms.length === 0 && <Text style={local.empty}>No realm yet.</Text>}
        {placements.realms.map(({ quests, workspace }) =>
          realmRow({
            crest: workspace.crest,
            id: workspace.id,
            kind: "realm",
            name: workspace.name,
            placement: { workspacePath: workspace.path },
            quests,
          }),
        )}

        <Gap />
        <Heading
          icon="free-realms"
          isSelected={isHere("FreeRealms")}
          label="Free Realms"
          note="No workspace; groups related quests"
          onAdd={() => setCreating("free")}
          onPress={() => onPlace("FreeRealms")}
        />
        {placements.freeRealms.length === 0 && <Text style={local.empty}>No free realm yet.</Text>}
        {placements.freeRealms.map(({ freeRealm, quests }) =>
          realmRow({
            crest: freeRealm.crest,
            id: freeRealm.id,
            kind: "free",
            name: freeRealm.name,
            placement: { freeRealmId: freeRealm.id, workspacePath: null },
            quests,
          }),
        )}

        <Gap />
        <Heading
          icon="realmless"
          isSelected={isHere("Realmless")}
          label="Realmless"
          note="Independent quest, outside any realm"
          onNewQuest={() => startQuest("Realmless", { workspacePath: null })}
          onPress={() => onPlace("Realmless")}
        />
        {failureUnder("Realmless")}
        {placements.realmless.length === 0 && <Text style={local.empty}>No quest yet.</Text>}
        {shownOf(placements.realmless, realmlessShown).map((mission) => (
          <Quest {...questProps} isOpen={openQuests.set.has(mission.id)} key={mission.id} mission={mission} />
        ))}
        {placements.realmless.length > realmlessShown && (
          <ShowAll count={placements.realmless.length} onPress={() => onPlace("Realmless")} subject="Realmless" />
        )}

        <Divider />
        <Row icon="rituals" isMain isSelected={isHere("Rituals")} label="Rituals" onPress={() => onPlace("Rituals")} />
        <Row icon="craft" isMain isSelected={isHere("Craft")} label="Craft" onPress={() => onPlace("Craft")} />
        <Divider />
        <Heading
          icon="the-keep"
          isOpen={!isKeepFolded.set.has("Keep")}
          label="The Keep"
          note="Library, lore, and the archive"
          onPress={() => isKeepFolded.toggle("Keep")}
        />
        {!isKeepFolded.set.has("Keep") &&
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
        <Row icon="charter" isMain isSelected={isHere("Charter")} label="Charter" onPress={() => onPlace("Charter")} />
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
  emptyRealm: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontStyle: "italic",
    paddingLeft: 6 + chevronWidth,
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
  headingChevron: { alignItems: "center", height: 32, justifyContent: "center", marginLeft: 6, width: 28 },
  headingChevronMark: { color: colors.text, fontFamily: fonts.sans, fontSize: 30, lineHeight: 32 },
  headingIcon: { alignItems: "center", marginRight: 8, width: 28 },
  headingText: { flex: 1 },
  headingTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
  iconColumn: { gap: 4, padding: 8 },
  iconRow: { alignItems: "center", borderRadius: radii.md, height: 36, justifyContent: "center" },
  more: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 6,
    minHeight: 28,
    paddingLeft: 6 + chevronWidth,
    paddingRight: 8,
    paddingVertical: 4,
  },
  moreArrow: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.base },
  moreText: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  newQuest: { alignItems: "center", borderRadius: radii.sm, height: 22, justifyContent: "center", width: 22 },
  newQuestFailure: {
    color: colors.dangerText,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    paddingLeft: 6 + chevronWidth,
    paddingVertical: 4,
  },
  newQuestHovered: { backgroundColor: colors.controlActive },
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
