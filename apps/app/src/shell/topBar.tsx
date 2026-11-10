import type { MissionId, MissionSummary, Ritual, WorkspaceId } from "@gild/contracts";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { tokenCountOf } from "../foundation/labels";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import type { Place } from "./sidebar";

// The window's top bar: the breadcrumbs to where the owner is, the spending, the quest panel's icon, and the column that
// holds the quest panel.

/** Whether the desktop window has no system title bar, so the top bar takes its place. */
export const hasOwnTitleBar = typeof window !== "undefined" && window.gild?.hasOwnTitleBar === true;

// Electron drags the window by a region marked this way; react-native-web passes the property to the page.
/** Marks a region that drags the window. */
export const dragRegion = { WebkitAppRegion: "drag" } as object;
/** Marks a region inside a drag region that is pressed instead. */
export const noDragRegion = { WebkitAppRegion: "no-drag" } as object;

/**
 * The quest's side panel as the top bar offers it: whether it shows, and how to show or hide it. `isPinned` keeps the
 * panel open with no way to hide it, as on the quest board, where it always has something to show.
 */
export type DetailsToggle = { isOpen: boolean; isPinned?: boolean; onToggle: () => void };

/** The icon of a window with its left panel: the rail's collapse and expand button. */
export function PanelIcon({ side = "left" }: { side?: "left" | "right" }) {
  return (
    <View style={[local.panelIcon, side === "right" && local.panelIconRight]}>
      <View style={side === "left" ? local.panelIconLeft : local.panelIconEnd} />
    </View>
  );
}

/** One step of the path to where the owner is; the last is the current screen and leads nowhere. */
export type Crumb = {
  /** An icon before the label, the one the rail shows for the same place. */
  glyph?: string;
  label: string;
  onPress: (() => void) | null;
};

/**
 * The top bar: the path to where the owner is (the guild board, the realm, the open quest), each step before the last
 * leading back to it, and at the end the spending, which the collapsed rail no longer shows.
 */
export function TopBar({
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
            // biome-ignore lint/suspicious/noArrayIndexKey: a trail is positional and labels can repeat (a realm named "Realms").
            <View key={index} style={[local.crumb, isLast && local.crumbLast]}>
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
      {details !== null && details.isPinned !== true && (
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
export const crumbsOf = ({
  isLoaded,
  missions,
  onPlace,
  onWorkspace,
  openMission,
  place,
  realm,
  rituals,
  workspaces,
}: {
  /** Whether the quests have been read, so a quest missing from them is known to be archived. */
  isLoaded: boolean;
  /** The quests that are not archived. */
  missions: readonly MissionSummary[];
  onPlace: (place: Place) => void;
  onWorkspace: (id: WorkspaceId) => void;
  openMission: MissionId | null;
  place: Place | null;
  realm: { id: WorkspaceId; name: string } | null;
  /** The Rituals, whose quests are not among `missions`. */
  rituals: readonly Ritual[];
  workspaces: readonly { id: WorkspaceId; name: string }[];
}): Crumb[] => {
  const to = (label: string, target: Place): Crumb => ({ label, onPress: () => onPlace(target) });
  const here = (label: string, glyph?: string): Crumb =>
    glyph === undefined ? { label, onPress: null } : { glyph, label, onPress: null };
  if (openMission !== null) {
    const ritual = rituals.find((each) => each.missionId === openMission);
    if (ritual !== undefined) return [to("Rituals", "Rituals"), here(ritual.title)];
    const mission = missions.find((each) => each.id === openMission);
    if (mission === undefined && isLoaded) return [to("The Keep", "Keep"), to("Archives", "Archived"), here("Quest")];
    const own = workspaces.find((each) => each.id === mission?.workspaceId);
    const current = here(mission?.title ?? "Quest");
    if (own === undefined) return [to("Quests", "Quests"), current];
    return [to("Realms", "Realms"), { label: own.name, onPress: () => onWorkspace(own.id) }, current];
  }
  if (place === "Lore") return [to("The Keep", "Keep"), here("Lore")];
  if (place === "Archived") return [to("The Keep", "Keep"), here("Archives", "▤")];
  if (place === "Keep") return [here("The Keep")];
  if (place === "Settings") return [here("Charter")];
  if (place === "Realms") return [here("Realms")];
  if (place === "Rituals") return [here("Rituals")];
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
export function QuestColumn({
  children,
  isWide,
  onClose,
  title,
}: {
  children: ReactNode;
  isWide: boolean;
  /** Hides the panel; none when the panel is pinned open. */
  onClose: (() => void) | null;
  /** The panel's name in its top bar: Quest, or what another screen gave it. */
  title: string;
}) {
  return (
    <View style={isWide ? local.questColumn : local.questColumnNarrow}>
      <View style={local.topBar}>
        {onClose !== null && (
          <Pressable
            accessibilityLabel="Hide quest panel"
            accessibilityRole="button"
            onPress={onClose}
            style={noDragRegion}
          >
            <Text style={local.questClose}>✕</Text>
          </Pressable>
        )}
        <Text style={[local.crumbText, local.crumbCurrent, onClose === null && local.crumbPinned]}>{title}</Text>
      </View>
      <View style={local.questBody}>{children}</View>
    </View>
  );
}

const local = StyleSheet.create({
  crumb: { alignItems: "center", flexDirection: "row", flexShrink: 0, gap: 8 },
  crumbCurrent: { color: colors.onWood },
  crumbGlyph: { color: colors.onWood, fontSize: fontSizes.md },
  crumbLast: { flexShrink: 1 },
  crumbLink: { color: colors.goldHi },
  crumbPinned: { paddingLeft: 6 },
  crumbPressed: { opacity: 0.7 },
  crumbSeparator: { color: colors.gold, fontFamily: fonts.sans, fontSize: fontSizes.lg },
  crumbs: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, overflow: "hidden" },
  crumbText: { fontFamily: fonts.hand, fontSize: fontSizes.lg },
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
});
