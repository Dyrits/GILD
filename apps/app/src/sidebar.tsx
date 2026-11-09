import type { MissionId, MissionSummary, WorkspaceId } from "@gild/contracts";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { BudgetMeters } from "./budgets";
import type { ServiceClient } from "./client";
import { tokenCountOf } from "./labels";
import { allMissions } from "./queries";
import { GildMark } from "./sketches";
import { colors, cut, fontSizes, fonts, ink, lift, radii, stateTones } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

/** The places the sidebar leads to; a mission is opened from its list instead, a workspace's board from its own list. */
export type Place = "Control" | "Intel" | "Archived" | "Settings";

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

const placeGlyphs = { Archived: "▤", Control: "◎", Intel: "◆", Settings: "⚙" } as const satisfies Record<Place, string>;

function NavItem({
  count,
  isCollapsed,
  isSelected,
  label,
  glyph,
  onPress,
}: {
  /** A number shown at the end of the row, such as a workspace's open missions; none when absent. */
  count?: number;
  /** Whether the rail shows icons only, so the label and the count leave the row. */
  isCollapsed: boolean;
  isSelected: boolean;
  label: string;
  glyph: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        local.item,
        isCollapsed && local.itemCollapsed,
        pressed && local.itemHovered,
        isSelected && local.itemSelected,
      ]}
    >
      <Text style={[local.glyph, isSelected && local.textSelected]}>{glyph}</Text>
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
      style={({ pressed }) => [
        local.item,
        isCollapsed && local.itemCollapsed,
        pressed && local.itemHovered,
        isSelected && local.itemSelected,
      ]}
    >
      <View style={[local.dot, { backgroundColor: stateTones[mission.state].color }]} />
      {!isCollapsed && (
        <Text numberOfLines={1} style={[local.itemText, local.missionText, isSelected && local.textSelected]}>
          {mission.title}
        </Text>
      )}
      {mission.prompt !== null && <View style={local.attention} />}
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
  return (
    <Pressable
      accessibilityLabel="Archives"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        local.item,
        isCollapsed && local.itemCollapsed,
        pressed && local.itemHovered,
        isSelected && local.itemSelected,
      ]}
    >
      <Text style={local.archivedGlyph}>▤</Text>
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

/** A handwritten section label in the rail. */
function Section({ isCollapsed = false, label }: { isCollapsed?: boolean; label: string }) {
  return isCollapsed ? <View style={local.sectionRule} /> : <Text style={local.section}>{label}</Text>;
}

/**
 * The left rail: the app's name; Control on top, the board of every mission where missions start and where
 * Control's own thread will be pinned; the workspaces with their missions still open; the missions with no
 * workspace; the other places; and the spending against the global budget.
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
  const isOnBoard = openMission === null && place === "Control";
  return (
    <View style={[local.sidebar, isCollapsed && local.sidebarCollapsed]}>
      <View style={[local.brand, isCollapsed && local.brandCollapsed]}>
        <GildMark />
        {!isCollapsed && <Text style={local.brandText}>Gild</Text>}
      </View>
      <NavItem
        glyph={placeGlyphs.Control}
        isCollapsed={isCollapsed}
        isSelected={isOnBoard && workspaceId === null}
        label="Guildmaster"
        onPress={() => onPlace("Control")}
      />
      <ScrollView contentContainerStyle={local.group} style={local.flex}>
        <Section isCollapsed={isCollapsed} label="Realms" />
        {!isCollapsed && workspaces.length === 0 && <Text style={local.empty}>No quest in a realm yet.</Text>}
        {workspaces.map((workspace) => (
          <NavItem
            count={
              missions.filter((mission) => mission.workspaceId === workspace.id && mission.state !== "Done").length
            }
            glyph="▱"
            isCollapsed={isCollapsed}
            isSelected={isOnBoard && workspaceId === workspace.id}
            key={workspace.id}
            label={workspace.name}
            onPress={() => onWorkspace(workspace.id)}
          />
        ))}
        <Section isCollapsed={isCollapsed} label="Quests" />
        {!isCollapsed && loose.length === 0 && <Text style={local.empty}>None outside a realm.</Text>}
        {loose.map((mission) => (
          <MissionItem
            isCollapsed={isCollapsed}
            isSelected={mission.id === openMission}
            key={mission.id}
            mission={mission}
            onPress={() => onOpenMission(mission.id)}
          />
        ))}
        <ArchivedItem
          client={client}
          isCollapsed={isCollapsed}
          isSelected={openMission === null && place === "Archived"}
          onPress={() => onPlace("Archived")}
        />
      </ScrollView>
      <View style={local.footer}>
        {(["Intel", "Settings"] as const).map((each) => (
          <NavItem
            glyph={placeGlyphs[each]}
            isCollapsed={isCollapsed}
            isSelected={openMission === null && place === each}
            key={each}
            label={each === "Intel" ? "Lore" : "Settings"}
            onPress={() => onPlace(each)}
          />
        ))}
        {!isCollapsed && <Spending client={client} />}
      </View>
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
      <Section label="Reserves" />
      {hasLimits ? (
        <BudgetMeters use={global} />
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
 * The path to where the owner is, for the top bar, following the rail: the Guildmaster board; a realm under Realms; a
 * quest under its realm, or under Quests when it has none; the archives under Quests. Realms and Quests are the rail's
 * section labels, so they lead nowhere. Lore and Settings stand alone.
 */
const crumbsOf = ({
  missions,
  onWorkspace,
  openMission,
  place,
  realm,
  workspaces,
}: {
  missions: readonly MissionSummary[];
  onWorkspace: (id: WorkspaceId) => void;
  openMission: MissionId | null;
  place: Place | null;
  realm: { id: WorkspaceId; name: string } | null;
  workspaces: readonly { id: WorkspaceId; name: string }[];
}): Crumb[] => {
  const realms: Crumb = { label: "Realms", onPress: null };
  const quests: Crumb = { label: "Quests", onPress: null };
  if (openMission !== null) {
    const mission = missions.find((each) => each.id === openMission);
    const own = workspaces.find((each) => each.id === mission?.workspaceId);
    const current: Crumb = { label: mission?.title ?? "Quest", onPress: null };
    if (own === undefined) return [quests, current];
    return [realms, { label: own.name, onPress: () => onWorkspace(own.id) }, current];
  }
  if (place === "Intel") return [{ label: "Lore", onPress: null }];
  if (place === "Settings") return [{ label: "Settings", onPress: null }];
  if (place === "Archived") return [quests, { glyph: "▤", label: "Archives", onPress: null }];
  if (realm !== null) return [realms, { label: realm.name, onPress: null }];
  return [{ label: "Guildmaster", onPress: null }];
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
  const toggle = () => {
    rememberCollapsed(!isCollapsed);
    setIsCollapsed(!isCollapsed);
  };
  const workspaces = data?.workspaces ?? [];
  const crumbs = crumbsOf({
    missions: data?.missions ?? [],
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
          <View style={local.window}>
            <View style={local.windowMain}>
              <TopBar client={props.client} crumbs={crumbs} details={details} />
              <View style={local.frame}>
                <Sidebar {...props} isCollapsed={isCollapsed} />
                <Pressable
                  accessibilityLabel={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
          </View>
        </TopBarShown.Provider>
      </SidebarShown.Provider>
    </QuestPanelSetter.Provider>
  );
}

const local = StyleSheet.create({
  // As wide as a mission's dot with its margins, so the label lines up with the missions' titles.
  archivedGlyph: { color: colors.onWood, fontSize: fontSizes.sm, textAlign: "center", width: 13 },
  archivedText: { color: colors.onWood },
  attention: { backgroundColor: colors.warning, borderRadius: radii.pill, height: 7, width: 7 },
  brand: { alignItems: "center", flexDirection: "row", gap: 8, paddingBottom: 12, paddingHorizontal: 8, paddingTop: 4 },
  brandCollapsed: { justifyContent: "center", paddingHorizontal: 0 },
  brandText: { color: colors.goldHi, fontFamily: fonts.hand, fontSize: 28, lineHeight: 32 },
  count: { color: colors.onWood, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  crumb: { alignItems: "center", flexDirection: "row", flexShrink: 0, gap: 8 },
  crumbCurrent: { color: colors.onWood },
  crumbGlyph: { color: colors.onWood, fontSize: fontSizes.md },
  crumbLast: { flexShrink: 1 },
  crumbLink: { color: colors.goldHi },
  crumbPressed: { opacity: 0.7 },
  crumbSeparator: { color: colors.gold, fontFamily: fonts.sans, fontSize: fontSizes.lg },
  crumbs: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, overflow: "hidden" },
  crumbText: { fontFamily: fonts.hand, fontSize: fontSizes.lg },
  dot: { borderRadius: radii.pill, height: 7, marginHorizontal: 3, width: 7 },
  empty: { color: colors.onWood, fontFamily: fonts.sans, fontSize: fontSizes.md, paddingHorizontal: 10 },
  flex: { flex: 1 },
  footer: { borderColor: colors.border, borderTopWidth: 1.5, paddingTop: 8 },
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
  questColumn: { borderColor: colors.gold, borderLeftWidth: 1, width: 300 },
  questColumnNarrow: { flex: 1 },
  section: {
    color: colors.onWood,
    fontFamily: fonts.hand,
    fontSize: 12,
    letterSpacing: 1.4,
    paddingBottom: 2,
    paddingHorizontal: 8,
    paddingTop: 14,
    textTransform: "uppercase",
  },
  sectionRule: { borderColor: colors.border, borderTopWidth: 1, marginHorizontal: 10, marginVertical: 8 },
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
  window: { backgroundColor: colors.wood, flex: 1, flexDirection: "row" },
  windowMain: { flex: 1 },
});
