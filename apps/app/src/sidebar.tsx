import type { MissionId, MissionSummary, WorkspaceId } from "@canopy/contracts";
import { createContext, type ReactNode, useContext } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { BudgetMeters } from "./budgets";
import type { ServiceClient } from "./client";
import { tokenCountOf } from "./labels";
import { allMissions } from "./queries";
import { CanopyMark } from "./sketches";
import { colors, cut, fontSizes, fonts, ink, lift, radii, stateTones } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

/** The places the sidebar leads to; a mission is opened from its list instead, a workspace's board from its own list. */
export type Place = "Control" | "Intel" | "Archived" | "Settings";

const SidebarShown = createContext(false);

/** Whether the sidebar shows, so a screen can leave out the links it already offers. */
export const useHasSidebar = () => useContext(SidebarShown);

/** The window width from which the sidebar shows beside the content; narrower windows keep the screens' own links. */
const sidebarBreakpoint = 820;

const placeGlyphs = { Archived: "▤", Control: "◎", Intel: "◆", Settings: "⚙" } as const satisfies Record<Place, string>;

function NavItem({
  count,
  isSelected,
  label,
  glyph,
  onPress,
}: {
  /** A number shown at the end of the row, such as a workspace's open missions; none when absent. */
  count?: number;
  isSelected: boolean;
  label: string;
  glyph: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.item, pressed && local.itemHovered, isSelected && local.itemSelected]}
    >
      <Text style={[local.glyph, isSelected && local.textSelected]}>{glyph}</Text>
      <Text numberOfLines={1} style={[local.itemText, isSelected && local.textSelected]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && <Text style={local.count}>{count}</Text>}
    </Pressable>
  );
}

function MissionItem({
  isSelected,
  mission,
  onPress,
}: {
  isSelected: boolean;
  mission: MissionSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.item, pressed && local.itemHovered, isSelected && local.itemSelected]}
    >
      <View style={[local.dot, { backgroundColor: stateTones[mission.state].color }]} />
      <Text numberOfLines={1} style={[local.itemText, local.missionText, isSelected && local.textSelected]}>
        {mission.title}
      </Text>
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
  isSelected,
  onPress,
}: {
  client: ServiceClient;
  isSelected: boolean;
  onPress: () => void;
}) {
  const request = { _tag: "ListMissions", isArchived: true, search: null, state: null, workspaceId: null } as const;
  const { data } = useServiceQuery(client, request, `missions:${JSON.stringify(request)}`);
  const count = data?.missions.length ?? 0;
  return (
    <Pressable
      accessibilityLabel="Archived missions"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.item, pressed && local.itemHovered, isSelected && local.itemSelected]}
    >
      <Text style={local.archivedGlyph}>▤</Text>
      <Text numberOfLines={1} style={[local.itemText, local.archivedText, isSelected && local.textSelected]}>
        Archived
      </Text>
      {count > 0 && <Text style={local.count}>{count}</Text>}
    </Pressable>
  );
}

/** A handwritten section label in the rail. */
function Section({ label }: { label: string }) {
  return <Text style={local.section}>{label}</Text>;
}

/**
 * The left rail: the app's name; Control on top, the board of every mission where missions start and where
 * Control's own thread will be pinned; the workspaces with their missions still open; the missions with no
 * workspace; the other places; and the spending against the global budget.
 */
function Sidebar({
  client,
  onOpenMission,
  onPlace,
  onWorkspace,
  openMission,
  place,
  workspaceId,
}: {
  client: ServiceClient;
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
    <View style={local.sidebar}>
      <View style={local.brand}>
        <CanopyMark />
        <Text style={local.brandText}>Canopy</Text>
      </View>
      <NavItem
        glyph={placeGlyphs.Control}
        isSelected={isOnBoard && workspaceId === null}
        label="Control"
        onPress={() => onPlace("Control")}
      />
      <ScrollView contentContainerStyle={local.group} style={local.flex}>
        <Section label="Workspaces" />
        {workspaces.length === 0 && <Text style={local.empty}>No mission in a workspace yet.</Text>}
        {workspaces.map((workspace) => (
          <NavItem
            count={
              missions.filter((mission) => mission.workspaceId === workspace.id && mission.state !== "Done").length
            }
            glyph="▱"
            isSelected={isOnBoard && workspaceId === workspace.id}
            key={workspace.id}
            label={workspace.name}
            onPress={() => onWorkspace(workspace.id)}
          />
        ))}
        <Section label="Missions" />
        {loose.length === 0 && <Text style={local.empty}>None outside a workspace.</Text>}
        {loose.map((mission) => (
          <MissionItem
            isSelected={mission.id === openMission}
            key={mission.id}
            mission={mission}
            onPress={() => onOpenMission(mission.id)}
          />
        ))}
        <ArchivedItem
          client={client}
          isSelected={openMission === null && place === "Archived"}
          onPress={() => onPlace("Archived")}
        />
      </ScrollView>
      <View style={local.footer}>
        {(["Intel", "Settings"] as const).map((each) => (
          <NavItem
            glyph={placeGlyphs[each]}
            isSelected={openMission === null && place === each}
            key={each}
            label={each}
            onPress={() => onPlace(each)}
          />
        ))}
        <Spending client={client} />
      </View>
    </View>
  );
}

/**
 * The spending of the global budget's current period, as meters when it has limits and as a line otherwise. The
 * harnesses' own plan limits are not read yet (backlog), so the rail shows only what Canopy counts.
 */
function Spending({ client }: { client: ServiceClient }) {
  const { data: global } = useServiceQuery(client, { _tag: "ReadBudget", missionId: null }, "budget:global");
  if (global === null) return null;
  const hasLimits = global.limits.cost !== null || global.limits.tokens !== null;
  return (
    <View style={local.spending}>
      <Section label="Spending" />
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

/**
 * The window's frame: on a wide window the sidebar on its own tinted paper, ruled off from the content by an ink
 * line; on a narrow one the content alone.
 */
export function Shell(props: Parameters<typeof Sidebar>[0] & { children: ReactNode }) {
  const { width } = useWindowDimensions();
  if (width < sidebarBreakpoint) return <View style={local.narrow}>{props.children}</View>;
  return (
    <SidebarShown.Provider value={true}>
      <View style={local.frame}>
        <Sidebar {...props} />
        <View style={local.panel}>{props.children}</View>
      </View>
    </SidebarShown.Provider>
  );
}

const local = StyleSheet.create({
  // As wide as a mission's dot with its margins, so the label lines up with the missions' titles.
  archivedGlyph: { color: colors.textDim, fontSize: fontSizes.sm, textAlign: "center", width: 13 },
  archivedText: { color: colors.textMuted },
  attention: { backgroundColor: colors.warning, borderRadius: radii.pill, height: 7, width: 7 },
  brand: { alignItems: "center", flexDirection: "row", gap: 8, paddingBottom: 12, paddingHorizontal: 8, paddingTop: 4 },
  brandText: { color: colors.text, fontFamily: fonts.hand, fontSize: 28, lineHeight: 32 },
  count: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  dot: { borderRadius: radii.pill, height: 7, marginHorizontal: 3, width: 7 },
  empty: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.md, paddingHorizontal: 10 },
  flex: { flex: 1 },
  footer: { borderColor: colors.border, borderTopWidth: 1.5, paddingTop: 8 },
  frame: { backgroundColor: colors.frame, flex: 1, flexDirection: "row" },
  glyph: { color: colors.textMuted, fontSize: fontSizes.md, textAlign: "center", width: 16 },
  group: { gap: 2 },
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
  itemHovered: { backgroundColor: colors.controlHover },
  itemSelected: { ...ink, ...lift, backgroundColor: colors.canvas },
  itemText: { color: colors.textSecondary, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  missionText: { fontSize: fontSizes.md },
  narrow: { backgroundColor: colors.paper, flex: 1 },
  panel: {
    backgroundColor: colors.paper,
    borderColor: colors.borderStrong,
    borderLeftWidth: 1.5,
    flex: 1,
    overflow: "hidden",
  },
  section: {
    color: colors.textMuted,
    fontFamily: fonts.hand,
    fontSize: 20,
    paddingBottom: 2,
    paddingHorizontal: 8,
    paddingTop: 14,
  },
  sidebar: { gap: 2, padding: 12, width: 236 },
  spending: { paddingBottom: 4 },
  textSelected: { color: colors.text, fontWeight: "600" },
});
