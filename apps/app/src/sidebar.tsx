import type { MissionId, MissionSummary, Crest as RealmCrest, Ritual, WorkspaceId } from "@gild/contracts";
import { type ComponentRef, createContext, useContext, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ReserveRows } from "./budgets";
import type { ServiceClient } from "./client";
import { CrestBadge } from "./crest";
import { Emblem, type EmblemName } from "./emblems";
import { tokenCountOf } from "./labels";
import { allMissions } from "./queries";
import { railQuestsOf } from "./railQuests";
import { expandedWidth, type Foldable, readFolded, rememberFolded } from "./railStorage";
import { useRituals } from "./rituals";
import { colors, cut, fontSizes, fonts, ink, lift, radii } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

/** The places the sidebar leads to; a mission is opened from its list instead, a realm's quests from its own list. */
export type Place = "Guildmaster" | "Realms" | "Quests" | "Rituals" | "Keep" | "Lore" | "Archived" | "Settings";

/** The rail's width as icons only; the collapse handle sits on its edge. */
export const collapsedWidth = 72;

/** How many quests the rail lists under Quests before "+ N more", which lists the rest in place. */
const railQuestLimit = 8;

/** Style properties only the web build understands (gradients, clipping); native keeps the plain colors beside them. */
const onWeb = (style: object): object => (Platform.OS === "web" ? style : {});

/** What the rail says about an icon the pointer rests on, and where: shown by the frame, outside the rail's scrolling. */
export type RailTip = { label: string; x: number; y: number };

/** Lets a rail row hand the frame a label to show beside it. */
export const RailTipSetter = createContext<(tip: RailTip | null) => void>(() => {});

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

/** The icon tint on a rail row: gold when the collapsed rail selects it, plain text when the open rail does. */
const railTintOf = (isSelected: boolean, isCollapsed: boolean): string => {
  if (!isSelected) return colors.onWood;
  return isCollapsed ? colors.goldHi : colors.text;
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
  realm?: { crest: RealmCrest | null; id: string };
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
        isSelected && isCollapsed && local.itemSelectedCollapsed,
      ]}
    >
      {isSelected && !isCollapsed && <Text style={local.pointer}>◆</Text>}
      {realm !== undefined ? (
        <CrestBadge crest={realm.crest} id={realm.id} size={isCollapsed ? 40 : 30} />
      ) : emblem !== undefined ? (
        <Emblem name={emblem} size={isCollapsed ? 28 : 18} tint={railTintOf(isSelected, isCollapsed)} />
      ) : (
        <Text style={[local.glyph, isSelected && local.textSelected]}>{glyph}</Text>
      )}
      {!isCollapsed && (
        <Text numberOfLines={1} style={[local.itemText, isSelected && local.textSelected]}>
          {label}
        </Text>
      )}
      {!isCollapsed && count !== undefined && count > 0 && (
        <Text style={[local.count, isSelected && local.countSelected]}>{count}</Text>
      )}
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
        isSelected && isCollapsed && local.itemSelectedCollapsed,
      ]}
    >
      {isSelected && !isCollapsed && <Text style={local.pointer}>◆</Text>}
      <CrestBadge
        crest={mission.workspaceCrest}
        id={mission.workspaceId ?? mission.id}
        isLoose={mission.workspaceId === null}
        size={isCollapsed ? 40 : 30}
        state={mission.state}
      />
      {!isCollapsed && (
        <Text numberOfLines={1} style={[local.itemText, local.missionText, isSelected && local.textSelected]}>
          {mission.title}
        </Text>
      )}
      {mission.prompt !== null && !isCollapsed && <View style={local.attention} />}
    </Pressable>
  );
}

/** A Ritual's row in the rail: its moon, its name, and a dot while a run is underway; dimmed while it is off. */
function RitualItem({
  isCollapsed,
  isSelected,
  onPress,
  ritual,
}: {
  isCollapsed: boolean;
  isSelected: boolean;
  onPress: () => void;
  ritual: Ritual;
}) {
  return (
    <Pressable
      accessibilityLabel={ritual.title}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        local.item,
        isCollapsed && local.itemCollapsed,
        (state.pressed || (state as { hovered?: boolean }).hovered === true) && local.itemHovered,
        isSelected && local.itemSelected,
        isSelected && isCollapsed && local.itemSelectedCollapsed,
        !ritual.isOn && local.ritualOff,
      ]}
    >
      {isSelected && !isCollapsed && <Text style={local.pointer}>◆</Text>}
      <Emblem name="moon" size={isCollapsed ? 28 : 20} tint={railTintOf(isSelected, isCollapsed)} />
      {!isCollapsed && (
        <Text numberOfLines={1} style={[local.itemText, local.missionText, isSelected && local.textSelected]}>
          {ritual.title}
        </Text>
      )}
      {ritual.lastRunState === "Underway" && !isCollapsed && <View style={local.attention} />}
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
        isSelected && isCollapsed && local.itemSelectedCollapsed,
      ]}
    >
      <Emblem name="tower" size={isCollapsed ? 28 : 18} tint={railTintOf(isSelected, isCollapsed)} />
      {!isCollapsed && (
        <Text numberOfLines={1} style={[local.itemText, local.archivedText, isSelected && local.textSelected]}>
          Archives
        </Text>
      )}
      {!isCollapsed && count > 0 && <Text style={[local.count, isSelected && local.countSelected]}>{count}</Text>}
    </Pressable>
  );
}

/** A section label in the rail: a drawn icon, a title, and a gilt rule beneath. */
function Section({ emblem, label }: { emblem?: EmblemName; label: string }) {
  return (
    <View style={local.sectionHeading}>
      {emblem !== undefined && <Emblem name={emblem} size={22} tint={colors.goldHi} />}
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
        local.unruled,
        (state.pressed || (state as { hovered?: boolean }).hovered === true) && local.itemHovered,
        isSelected && local.categorySelected,
      ]}
    >
      <Emblem name={emblem} size={22} tint={isSelected ? colors.text : colors.goldHi} />
      <Text style={[local.sectionTitle, isSelected && local.categoryTitleSelected]}>{label}</Text>
      {hasRule && <View style={local.headingRule} />}
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
 * The left rail: the app's name; Control on top, the board of every mission where missions start and where
 * Control's own thread will be pinned; the realms with their open quests and the quests with no realm, each with its
 * own emblem; the other places; and the spending against the global budget. Collapsed to icons, the rail gathers the
 * realms in one menu and leaves the quests to the Guildmaster's board.
 */
export function Sidebar({
  client,
  isCollapsed,
  width,
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
  /** The open rail's width, as dragged. */
  width: number;
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
  const rituals = useRituals(client) ?? [];
  // A setting hides the Guildmaster's entry; its screen is still where a realm page's message goes.
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  // The rail lists the latest quests of every realm, finished ones only when the Charter says so or while one is open;
  // "+ N more" unfolds the rest.
  const [areAllQuestsShown, setAreAllQuestsShown] = useState(false);
  const listed = railQuestsOf(missions, {
    openMission,
    shouldShowFinished: settings?.shouldShowFinishedQuests === true,
  });
  const railQuests = areAllQuestsShown ? listed : listed.slice(0, railQuestLimit);
  const workspaces = [...(data?.workspaces ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const realms = workspaces.map((workspace) => ({
    count: missions.filter((mission) => mission.workspaceId === workspace.id && mission.state !== "Done").length,
    crest: workspace.crest,
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
    <View style={[local.sidebar, isCollapsed ? local.sidebarCollapsed : { width }]}>
      <View pointerEvents="none" style={local.sidebarInner} />
      <ScrollView contentContainerStyle={local.group} style={local.flex}>
        {settings?.shouldShowGuildmaster !== false && (
          <Category
            emblem="crown"
            hasRule={false}
            isCollapsed={isCollapsed}
            isSelected={isHere("Guildmaster")}
            label="Guildmaster"
            onPress={() => onPlace("Guildmaster")}
          />
        )}
        {isCollapsed ? (
          <Category
            emblem="compass"
            isCollapsed
            isSelected={isHere("Realms") || (isHere("Quests") && workspaceId !== null)}
            label="Realms"
            onPress={() => onPlace("Realms")}
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
                  realm={realm}
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
        {!isCollapsed && !folded.has("Quests") && listed.length === 0 && (
          <Text style={local.empty}>{missions.length === 0 ? "No quests yet." : "No open quests."}</Text>
        )}
        {!isCollapsed &&
          !folded.has("Quests") &&
          railQuests.map((mission) => (
            <MissionItem
              isCollapsed={false}
              isSelected={mission.id === openMission}
              key={mission.id}
              mission={mission}
              onPress={() => onOpenMission(mission.id)}
            />
          ))}
        {!isCollapsed && !folded.has("Quests") && listed.length > railQuestLimit && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: areAllQuestsShown }}
            onPress={() => setAreAllQuestsShown(!areAllQuestsShown)}
          >
            <Text style={[local.empty, local.moreQuests]}>
              {areAllQuestsShown ? "Show fewer" : `+ ${listed.length - railQuestLimit} more`}
            </Text>
          </Pressable>
        )}
        <Category
          emblem="moon"
          isCollapsed={isCollapsed}
          isSelected={isHere("Rituals")}
          label="Rituals"
          onPress={() => onPlace("Rituals")}
          {...props("Rituals")}
        />
        {!isCollapsed && !folded.has("Rituals") && rituals.length === 0 && (
          <Text style={local.empty}>No Rituals yet.</Text>
        )}
        {!isCollapsed &&
          !folded.has("Rituals") &&
          rituals.map((ritual) => (
            <RitualItem
              isCollapsed={false}
              isSelected={ritual.missionId === openMission}
              key={ritual.id}
              onPress={() => onOpenMission(ritual.missionId)}
              ritual={ritual}
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
              isSelected={isHere("Lore")}
              label="Lore"
              onPress={() => onPlace("Lore")}
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
          emblem="gear"
          hasRule={false}
          isCollapsed={isCollapsed}
          isSelected={isHere("Settings")}
          label="Charter"
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

/** The chosen row: parchment cut to a point at its right end, as a signpost. */
const pointedRow = {
  backgroundColor: "#efdcae",
  borderColor: "transparent",
  paddingLeft: 18,
  ...onWeb({
    backgroundImage: "linear-gradient(#f5e8c8, #e7ca97)",
    clipPath: "polygon(0 0, 96% 0, 100% 50%, 96% 100%, 0 100%)",
  }),
};

const local = StyleSheet.create({
  archivedText: { color: colors.onWood },
  attention: { backgroundColor: colors.warning, borderRadius: radii.pill, height: 7, width: 7 },
  categoryHeading: { borderRadius: radii.sm, marginTop: 10 },
  categorySelected: { ...pointedRow, paddingLeft: 6 },
  categoryTitleSelected: { color: colors.text },
  count: { color: "#cbb793", fontFamily: fonts.sans, fontSize: 15 },
  countSelected: { color: "#382b19" },
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
  glyph: { color: colors.onWood, fontSize: fontSizes.md, textAlign: "center", width: 16 },
  group: { gap: 2 },
  headingRule: {
    backgroundColor: "#7a4e2b",
    flex: 1,
    height: 1,
    ...onWeb({ backgroundImage: "linear-gradient(90deg, #7a4e2b, transparent)" }),
  },
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
  itemCollapsed: { justifyContent: "center", paddingHorizontal: 0, paddingVertical: 10 },
  itemHovered: { backgroundColor: colors.wood },
  itemSelected: pointedRow,
  // Collapsed to an icon, the chosen row is a soft rounded square behind a gilt icon, nothing more.
  itemSelectedCollapsed: {
    backgroundColor: "rgba(226,184,90,0.18)",
    borderColor: "transparent",
    borderRadius: 12,
    paddingLeft: 0,
    ...onWeb({ backgroundImage: "none", clipPath: "none" }),
  },
  itemText: { color: colors.onWood, flex: 1, fontFamily: fonts.sans, fontSize: 17 },
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
  missionText: { fontSize: 17 },
  moreQuests: { color: colors.goldHi, fontStyle: "italic", paddingVertical: 4 },
  pointer: { color: "#805625", fontSize: 8, left: 5, marginTop: -6, position: "absolute", top: "50%" },
  ritualOff: { opacity: 0.55 },
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
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sidebar: {
    backgroundColor: colors.leather,
    borderColor: "#94652d",
    borderRightWidth: 5,
    gap: 2,
    padding: 12,
    paddingHorizontal: 14,
    width: expandedWidth,
    ...onWeb({
      backgroundImage: "radial-gradient(ellipse at 40% 45%, #5a3329 0%, #3b1f1a 55%, #25130f 100%)",
    }),
  },
  sidebarCollapsed: { paddingHorizontal: 6, width: collapsedWidth },
  sidebarInner: {
    borderColor: "#714c29",
    borderWidth: 1,
    bottom: 4,
    left: 4,
    position: "absolute",
    right: 3,
    top: 4,
  },
  spending: { paddingBottom: 4 },
  textSelected: { color: colors.text, fontWeight: "600" },
  unruled: { borderBottomColor: "transparent" },
});
