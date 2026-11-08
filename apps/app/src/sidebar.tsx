import type { MissionId, MissionSummary } from "@canopy/contracts";
import { createContext, type ReactNode, useContext } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ServiceClient } from "./client";
import { allMissions } from "./queries";
import { CanopyMark } from "./sketches";
import { colors, cut, fontSizes, fonts, ink, lift, radii, stateTones } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

/** The places the sidebar leads to; a mission is opened from its list instead. */
export type Place = "Missions" | "Intel" | "Archived" | "Settings";

const SidebarShown = createContext(false);

/** Whether the sidebar shows, so a screen can leave out the links it already offers. */
export const useHasSidebar = () => useContext(SidebarShown);

/** The window width from which the sidebar shows beside the content; narrower windows keep the screens' own links. */
const sidebarBreakpoint = 820;

const placeGlyphs = { Archived: "▤", Intel: "◆", Missions: "◎", Settings: "⚙" } as const satisfies Record<
  Place,
  string
>;

function NavItem({
  isSelected,
  label,
  glyph,
  onPress,
}: {
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

/** The left rail: the app's name, its places, and the missions not archived, most recent first. */
function Sidebar({
  client,
  onNewMission,
  onOpenMission,
  onPlace,
  openMission,
  place,
}: {
  client: ServiceClient;
  onNewMission: () => void;
  onOpenMission: (id: MissionId) => void;
  onPlace: (place: Place) => void;
  openMission: MissionId | null;
  place: Place | null;
}) {
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const missions = [...(data?.missions ?? [])].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  return (
    <View style={local.sidebar}>
      <View style={local.brand}>
        <CanopyMark />
        <Text style={local.brandText}>Canopy</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onNewMission}
        style={({ pressed }) => [local.newMission, pressed && local.itemHovered]}
      >
        <Text style={local.newMissionText}>＋ New mission</Text>
      </Pressable>
      <View style={local.group}>
        {(["Missions", "Intel", "Archived"] as const).map((each) => (
          <NavItem
            glyph={placeGlyphs[each]}
            isSelected={openMission === null && place === each}
            key={each}
            label={each}
            onPress={() => onPlace(each)}
          />
        ))}
      </View>
      <Text style={local.section}>Missions</Text>
      <ScrollView contentContainerStyle={local.group} style={local.flex}>
        {missions.length === 0 && <Text style={local.empty}>No missions yet.</Text>}
        {missions.map((mission) => (
          <MissionItem
            isSelected={mission.id === openMission}
            key={mission.id}
            mission={mission}
            onPress={() => onOpenMission(mission.id)}
          />
        ))}
      </ScrollView>
      <View style={local.footer}>
        <NavItem
          glyph={placeGlyphs.Settings}
          isSelected={openMission === null && place === "Settings"}
          label="Settings"
          onPress={() => onPlace("Settings")}
        />
      </View>
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
  attention: { backgroundColor: colors.warning, borderRadius: radii.pill, height: 7, width: 7 },
  brand: { alignItems: "center", flexDirection: "row", gap: 8, paddingBottom: 12, paddingHorizontal: 8, paddingTop: 4 },
  brandText: { color: colors.text, fontFamily: fonts.hand, fontSize: 28, lineHeight: 32 },
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
  newMission: {
    ...ink,
    ...cut,
    ...lift,
    backgroundColor: colors.text,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  newMissionText: { color: colors.onAccent, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
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
  textSelected: { color: colors.text, fontWeight: "600" },
});
