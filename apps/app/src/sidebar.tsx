import type { MissionId, MissionSummary, WorkspaceId } from "@gild/contracts";
import { type ComponentRef, createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ReserveRows } from "./budgets";
import type { ServiceClient } from "./client";
import { Badge, Emblem, type EmblemName, RealmsIcon } from "./emblems";
import { tokenCountOf } from "./labels";
import { allMissions } from "./queries";
import { GildMark } from "./sketches";
import { colors, cut, fontSizes, fonts, ink, lift, radii } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

/** The places the sidebar leads to; a mission is opened from its list instead, a realm's quests from its own list. */
export type Place = "Guildmaster" | "Realms" | "Quests" | "Keep" | "Intel" | "Archived" | "Settings";

const SidebarShown = createContext(false);

/** Whether the sidebar shows, so a screen can leave out the links it already offers. */
export const useHasSidebar = () => useContext(SidebarShown);

/** The rail's width with its labels and as icons only; the collapse handle sits on its edge. */
const expandedWidth = 215;
const collapsedWidth = 56;
const handleSize = 26;

const TopBarShown = createContext(false);

/** Whether the window has a top bar, so a screen can leave out what the bar's icons already offer. */
export const useHasTopBar = () => useContext(TopBarShown);

const QuestPanelSetter = createContext<(panel: ReactNode) => void>(() => {});

/**
 * Hands the window's frame the quest's side panel, which it shows beside the top bar's icon, spanning the window's
 * height. The panel leaves with the screen that gave it. The frame redraws without the screen, so this cannot loop.
 */
export const useQuestPanel = (panel: ReactNode) => {
  const set = useContext(QuestPanelSetter);
  useEffect(() => set(panel));
  useEffect(() => () => set(null), [set]);
};

/** The quest's side panel as the top bar offers it: whether it shows, and how to show or hide it. */
export type DetailsToggle = { isOpen: boolean; onToggle: () => void };

/** The window width from which the sidebar shows beside the content; narrower windows keep the screens' own links. */
const sidebarBreakpoint = 820;

/** What the rail says about an icon the pointer rests on, and where: shown by the frame, outside the rail's scrolling. */
type RailTip = { label: string; x: number; y: number };

const RailTipSetter = createContext<(tip: RailTip | null) => void>(() => {});

/**
 * Hover handlers that name an icon-only row beside it: the label appears to the right of the row while the pointer
 * rests there, and leaves with it. Rows with their labels showing need none.
 */
const useRailTip = (label: string, isActive: boolean) => {
  const set = useContext(RailTipSetter);
  const row = useRef<ComponentRef<typeof View>>(null);
  return {
    onHoverIn: () => {
      if (isActive)
        row.current?.measureInWindow((x, y, width, height) => set({ label, x: x + width + 10, y: y + height / 2 }));
    },
    onHoverOut: () => set(null),
    ref: row,
  };
};

function NavItem({
  count,
  isCollapsed,
  isSelected,
  label,
  glyph,
  onPress,
  emblem,
  realm,
}: {
  /** A drawn icon for the row, in place of the text glyph. */
  emblem?: EmblemName;
  /** The id of the realm the row stands for, whose emblem replaces the glyph. */
  realm?: string;
  /** A number shown at the end of the row, such as a workspace's open missions; none when absent. */
  count?: number;
  /** Whether the rail shows icons only, so the label and the count leave the row. */
  isCollapsed: boolean;
  isSelected: boolean;
  label: string;
  glyph: string;
  onPress: () => void;
}) {
  const tip = useRailTip(label, isCollapsed);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onHoverIn={tip.onHoverIn}
      onHoverOut={tip.onHoverOut}
      onPress={onPress}
      ref={tip.ref}
      style={(state) => [
        local.item,
        isCollapsed && local.itemCollapsed,
        (state.pressed || (state as { hovered?: boolean }).hovered === true) && local.itemHovered,
        isSelected && local.itemSelected,
      ]}
    >
      {realm !== undefined ? (
        <Badge id={realm} />
      ) : emblem !== undefined ? (
        <Emblem name={emblem} tint={isSelected ? colors.gold : colors.onWood} />
      ) : (
        <Text style={[local.glyph, isSelected && local.textSelected]}>{glyph}</Text>
      )}
      {!isCollapsed && (
        <Text numberOfLines={1} style={[local.itemText, isSelected && local.textSelected]}>
          {label}
        </Text>
      )}
      {!isCollapsed && count !== undefined && count > 0 && <Text style={local.count}>{count}</Text>}
    </Pressable>
  );
}

function MissionItem({
  isCollapsed,
  isSelected,
  mission,
  onPress,
}: {
  isCollapsed: boolean;
  isSelected: boolean;
  mission: MissionSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={mission.title}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        local.item,
        isCollapsed && local.itemCollapsed,
        (state.pressed || (state as { hovered?: boolean }).hovered === true) && local.itemHovered,
        isSelected && local.itemSelected,
      ]}
    >
      <Badge id={mission.id} state={mission.state} />
      {!isCollapsed && (
        <Text numberOfLines={1} style={[local.itemText, local.missionText, isSelected && local.textSelected]}>
          {mission.title}
        </Text>
      )}
      {mission.prompt !== null && !isCollapsed && <View style={local.attention} />}
    </Pressable>
  );
}

/**
 * The last row of the Missions list: the archived missions, as a quieter row of the same list, with a box glyph
 * where a mission has its state dot and their count at the end.
 */
function ArchivedItem({
  client,
  isCollapsed,
  isSelected,
  onPress,
}: {
  client: ServiceClient;
  isCollapsed: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  const request = { _tag: "ListMissions", isArchived: true, search: null, state: null, workspaceId: null } as const;
  const { data } = useServiceQuery(client, request, `missions:${JSON.stringify(request)}`);
  const count = data?.missions.length ?? 0;
  const tip = useRailTip("Archives", isCollapsed);
  return (
    <Pressable
      accessibilityLabel="Archives"
      accessibilityRole="button"
      onHoverIn={tip.onHoverIn}
      onHoverOut={tip.onHoverOut}
      onPress={onPress}
      ref={tip.ref}
      style={(state) => [
        local.item,
        isCollapsed && local.itemCollapsed,
        (state.pressed || (state as { hovered?: boolean }).hovered === true) && local.itemHovered,
        isSelected && local.itemSelected,
      ]}
    >
      <Emblem name="tower" tint={isSelected ? colors.gold : colors.onWood} />
      {!isCollapsed && (
        <Text numberOfLines={1} style={[local.itemText, local.archivedText, isSelected && local.textSelected]}>
          Archives
        </Text>
      )}
      {!isCollapsed && count > 0 && <Text style={local.count}>{count}</Text>}
    </Pressable>
  );
}

/** The icon of a window with its left panel: the rail's collapse and expand button. */
function PanelIcon({ side = "left" }: { side?: "left" | "right" }) {
  return (
    <View style={[local.panelIcon, side === "right" && local.panelIconRight]}>
      <View style={side === "left" ? local.panelIconLeft : local.panelIconEnd} />
    </View>
  );
}

/** A section label in the rail: a drawn icon, a title, and a gilt rule beneath. */
function Section({ emblem, label }: { emblem?: EmblemName; label: string }) {
  return (
    <View style={local.sectionHeading}>
      {emblem !== undefined && <Emblem name={emblem} size={16} tint={colors.goldHi} />}
      <Text style={local.sectionTitle}>{label}</Text>
    </View>
  );
}

/**
 * A category of the rail that leads to its own place: its heading is pressed to go there, and stands out while that place
 * shows. Collapsed to icons, it is one icon row.
 */
function Category({
  emblem,
  hasRule = true,
  isCollapsed,
  isFolded,
  isSelected,
  label,
  onFold,
  onPress,
}: {
  emblem: EmblemName;
  /** Whether a gilt rule runs under the heading: only a category with rows beneath it has one. */
  hasRule?: boolean;
  isCollapsed: boolean;
  /** Whether its rows are folded away; only a category with rows has this and `onFold`. */
  isFolded?: boolean;
  isSelected: boolean;
  label: string;
  /** Folds or unfolds its rows. */
  onFold?: () => void;
  onPress: () => void;
}) {
  if (isCollapsed) {
    return <NavItem emblem={emblem} glyph="" isCollapsed isSelected={isSelected} label={label} onPress={onPress} />;
  }
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        local.sectionHeading,
        local.categoryHeading,
        !hasRule && local.unruled,
        (state.pressed || (state as { hovered?: boolean }).hovered === true) && local.itemHovered,
        isSelected && local.categorySelected,
      ]}
    >
      <Emblem name={emblem} size={16} tint={colors.goldHi} />
      <Text style={[local.sectionTitle, isSelected && local.categoryTitleSelected]}>{label}</Text>
      {onFold !== undefined && (
        <Pressable
          accessibilityLabel={`${isFolded === true ? "Unfold" : "Fold"} ${label}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isFolded !== true }}
          hitSlop={6}
          onPress={onFold}
          style={local.fold}
        >
          <Text style={[local.foldMark, isFolded !== true && local.foldMarkOpen]}>›</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

/**
 * The collapsed rail's one Realms button: a rail of icons cannot name every realm, so they gather in a list that opens
 * beside the button, each with its own emblem, the open ones counted, and the realm whose board shows marked.
 */
function RealmsMenu({
  isSelected,
  onAll,
  realms,
  selected,
  onWorkspace,
}: {
  /** Whether the Realms place shows. */
  isSelected: boolean;
  /** Opens the Realms place, every realm at once. */
  onAll: () => void;
  realms: readonly { count: number; id: WorkspaceId; name: string }[];
  /** The realm whose board shows, if any. */
  selected: WorkspaceId | null;
  onWorkspace: (id: WorkspaceId) => void;
}) {
  const [frame, setFrame] = useState<{ x: number; y: number } | null>(null);
  const tip = useRailTip("Realms", frame === null);
  const { height } = useWindowDimensions();
  const close = () => setFrame(null);
  const open = () => tip.ref.current?.measureInWindow((x, y, width) => setFrame({ x: x + width + 10, y }));
  const isOpen = frame !== null;
  return (
    <>
      <Pressable
        accessibilityLabel="Realms"
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onHoverIn={tip.onHoverIn}
        onHoverOut={tip.onHoverOut}
        onPress={isOpen ? close : open}
        ref={tip.ref}
        style={(state) => [
          local.item,
          local.itemCollapsed,
          (state.pressed || isOpen || (state as { hovered?: boolean }).hovered === true) && local.itemHovered,
          (selected !== null || isSelected) && local.itemSelected,
        ]}
      >
        <RealmsIcon tint={colors.onWood} />
        {realms.length > 0 && <Text style={local.menuCount}>{realms.length}</Text>}
      </Pressable>
      <Modal animationType="none" onRequestClose={close} transparent visible={isOpen}>
        <Pressable accessibilityLabel="Close the realms" onPress={close} style={StyleSheet.absoluteFill} />
        {frame !== null && (
          <View
            style={[local.flyout, { left: frame.x, maxHeight: Math.max(160, height - frame.y - 16), top: frame.y }]}
          >
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => {
                close();
                onAll();
              }}
            >
              <Text style={[local.flyoutTitle, local.flyoutLink]}>All realms ›</Text>
            </Pressable>
            <ScrollView>
              {realms.length === 0 && <Text style={local.flyoutEmpty}>No quest in a realm yet.</Text>}
              {realms.map((realm) => (
                <Pressable
                  accessibilityRole="menuitem"
                  key={realm.id}
                  onPress={() => {
                    close();
                    onWorkspace(realm.id);
                  }}
                  style={(state) => [
                    local.flyoutItem,
                    (state.pressed || (state as { hovered?: boolean }).hovered === true) && local.flyoutItemHovered,
                    realm.id === selected && local.flyoutItemSelected,
                  ]}
                >
                  <Badge id={realm.id} size={20} />
                  <Text numberOfLines={1} style={local.flyoutText}>
                    {realm.name}
                  </Text>
                  {realm.count > 0 && <Text style={local.flyoutCount}>{realm.count}</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </Modal>
    </>
  );
}

/**
 * The left rail: the app's name; Control on top, the board of every mission where missions start and where
 * Control's own thread will be pinned; the realms with their open quests and the quests with no realm, each with its
 * own emblem; the other places; and the spending against the global budget. Collapsed to icons, the rail gathers the
 * realms in one menu and leaves the quests to the Guildmaster's board.
 */
function Sidebar({
  client,
  isCollapsed,
  onOpenMission,
  onPlace,
  onWorkspace,
  openMission,
  place,
  workspaceId,
}: {
  client: ServiceClient;
  /** Whether the rail shows icons only. */
  isCollapsed: boolean;
  onOpenMission: (id: MissionId) => void;
  onPlace: (place: Place) => void;
  /** Opens the board of one workspace's missions. */
  onWorkspace: (id: WorkspaceId) => void;
  openMission: MissionId | null;
  place: Place | null;
  /** The workspace whose board shows, or null for every mission. */
  workspaceId: WorkspaceId | null;
}) {
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const missions = [...(data?.missions ?? [])].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  const loose = missions.filter((mission) => mission.workspaceId === null);
  const workspaces = [...(data?.workspaces ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const realms = workspaces.map((workspace) => ({
    count: missions.filter((mission) => mission.workspaceId === workspace.id && mission.state !== "Done").length,
    id: workspace.id,
    name: workspace.name,
  }));
  const isHere = (each: Place) => openMission === null && place === each;
  const [folded, setFolded] = useState(readFolded);
  const fold = (category: Foldable) => {
    const next = new Set(folded);
    if (!next.delete(category)) next.add(category);
    rememberFolded(next);
    setFolded(next);
  };
  const props = (category: Foldable) => ({ isFolded: folded.has(category), onFold: () => fold(category) });
  return (
    <View style={[local.sidebar, isCollapsed && local.sidebarCollapsed]}>
      <View style={[local.brand, isCollapsed && local.brandCollapsed]}>
        {isCollapsed ? (
          <GildMark />
        ) : (
          <>
            <View style={local.crest}>
              <GildMark size={38} />
            </View>
            <Text style={local.brandText}>Gild</Text>
          </>
        )}
      </View>
      <ScrollView contentContainerStyle={local.group} style={local.flex}>
        <Category
          emblem="crown"
          hasRule={false}
          isCollapsed={isCollapsed}
          isSelected={isHere("Guildmaster")}
          label="Guildmaster"
          onPress={() => onPlace("Guildmaster")}
        />
        {isCollapsed ? (
          <RealmsMenu
            isSelected={isHere("Realms")}
            onAll={() => onPlace("Realms")}
            onWorkspace={onWorkspace}
            realms={realms}
            selected={isHere("Quests") ? workspaceId : null}
          />
        ) : (
          <>
            <Category
              emblem="compass"
              isCollapsed={false}
              isSelected={isHere("Realms")}
              label="Realms"
              onPress={() => onPlace("Realms")}
              {...props("Realms")}
            />
            {!folded.has("Realms") && workspaces.length === 0 && (
              <Text style={local.empty}>No quest in a realm yet.</Text>
            )}
            {!folded.has("Realms") &&
              realms.map((realm) => (
                <NavItem
                  count={realm.count}
                  glyph="▱"
                  isCollapsed={false}
                  isSelected={isHere("Quests") && workspaceId === realm.id}
                  key={realm.id}
                  label={realm.name}
                  onPress={() => onWorkspace(realm.id)}
                  realm={realm.id}
                />
              ))}
          </>
        )}
        <Category
          emblem="sword"
          isCollapsed={isCollapsed}
          isSelected={isHere("Quests") && workspaceId === null}
          label="Quests"
          onPress={() => onPlace("Quests")}
          {...props("Quests")}
        />
        {!isCollapsed && !folded.has("Quests") && loose.length === 0 && (
          <Text style={local.empty}>None outside a realm.</Text>
        )}
        {!isCollapsed &&
          !folded.has("Quests") &&
          loose.map((mission) => (
            <MissionItem
              isCollapsed={false}
              isSelected={mission.id === openMission}
              key={mission.id}
              mission={mission}
              onPress={() => onOpenMission(mission.id)}
            />
          ))}
        <Category
          emblem="castle"
          isCollapsed={isCollapsed}
          isSelected={isHere("Keep")}
          label="The Keep"
          onPress={() => onPlace("Keep")}
          {...props("Keep")}
        />
        {!isCollapsed && !folded.has("Keep") && (
          <>
            <NavItem
              emblem="scroll"
              glyph=""
              isCollapsed={false}
              isSelected={isHere("Intel")}
              label="Lore"
              onPress={() => onPlace("Intel")}
            />
            <ArchivedItem
              client={client}
              isCollapsed={false}
              isSelected={isHere("Archived")}
              onPress={() => onPlace("Archived")}
            />
          </>
        )}
        <Category
          emblem="key"
          hasRule={false}
          isCollapsed={isCollapsed}
          isSelected={isHere("Settings")}
          label="Settings"
          onPress={() => onPlace("Settings")}
        />
      </ScrollView>
      {!isCollapsed && (
        <View style={local.footer}>
          <Spending client={client} />
        </View>
      )}
    </View>
  );
}

/**
 * The spending of the global budget's current period, as meters when it has limits and as a line otherwise. The
 * harnesses' own plan limits are not read yet (backlog), so the rail shows only what Gild counts.
 */
function Spending({ client }: { client: ServiceClient }) {
  const { data: global } = useServiceQuery(client, { _tag: "ReadBudget", missionId: null }, "budget:global");
  if (global === null) return null;
  const hasLimits = global.limits.cost !== null || global.limits.tokens !== null;
  return (
    <View style={local.spending}>
      <Section emblem="gem" label="Reserves" />
      {hasLimits ? (
        <ReserveRows use={global} />
      ) : (
        <Text style={local.empty}>
          {tokenCountOf(global.spent.tokens)} tokens
          {global.spent.cost > 0 ? ` · $${global.spent.cost.toFixed(2)}` : ""}
        </Text>
      )}
    </View>
  );
}

/** Whether the desktop window has no system title bar, so the top bar takes its place. */
const hasOwnTitleBar = typeof window !== "undefined" && window.gild?.hasOwnTitleBar === true;

// Electron drags the window by a region marked this way; react-native-web passes the property to the page.
const dragRegion = { WebkitAppRegion: "drag" } as object;
const noDragRegion = { WebkitAppRegion: "no-drag" } as object;

/** The key under which the browser remembers whether the rail is collapsed. */
const collapsedKey = "gild:sidebar-collapsed";

/** Reads the remembered rail state; a platform without browser storage starts expanded. */
const readCollapsed = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(collapsedKey) === "1";
  } catch {
    return false;
  }
};

/** Remembers the rail state where the platform allows; a refusal only loses the memory. */
const rememberCollapsed = (isCollapsed: boolean) => {
  try {
    globalThis.localStorage?.setItem(collapsedKey, isCollapsed ? "1" : "0");
  } catch {}
};

/** The key under which the browser remembers which rail categories are folded. */
const foldedKey = "gild:sidebar-folded";

/** The rail's categories that can fold their rows away. */
type Foldable = "Realms" | "Quests" | "Keep";

/** Reads the remembered folded categories; a platform without browser storage starts with all unfolded. */
const readFolded = (): ReadonlySet<Foldable> => {
  try {
    const stored: unknown = JSON.parse(globalThis.localStorage?.getItem(foldedKey) ?? "[]");
    return new Set(
      Array.isArray(stored)
        ? stored.filter((x): x is Foldable => x === "Realms" || x === "Quests" || x === "Keep")
        : [],
    );
  } catch {
    return new Set();
  }
};

/** Remembers the folded categories where the platform allows; a refusal only loses the memory. */
const rememberFolded = (folded: ReadonlySet<Foldable>) => {
  try {
    globalThis.localStorage?.setItem(foldedKey, JSON.stringify([...folded]));
  } catch {}
};

/** One step of the path to where the owner is; the last is the current screen and leads nowhere. */
type Crumb = {
  /** An icon before the label, the one the rail shows for the same place. */
  glyph?: string;
  label: string;
  onPress: (() => void) | null;
};

/**
 * The top bar: the path to where the owner is (the guild board, the realm, the open quest), each step before the last
 * leading back to it, and at the end the spending, which the collapsed rail no longer shows.
 */
function TopBar({
  client,
  crumbs,
  details,
}: {
  client: ServiceClient;
  crumbs: readonly Crumb[];
  /** The icon that shows or hides the quest's side panel; none outside a quest. */
  details: DetailsToggle | null;
}) {
  return (
    // As the macOS title bar the bar drags the window, and leaves room for the traffic lights at its start.
    <View style={[local.topBar, hasOwnTitleBar && local.topBarTitle, hasOwnTitleBar && dragRegion]}>
      <View accessibilityLabel="Breadcrumbs" style={local.crumbs}>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <View key={crumb.label} style={[local.crumb, isLast && local.crumbLast]}>
              {index > 0 && <Text style={local.crumbSeparator}>›</Text>}
              {crumb.glyph !== undefined && <Text style={local.crumbGlyph}>{crumb.glyph}</Text>}
              {crumb.onPress === null ? (
                <Text numberOfLines={1} style={[local.crumbText, local.crumbCurrent]}>
                  {crumb.label}
                </Text>
              ) : (
                <Pressable accessibilityRole="link" onPress={crumb.onPress} style={noDragRegion}>
                  {({ pressed }) => (
                    <Text numberOfLines={1} style={[local.crumbText, local.crumbLink, pressed && local.crumbPressed]}>
                      {crumb.label}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      <SpendingLine client={client} />
      {details !== null && (
        <Pressable
          accessibilityLabel={details.isOpen ? "Hide quest panel" : "Show quest panel"}
          accessibilityRole="button"
          onPress={details.onToggle}
          style={({ pressed }) => [local.topIcon, (pressed || details.isOpen) && local.topIconActive, noDragRegion]}
        >
          <PanelIcon side="right" />
        </Pressable>
      )}
    </View>
  );
}

/**
 * The path to where the owner is, for the top bar, following the rail: a place on its own; a realm under Realms; a quest
 * under its realm, or under Quests when it has none; Lore and Archives under The Keep. Each step before the last leads
 * back to its place.
 */
const crumbsOf = ({
  missions,
  onPlace,
  onWorkspace,
  openMission,
  place,
  realm,
  workspaces,
}: {
  missions: readonly MissionSummary[];
  onPlace: (place: Place) => void;
  onWorkspace: (id: WorkspaceId) => void;
  openMission: MissionId | null;
  place: Place | null;
  realm: { id: WorkspaceId; name: string } | null;
  workspaces: readonly { id: WorkspaceId; name: string }[];
}): Crumb[] => {
  const to = (label: string, target: Place): Crumb => ({ label, onPress: () => onPlace(target) });
  const here = (label: string, glyph?: string): Crumb =>
    glyph === undefined ? { label, onPress: null } : { glyph, label, onPress: null };
  if (openMission !== null) {
    const mission = missions.find((each) => each.id === openMission);
    const own = workspaces.find((each) => each.id === mission?.workspaceId);
    const current = here(mission?.title ?? "Quest");
    if (own === undefined) return [to("Quests", "Quests"), current];
    return [to("Realms", "Realms"), { label: own.name, onPress: () => onWorkspace(own.id) }, current];
  }
  if (place === "Intel") return [to("The Keep", "Keep"), here("Lore")];
  if (place === "Archived") return [to("The Keep", "Keep"), here("Archives", "▤")];
  if (place === "Keep") return [here("The Keep")];
  if (place === "Settings") return [here("Settings")];
  if (place === "Realms") return [here("Realms")];
  if (place === "Quests" && realm !== null) return [to("Realms", "Realms"), here(realm.name)];
  if (place === "Quests") return [here("Quests")];
  return [here("Guildmaster")];
};

/** The spending of the global budget's period as one line; nothing while it is unread. */
function SpendingLine({ client }: { client: ServiceClient }) {
  const { data: global } = useServiceQuery(client, { _tag: "ReadBudget", missionId: null }, "budget:global");
  if (global === null) return null;
  return (
    <Text style={local.topSpending}>
      {tokenCountOf(global.spent.tokens)} tokens
      {global.spent.cost > 0 ? ` · $${global.spent.cost.toFixed(2)}` : ""}
    </Text>
  );
}

/**
 * The quest panel's column: a header with the close button, level with the top bar, over the panel. On a wide window
 * it spans the window's height beside the top bar; on a narrow one it takes the content's place.
 */
function QuestColumn({ children, isWide, onClose }: { children: ReactNode; isWide: boolean; onClose: () => void }) {
  return (
    <View style={isWide ? local.questColumn : local.questColumnNarrow}>
      <View style={local.topBar}>
        <Pressable
          accessibilityLabel="Hide quest panel"
          accessibilityRole="button"
          onPress={onClose}
          style={noDragRegion}
        >
          <Text style={local.questClose}>✕</Text>
        </Pressable>
        <Text style={[local.crumbText, local.crumbCurrent]}>Quest</Text>
      </View>
      <View style={local.questBody}>{children}</View>
    </View>
  );
}

/**
 * The window's frame: on a wide window the sidebar, which collapses to icons, beside a top bar over the content; on
 * a narrow one the content alone.
 */
export function Shell(
  props: Omit<Parameters<typeof Sidebar>[0], "isCollapsed"> & { children: ReactNode; details: DetailsToggle | null },
) {
  const { width } = useWindowDimensions();
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [questPanel, setQuestPanel] = useState<ReactNode>(null);
  const { data } = useServiceQuery(props.client, allMissions.request, allMissions.key);
  const hasRail = width >= sidebarBreakpoint;
  const [tip, setTip] = useState<RailTip | null>(null);
  const toggle = () => {
    rememberCollapsed(!isCollapsed);
    setIsCollapsed(!isCollapsed);
    setTip(null);
  };
  // Command or Control with B shows or hides the rail, as in editors; the browser's own handling is kept elsewhere.
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  useEffect(() => {
    if (!hasRail || typeof document === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasRail]);
  const workspaces = data?.workspaces ?? [];
  const crumbs = crumbsOf({
    missions: data?.missions ?? [],
    onPlace: props.onPlace,
    onWorkspace: props.onWorkspace,
    openMission: props.openMission,
    place: props.place,
    realm: workspaces.find((workspace) => workspace.id === props.workspaceId) ?? null,
    workspaces,
  });
  const { details } = props;
  const isPanelShown = details?.isOpen === true && questPanel !== null;
  const panelColumn = isPanelShown && details !== null && (
    <QuestColumn isWide={hasRail} onClose={details.onToggle}>
      {questPanel}
    </QuestColumn>
  );
  // Narrow windows keep the screens' own links; as the macOS title bar the top bar stays, over the content alone. An
  // open quest panel takes the content's place; the content stays mounted, so the open thread is kept.
  if (!hasRail) {
    return (
      <QuestPanelSetter.Provider value={setQuestPanel}>
        <TopBarShown.Provider value={hasOwnTitleBar}>
          <View style={local.narrow}>
            {hasOwnTitleBar && <TopBar client={props.client} crumbs={crumbs} details={details} />}
            <View style={[local.narrowContent, isPanelShown && local.hidden]}>{props.children}</View>
            {panelColumn}
          </View>
        </TopBarShown.Provider>
      </QuestPanelSetter.Provider>
    );
  }
  return (
    <QuestPanelSetter.Provider value={setQuestPanel}>
      <SidebarShown.Provider value={true}>
        <TopBarShown.Provider value={true}>
          <RailTipSetter.Provider value={setTip}>
            <View style={local.window}>
              <View style={local.windowMain}>
                <TopBar client={props.client} crumbs={crumbs} details={details} />
                <View style={local.frame}>
                  <Sidebar {...props} isCollapsed={isCollapsed} />
                  <Pressable
                    accessibilityLabel={isCollapsed ? "Expand sidebar (⌘B)" : "Collapse sidebar (⌘B)"}
                    accessibilityRole="button"
                    onPress={toggle}
                    style={({ pressed }) => [
                      local.handle,
                      { left: (isCollapsed ? collapsedWidth : expandedWidth) - handleSize / 2 },
                      pressed && local.handlePressed,
                    ]}
                  >
                    <PanelIcon />
                  </Pressable>
                  <View style={local.panel}>{props.children}</View>
                </View>
              </View>
              {panelColumn}
              {tip !== null && (
                <View pointerEvents="none" style={[local.tip, { left: tip.x, top: tip.y - 15 }]}>
                  <Text style={local.tipText}>{tip.label}</Text>
                </View>
              )}
            </View>
          </RailTipSetter.Provider>
        </TopBarShown.Provider>
      </SidebarShown.Provider>
    </QuestPanelSetter.Provider>
  );
}

const local = StyleSheet.create({
  archivedText: { color: colors.onWood },
  attention: { backgroundColor: colors.warning, borderRadius: radii.pill, height: 7, width: 7 },
  brand: { alignItems: "center", gap: 6, paddingBottom: 10, paddingTop: 2 },
  brandCollapsed: { justifyContent: "center", paddingHorizontal: 0 },
  brandText: {
    color: colors.goldHi,
    fontFamily: fonts.hand,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 5,
    lineHeight: 34,
    textTransform: "uppercase",
  },
  categoryHeading: { borderRadius: radii.sm, marginTop: 10 },
  categorySelected: { backgroundColor: colors.canvas },
  categoryTitleSelected: { color: colors.text },
  count: { color: colors.onWood, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  crest: {
    alignItems: "center",
    backgroundColor: colors.danger,
    height: 62,
    justifyContent: "flex-start",
    paddingTop: 8,
    width: 56,
    // The swallowtail notch is web-only; native shows a plain banner.
    ...(Platform.OS === "web" ? ({ clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)" } as object) : {}),
  },
  crumb: { alignItems: "center", flexDirection: "row", flexShrink: 0, gap: 8 },
  crumbCurrent: { color: colors.onWood },
  crumbGlyph: { color: colors.onWood, fontSize: fontSizes.md },
  crumbLast: { flexShrink: 1 },
  crumbLink: { color: colors.goldHi },
  crumbPressed: { opacity: 0.7 },
  crumbSeparator: { color: colors.gold, fontFamily: fonts.sans, fontSize: fontSizes.lg },
  crumbs: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, overflow: "hidden" },
  crumbText: { fontFamily: fonts.hand, fontSize: fontSizes.lg },
  empty: { color: colors.onWood, fontFamily: fonts.sans, fontSize: fontSizes.md, paddingHorizontal: 10 },
  flex: { flex: 1 },
  flyout: {
    ...ink,
    ...cut,
    ...lift,
    backgroundColor: colors.canvas,
    minWidth: 220,
    padding: 6,
    position: "absolute",
  },
  flyoutCount: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  flyoutEmpty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md, padding: 8 },
  flyoutItem: { alignItems: "center", borderRadius: radii.sm, flexDirection: "row", gap: 10, padding: 8 },
  flyoutItemHovered: { backgroundColor: colors.controlHover },
  flyoutItemSelected: { backgroundColor: colors.controlActive },
  flyoutLink: { color: colors.accentText },
  flyoutText: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  flyoutTitle: {
    color: colors.textMuted,
    fontFamily: fonts.hand,
    fontSize: 12,
    letterSpacing: 1.4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  fold: { alignItems: "center", height: 20, justifyContent: "center", marginLeft: "auto", width: 20 },
  foldMark: { color: colors.goldHi, fontFamily: fonts.sans, fontSize: 18, lineHeight: 20 },
  foldMarkOpen: { transform: [{ rotate: "90deg" }] },
  footer: { paddingBottom: 4 },
  frame: { backgroundColor: colors.wood, flex: 1, flexDirection: "row", overflow: "hidden" },
  glyph: { color: colors.onWood, fontSize: fontSizes.md, textAlign: "center", width: 16 },
  group: { gap: 2 },
  handle: {
    alignItems: "center",
    backgroundColor: colors.leather,
    borderColor: colors.gold,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: handleSize,
    justifyContent: "center",
    marginTop: -handleSize / 2,
    position: "absolute",
    top: "50%",
    width: handleSize,
  },
  handlePressed: { backgroundColor: colors.wood },
  hidden: { display: "none" },
  item: {
    ...cut,
    alignItems: "center",
    borderColor: "transparent",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  itemCollapsed: { justifyContent: "center", paddingHorizontal: 0 },
  itemHovered: { backgroundColor: colors.wood },
  itemSelected: { ...ink, ...lift, backgroundColor: colors.canvas },
  itemText: { color: colors.onWood, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  menuCount: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    color: colors.leather,
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14,
    minWidth: 14,
    position: "absolute",
    right: 4,
    textAlign: "center",
    top: 1,
  },
  missionText: { fontSize: fontSizes.md },
  narrow: { backgroundColor: colors.paper, flex: 1 },
  narrowContent: { flex: 1 },
  panel: {
    backgroundColor: colors.paper,
    borderColor: colors.borderStrong,
    borderLeftWidth: 1.5,
    flex: 1,
    overflow: "hidden",
  },
  panelIcon: {
    borderColor: colors.onWood,
    borderRadius: 3,
    borderWidth: 1.5,
    flexDirection: "row",
    height: 13,
    overflow: "hidden",
    width: 16,
  },
  panelIconEnd: { borderColor: colors.onWood, borderLeftWidth: 1.5, marginLeft: "auto", width: 5 },
  panelIconLeft: { borderColor: colors.onWood, borderRightWidth: 1.5, width: 5 },
  panelIconRight: { justifyContent: "flex-end" },
  questBody: { backgroundColor: colors.paper, flex: 1 },
  questClose: { color: colors.goldHi, fontSize: fontSizes.base, paddingHorizontal: 4 },
  questColumn: { borderColor: colors.gold, borderLeftWidth: 1, width: 360 },
  questColumnNarrow: { flex: 1 },
  sectionHeading: {
    alignItems: "center",
    borderBottomColor: colors.gold,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
    marginTop: 14,
    paddingBottom: 4,
    paddingHorizontal: 6,
  },
  sectionRule: { borderColor: colors.border, borderTopWidth: 1, marginHorizontal: 10, marginVertical: 8 },
  sectionTitle: {
    color: colors.goldHi,
    fontFamily: fonts.hand,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  sidebar: {
    backgroundColor: colors.leather,
    borderColor: colors.gold,
    borderRightWidth: 1,
    gap: 2,
    padding: 12,
    width: expandedWidth,
  },
  sidebarCollapsed: { paddingHorizontal: 6, width: collapsedWidth },
  spending: { paddingBottom: 4 },
  textSelected: { color: colors.text, fontWeight: "600" },
  tip: {
    ...cut,
    backgroundColor: colors.canvas,
    borderColor: colors.gold,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: "absolute",
    zIndex: 10,
  },
  tipText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.leather,
    borderBottomColor: colors.gold,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 40,
    paddingHorizontal: 10,
  },
  topBarTitle: { paddingLeft: 82 },
  topIcon: { alignItems: "center", borderRadius: radii.sm, height: 28, justifyContent: "center", width: 28 },
  topIconActive: { backgroundColor: colors.wood },
  topSpending: { color: colors.onWood, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  unruled: { borderBottomColor: "transparent" },
  window: { backgroundColor: colors.wood, flex: 1, flexDirection: "row" },
  windowMain: { flex: 1 },
});
