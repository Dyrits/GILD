import type { MissionId, MissionSummary } from "@openmission/contracts";
import { createContext, type ReactNode, useContext } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ServiceClient } from "./client";
import { allMissions } from "./queries";
import { colors, fontSizes, fonts, radii, stateTones } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

/** The places the sidebar leads to; a mission is opened from its list instead. */
export type Place = "Missions" | "Intel" | "Archived" | "Settings";

/** The app's logo, the same image as its icon. */
const logo = require("../assets/logo.png");

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
        <Image accessibilityLabel="OpenMission logo" source={logo} style={local.logo} />
        <Text style={local.brandText}>OpenMission</Text>
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
 * The window's frame: on a wide window the sidebar on a grey frame with the content on a raised white panel,
 * as OpenBot lays out its window; on a narrow one the content alone.
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
  brand: { alignItems: "center", flexDirection: "row", gap: 8, paddingBottom: 14, paddingHorizontal: 8, paddingTop: 6 },
  brandText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  dot: { borderRadius: radii.pill, height: 7, marginHorizontal: 3, width: 7 },
  empty: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.md, paddingHorizontal: 10 },
  flex: { flex: 1 },
  footer: { borderColor: colors.border, borderTopWidth: 1, paddingTop: 8 },
  frame: { backgroundColor: colors.frame, flex: 1, flexDirection: "row" },
  glyph: { color: colors.textMuted, fontSize: fontSizes.md, textAlign: "center", width: 16 },
  group: { gap: 1 },
  item: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  itemHovered: { backgroundColor: colors.controlHover },
  itemSelected: { backgroundColor: colors.controlActive },
  itemText: { color: colors.textSecondary, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  logo: { borderRadius: radii.md, height: 24, width: 24 },
  missionText: { fontSize: fontSizes.md },
  narrow: { backgroundColor: colors.canvas, flex: 1 },
  newMission: {
    backgroundColor: colors.control,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  newMissionText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
  panel: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    marginBottom: 8,
    marginRight: 8,
    marginTop: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  section: {
    color: colors.textDim,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    fontWeight: "600",
    paddingBottom: 4,
    paddingHorizontal: 8,
    paddingTop: 16,
  },
  sidebar: { gap: 2, padding: 10, width: 248 },
  textSelected: { color: colors.text, fontWeight: "600" },
});
