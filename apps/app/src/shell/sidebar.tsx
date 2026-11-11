import type { Crest, MissionId, MissionSummary, ThreadId, WorkspaceId } from "@iskios/contracts";
import { type ReactNode, useEffect, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { CrestBadge } from "../crest/crest";
import { ReserveRows } from "../editors/budgets";
import { PlanLimitLines } from "../editors/planLimitLines";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";
import { emblemPaths } from "../foundation/emblems";
import { isKeyboardFocus } from "../foundation/inputModality";
import { usedTextOf } from "../foundation/labels";
import { allMissions } from "../foundation/queries";
import { colors, fontSizes, fonts, radii, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { NewRealmModal } from "../realms/newRealmModal";
import { NavIcon, type NavIconName } from "./navIcons";
import {
  ancestorIdsOf,
  areActionsShown,
  placementsOf,
  type RealmListing,
  scrollCueOf,
  sideQuestRowsOf,
  toggledFold,
} from "./questTree";
import { expandedWidth } from "./railStorage";

/** The places the sidebar leads to; a quest is opened from its own row instead, a realm's quests from its own list. */
export type Place =
  | "Guildmaster"
  | "Quests"
  | "Realms"
  | "Borderlands"
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
/** How many quests the sidebar lists under the Borderlands, and under each realm; the quest list page lists them all. */
const borderlandsShown = 3;
const realmShown = 3;

const isHovered = (state: unknown) => (state as { hovered?: boolean }).hovered === true;

/**
 * The mark that folds or unfolds what lies beneath a realm, quest, or side-quest row: the bow arrow, shown like the row's
 * actions only on hover or keyboard focus, in a place kept while unseen. A row with nothing beneath it keeps the place empty.
 */
function Chevron({
  focusProps,
  isOpen,
  isShown,
  label,
  onPress,
}: {
  focusProps: FocusProps;
  isOpen: boolean;
  isShown: boolean;
  label: string;
  /** Null where nothing lies beneath the row. */
  onPress: (() => void) | null;
}) {
  if (onPress === null) return <View style={local.chevron} />;
  return (
    <Pressable
      {...focusProps}
      accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${label}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      hitSlop={6}
      onPress={onPress}
      style={[local.chevron, !isShown && local.actionsHidden]}
    >
      <BowArrow color={colors.textMuted} isOpen={isOpen} size={15} />
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

/**
 * The small scroll after the name of a realm tied to a folder (CHG-0161); a realm tied to none has no mark. Hovering
 * shows the folder's full path: react-native-web passes no `title` on, so the web build sets it on the element itself.
 */
function ScrollCue({ path }: { path: string | null }) {
  const cue = scrollCueOf({ path });
  if (cue === null) return null;
  const setTitle = (element: unknown) => {
    const node = element as { setAttribute?: (name: string, value: string) => void } | null;
    if (Platform.OS === "web") node?.setAttribute?.("title", cue);
  };
  return (
    <View accessibilityLabel={cue} ref={setTitle} style={local.scrollCue}>
      <Svg
        fill="none"
        height={15}
        stroke={colors.textMuted}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
        width={15}
      >
        {/* A rolled parchment: its upper roll curled at the left, the sheet, and its lower roll curled at the right. */}
        <Path d="M6 6V5a2 2 0 1 0-4 0v1h4Zm0 0v12" />
        <Path d="M4 3h12a2 2 0 0 1 2 2v12" />
        <Path d="M6 18a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1H10v1a2 2 0 0 1-4 0Z" />
        <Path d="M9.5 8h5M9.5 12h5" />
      </Svg>
    </View>
  );
}

/** What an action button needs to keep its row's actions showing while it has the keyboard focus. */
type FocusProps = { readonly onBlur: () => void; readonly onFocus: () => void };

/**
 * A row's hover and keyboard focus, so its action buttons show only then (`areActionsShown`). The buttons keep their
 * place while unseen, so nothing moves when they appear; the row gets `rowProps`, each button and the row `focusProps`.
 */
const useRowActions = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [hasKeyboardFocusWithin, setHasKeyboardFocusWithin] = useState(false);
  // Only a keyboard focus shows them: the focus a click leaves behind does not, once the pointer moves away.
  const focusProps: FocusProps = {
    onBlur: () => setHasKeyboardFocusWithin(false),
    onFocus: () => setHasKeyboardFocusWithin(isKeyboardFocus()),
  };
  const isShown = areActionsShown({ hasKeyboardFocusWithin, isHovered });
  return {
    actionsStyle: [local.actions, !isShown && local.actionsHidden],
    focusProps,
    isShown,
    rowProps: { ...focusProps, onHoverIn: () => setIsHovered(true), onHoverOut: () => setIsHovered(false) },
  };
};

/**
 * A heading's fold mark: an archery arrow, its fletching at the tail and its head pointing right while the group is
 * folded and down while it is open.
 */
function BowArrow({ color = colors.text, isOpen, size = 22 }: { color?: string; isOpen: boolean; size?: number }) {
  return (
    <View style={isOpen && local.chevronMarkOpen}>
      <Svg
        fill="none"
        height={size}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
        width={size}
      >
        <Path d="M3 12h15" />
        <Path d="M21.5 12 16 8.5v7Z" fill={color} />
        <Path d="M3 12 1.5 9M3 12l-1.5 3M6 12 4.5 9M6 12l-1.5 3" />
      </Svg>
    </View>
  );
}

/** Opens a group's overview without changing its folded state. */
function OverviewButton({
  focusProps,
  isMain = false,
  label,
  onPress,
}: {
  focusProps: FocusProps;
  isMain?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      {...focusProps}
      accessibilityLabel={`Open ${label} overview`}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      style={(state) => [
        isMain ? local.add : local.newQuest,
        (state.pressed || isHovered(state)) && (isMain ? local.addHovered : local.newQuestHovered),
      ]}
    >
      <Svg
        fill="none"
        height={18}
        stroke={colors.textMuted}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
        width={18}
      >
        <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <Circle cx={12} cy={12} r={3} />
      </Svg>
    </Pressable>
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
  fold,
  label,
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
  /** The fold mark before the label of a quest or side-quest row; null `onPress` keeps its place empty. */
  fold?: { isOpen: boolean; label: string; onPress: (() => void) | null };
  onPress: () => void;
  textStyle?: object;
}) {
  const { focusProps, isShown, rowProps } = useRowActions();
  return (
    <Pressable
      {...rowProps}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        local.row,
        { paddingLeft: 6 + indent },
        // A main row's label starts where a heading's does: no gap after the icon, whose own margin spaces it.
        isMain && local.rowMain,
        (state.pressed || isHovered(state)) && local.rowHovered,
        isSelected && local.rowSelected,
      ]}
    >
      {fold !== undefined && <Chevron {...fold} focusProps={focusProps} isShown={isShown} />}
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
 * The heading of a group, with controls for its page, contents, and creation where applicable.
 */
function Heading({
  icon,
  isOpen,
  isSelected = false,
  label,
  note,
  onAdd,
  onNewQuest,
  onOverview,
  onPress,
  onToggle,
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
  onOverview?: () => void;
  onPress: () => void;
  onToggle?: () => void;
}) {
  const { actionsStyle, focusProps, isShown, rowProps } = useRowActions();
  return (
    <Pressable
      {...rowProps}
      accessibilityHint={note}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={isOpen === undefined ? {} : { expanded: isOpen }}
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
        <Text numberOfLines={1} style={local.headingTitle}>
          {label}
        </Text>
      </View>
      {isOpen !== undefined && (
        // Right after the title, and like the actions shown only on hover or focus; it keeps its place while unseen.
        <Pressable
          {...focusProps}
          accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${label}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          onPress={onToggle ?? onPress}
          style={[local.headingChevron, !isShown && local.actionsHidden]}
        >
          <BowArrow isOpen={isOpen} />
        </Pressable>
      )}
      <View style={local.flex} />
      <View style={actionsStyle}>
        {onOverview !== undefined && (
          <OverviewButton focusProps={focusProps} isMain label={label} onPress={onOverview} />
        )}
        {onAdd !== undefined && (
          <Pressable
            {...focusProps}
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
            {...focusProps}
            accessibilityLabel={`New quest in ${label.toLowerCase()}`}
            accessibilityRole="button"
            onPress={onNewQuest}
            style={(state) => [local.add, (state.pressed || isHovered(state)) && local.addHovered]}
          >
            <NewQuestIcon color={colors.highlight} />
          </Pressable>
        )}
      </View>
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
            fold={{
              isOpen: !collapsed.has(thread.id),
              label: thread.title,
              onPress: hasChildren ? () => onToggle(thread.id) : null,
            }}
            indent={depth * indentStep}
            isSelected={selectedThread === thread.id}
            label={foldedCount > 0 ? `${thread.title} +${foldedCount}` : thread.title}
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
        fold={{
          isOpen,
          label: mission.title,
          onPress: mission.threadCount > 1 ? () => onToggle(mission.id) : null,
        }}
        indent={chevronWidth}
        isSelected={isHere && (openThread === null || openThread === mission.topThreadId)}
        label={mission.title}
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

/**
 * A realm's row: its crest, its name with the folder mark when it is tied to a folder, its quest count, and its chevron,
 * always; its overview and new-quest buttons only while hovered or focused.
 */
function RealmHeader({
  crest,
  id,
  isOpen,
  name,
  onNewQuest,
  onOverview,
  onToggle,
  path,
  questCount,
}: {
  crest: Crest | null;
  id: WorkspaceId;
  isOpen: boolean;
  name: string;
  onNewQuest: () => void;
  onOverview: () => void;
  onToggle: () => void;
  path: string | null;
  questCount: number;
}) {
  const { actionsStyle, focusProps, isShown, rowProps } = useRowActions();
  return (
    <Pressable
      {...rowProps}
      accessibilityLabel={name}
      accessibilityRole="button"
      onPress={onToggle}
      style={(state) => [local.row, { paddingLeft: 6 }, (state.pressed || isHovered(state)) && local.rowHovered]}
    >
      <CrestBadge crest={crest} id={id} size={22} />
      <Text numberOfLines={1} style={[local.rowText, local.realmText]}>
        {name}
      </Text>
      <ScrollCue path={path} />
      <Chevron focusProps={focusProps} isOpen={isOpen} isShown={isShown} label={name} onPress={onToggle} />
      <View style={local.realmTextEnd} />
      <Count value={questCount} />
      <View style={actionsStyle}>
        <OverviewButton focusProps={focusProps} label={name} onPress={onOverview} />
        <Pressable
          {...focusProps}
          accessibilityLabel={`New quest in ${name}`}
          accessibilityRole="button"
          hitSlop={4}
          onPress={onNewQuest}
          style={(state) => [local.newQuest, (state.pressed || isHovered(state)) && local.newQuestHovered]}
        >
          <NewQuestIcon color={colors.textMuted} />
        </Pressable>
      </View>
    </Pressable>
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
  const toggle = (id: string) => setSet((current) => toggledFold(current, id));
  return { set, setSet, toggle };
};

/**
 * The left sidebar, in the agreed order: the logo, Guild Hall, the Realms with their quests, the Borderlands' quests, Rituals,
 * Craft, The Keep, Reserves, and the Workshop (the settings). Quests nest their side-quests at every depth,
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
  /** Opens the page that lists all of a realm's quests. */
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
  const placements = placementsOf(data?.missions ?? [], data?.workspaces ?? []);
  const isHere = (each: Place) => openMission === null && place === each;
  // A setting hides the Guild Hall entry; its screen is still where a realm page's message goes.
  const hasGuildHall = settings?.shouldShowGuildmaster !== false;
  // The menu that makes a realm, tied to a folder or to none.
  const [isCreating, setIsCreating] = useState(false);
  // Realms start open and quests start closed, so a long list of quests stays short; side-quests start open.
  const closedRealms = useToggles();
  // Realms, Borderlands, and The Keep fold under their headings, all the same way.
  const foldedSections = useToggles();
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
  const startQuest = (groupId: string, realmId: WorkspaceId | null) => {
    setNewQuestFailure(null);
    client
      .request({ _tag: "StartEmptyQuest", realmId, requestId: newRequestId() })
      .then((started) => {
        const unfold = (current: ReadonlySet<string>) => new Set([...current].filter((id) => id !== groupId));
        closedRealms.setSet(unfold);
        foldedSections.setSet(unfold);
        onOpenMission(started.missionId);
      })
      .catch((reason) => setNewQuestFailure({ groupId, message: messageOf(reason) }));
  };
  const failureUnder = (groupId: string) =>
    newQuestFailure?.groupId === groupId && <Text style={local.newQuestFailure}>{newQuestFailure.message}</Text>;

  /**
   * A realm: its crest, its name with the folder mark when it is tied to a folder, its quests beneath it while it is
   * unfolded, and the button for a new quest.
   */
  const realmRow = (realm: {
    crest: Crest | null;
    id: WorkspaceId;
    name: string;
    path: string | null;
    quests: ReadonlyArray<MissionSummary>;
  }) => {
    const isClosed = closedRealms.set.has(realm.id);
    return (
      <View key={realm.id}>
        <RealmHeader
          crest={realm.crest}
          id={realm.id}
          isOpen={!isClosed}
          name={realm.name}
          onNewQuest={() => startQuest(realm.id, realm.id)}
          onOverview={() => onOpenRealmQuests({ id: realm.id, name: realm.name })}
          onToggle={() => closedRealms.toggle(realm.id)}
          path={realm.path}
          questCount={realm.quests.length}
        />
        {failureUnder(realm.id)}
        {!isClosed && realm.quests.length === 0 && <Text style={local.emptyRealm}>No quest in this realm yet.</Text>}
        {!isClosed &&
          shownOf(realm.quests, realmShown).map((mission) => (
            <Quest {...questProps} isOpen={openQuests.set.has(mission.id)} key={mission.id} mission={mission} />
          ))}
        {!isClosed && realm.quests.length > realmShown && (
          <ShowAll
            count={realm.quests.length}
            onPress={() => onOpenRealmQuests({ id: realm.id, name: realm.name })}
            subject={realm.name}
          />
        )}
      </View>
    );
  };

  return (
    <View style={[local.sidebar, { width }]}>
      <ScrollView contentContainerStyle={local.group} style={local.flex}>
        <Image
          accessibilityLabel="Iskios"
          resizeMode="contain"
          source={require("../../assets/iskios-logo.png")}
          style={local.logo}
        />
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
          isOpen={!foldedSections.set.has("Realms")}
          isSelected={isHere("Realms")}
          label="Realms"
          note="Quests sharing lore, tied to a folder or repository or to none"
          onAdd={() => setIsCreating(true)}
          onPress={() => foldedSections.toggle("Realms")}
          onToggle={() => foldedSections.toggle("Realms")}
        />
        {!foldedSections.set.has("Realms") && placements.realms.length === 0 && (
          <Text style={local.empty}>No realm yet.</Text>
        )}
        {!foldedSections.set.has("Realms") &&
          placements.realms.map(({ quests, workspace }) =>
            realmRow({ crest: workspace.crest, id: workspace.id, name: workspace.name, path: workspace.path, quests }),
          )}

        <Gap />
        <Heading
          icon="borderlands"
          isOpen={!foldedSections.set.has("Borderlands")}
          isSelected={isHere("Borderlands")}
          label="Borderlands"
          note="Autonomous quests, with no workspace and no shared lore"
          onNewQuest={() => startQuest("Borderlands", null)}
          onOverview={() => onPlace("Borderlands")}
          onPress={() => foldedSections.toggle("Borderlands")}
          onToggle={() => foldedSections.toggle("Borderlands")}
        />
        {failureUnder("Borderlands")}
        {!foldedSections.set.has("Borderlands") && placements.borderlands.length === 0 && (
          <Text style={local.empty}>No quest yet.</Text>
        )}
        {!foldedSections.set.has("Borderlands") &&
          shownOf(placements.borderlands, borderlandsShown).map((mission) => (
            <Quest {...questProps} isOpen={openQuests.set.has(mission.id)} key={mission.id} mission={mission} />
          ))}
        {!foldedSections.set.has("Borderlands") && placements.borderlands.length > borderlandsShown && (
          <ShowAll
            count={placements.borderlands.length}
            onPress={() => onPlace("Borderlands")}
            subject="the Borderlands"
          />
        )}

        <Divider />
        <Row icon="rituals" isMain isSelected={isHere("Rituals")} label="Rituals" onPress={() => onPlace("Rituals")} />
        <Row icon="craft" isMain isSelected={isHere("Craft")} label="Craft" onPress={() => onPlace("Craft")} />
        <Divider />
        <Heading
          icon="the-keep"
          isOpen={!foldedSections.set.has("Keep")}
          label="The Keep"
          note="Library, lore, and the archive"
          onPress={() => foldedSections.toggle("Keep")}
          onToggle={() => foldedSections.toggle("Keep")}
        />
        {!foldedSections.set.has("Keep") &&
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
      {isCreating && (
        <NewRealmModal
          initial={{ crest: null, name: "", path: "" }}
          isFolderRequired={false}
          onCancel={() => setIsCreating(false)}
          onCreate={(realm) =>
            client.request({
              _tag: "CreateRealm",
              crest: realm.crest,
              name: realm.name,
              path: realm.path === "" ? null : realm.path,
            })
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
  actions: { alignItems: "center", flexDirection: "row", gap: 4 },
  // Unseen but in place: the row keeps its layout, and the keyboard can still reach the buttons.
  actionsHidden: { opacity: 0 },
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
    // Same 36 px as a main row (a 28 px icon with 4 px above and below), so the stack of categories is evenly spaced.
    minHeight: 36,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headingChevron: { alignItems: "center", height: 28, justifyContent: "center", marginLeft: 6, width: 28 },
  headingIcon: { alignItems: "center", marginRight: 8, width: 28 },
  // The title never gives up its width; the minimum rail width leaves room for the chevron and the actions.
  headingText: { flexShrink: 0 },
  headingTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
  iconColumn: { gap: 4, padding: 8 },
  iconRow: { alignItems: "center", borderRadius: radii.md, height: 36, justifyContent: "center" },
  // The owner's logo, tried large above the entries (CHG-0165); it replaces no icon.
  logo: { alignSelf: "center", height: 96, marginBottom: 4, marginTop: 4, width: 96 },
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
  // The name keeps only its own width, so the folder mark stands right after it.
  realmText: { flexBasis: "auto", flexGrow: 0, flexShrink: 1, fontWeight: "600" },
  realmTextEnd: { flex: 1 },
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
  rowMain: { gap: 0, minHeight: 36 },
  rowSelected: { backgroundColor: colors.controlActive },
  rowText: { color: colors.onGround, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base },
  rowTextMain: { color: colors.text, fontSize: fontSizes.lg, fontWeight: "700" },
  rowTextSelected: { color: colors.text, fontWeight: "600" },
  scrollCue: { flexShrink: 0, marginLeft: 5 },
  sidebar: {
    backgroundColor: colors.sidebar,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    width: expandedWidth,
  },
  sideQuestText: { fontSize: fontSizes.md },
  spending: { paddingHorizontal: 6, paddingVertical: 4 },
});
