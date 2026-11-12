import type { MissionId, MissionSummary, Ritual, WorkspaceId } from "@iskios/contracts";
import { type ReactNode, useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { HostMenuContext } from "../foundation/hostContext";
import { usedTextOf } from "../foundation/labels";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { HostMenu } from "./hostMenu";
import type { Place } from "./sidebar";

// The window's top bar: the breadcrumbs to where the owner is, the spending, the quest panel's icon, and the column that
// holds the quest panel.

/** Whether the desktop window has no system title bar, so the top bar takes its place. */
export const hasOwnTitleBar = typeof window !== "undefined" && window.iskios?.hasOwnTitleBar === true;

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

/** The width of the quest panel's column on a wide window. */
export const questColumnWidth = 360;

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
  iskios,
}: {
  client: ServiceClient;
  crumbs: readonly Crumb[];
  /** The icon that shows or hides the quest's side panel; none outside a quest. */
  details: DetailsToggle | null;
  /** The button that opens or folds Iskios's panel (quest coordination, Iskios everywhere). */
  iskios: { isOpen: boolean; onToggle: () => void };
}) {
  const hostMenu = useContext(HostMenuContext);
  return (
    // As the macOS title bar the bar drags the window, and leaves room for the traffic lights at its start.
    <View style={[local.topBar, hasOwnTitleBar && local.topBarTitle, hasOwnTitleBar && dragRegion]}>
      {hostMenu !== null && (
        <View style={noDragRegion}>
          <HostMenu {...hostMenu} />
        </View>
      )}
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
      <Pressable
        accessibilityLabel={iskios.isOpen ? "Fold Iskios" : "Ask Iskios"}
        accessibilityRole="button"
        accessibilityState={{ expanded: iskios.isOpen }}
        onPress={iskios.onToggle}
        style={({ pressed }) => [local.iskiosButton, (pressed || iskios.isOpen) && local.topIconActive, noDragRegion]}
      >
        <Text style={local.iskiosMark}>✦</Text>
        <Text style={local.iskiosText}>Iskios</Text>
      </Pressable>
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
 * The path to where the owner is, for the top bar, following the rail: a place on its own; a realm; a quest
 * under its realm, or alone when it has none; Library, Lore, and Archive on their own. Each step before the last leads
 * back to its place.
 */
export const crumbsOf = ({
  isLoaded,
  listedRealmName,
  missions,
  onPlace,
  openMission,
  place,
  rituals,
  workspaces,
}: {
  /** Whether the quests have been read, so a quest missing from them is known to be archived. */
  isLoaded: boolean;
  /** The realm or Borderland whose quest list is open, if any. */
  listedRealmName: string | null;
  /** The quests that are not archived. */
  missions: readonly MissionSummary[];
  onPlace: (place: Place) => void;
  openMission: MissionId | null;
  place: Place | null;
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
    if (mission === undefined && isLoaded) return [to("Archive", "Archived"), here("Quest")];
    const own = workspaces.find((each) => each.id === mission?.workspaceId);
    const current = here(mission?.title ?? "Quest");
    if (own === undefined) return [current];
    return [here(own.name), current];
  }
  if (place === "Library") return [here("Library")];
  if (place === "Lore") return [here("Lore")];
  if (place === "Archived") return [here("Archive")];
  if (place === "Charter") return [here("Charter")];
  if (place === "Craft") return [here("Craft")];
  if (place === "Realms") return [here("Realms")];
  if (place === "Borderlands") return [here("Borderlands")];
  if (place === "RealmQuests") return [here(listedRealmName ?? "Realm")];
  if (place === "Reserves") return [here("Reserves")];
  if (place === "Settings") return [here("Workshop")];
  if (place === "Rituals") return [here("Rituals")];
  return [here("Guild Hall")];
};

/** The spending of the global budget's period as one line; nothing while it is unread. */
function SpendingLine({ client }: { client: ServiceClient }) {
  const { data: global } = useServiceQuery(client, { _tag: "ReadBudget", missionId: null }, "budget:global");
  if (global === null) return null;
  return <Text style={local.topSpending}>{usedTextOf(global.consumption)}</Text>;
}

/**
 * The quest panel's column. On a wide window it stands below the top bar, which spans the window, with no header of its
 * own (the top bar's icon hides it) and an `edge` strip the owner drags to widen it; on a narrow one it takes the
 * content's place, under a header with the close button.
 */
export function QuestColumn({
  children,
  edge,
  isWide,
  onClose,
  title,
  width,
}: {
  children: ReactNode;
  /** The strip on the column's left edge that resizes it; wide windows only. */
  edge?: ReactNode;
  isWide: boolean;
  /** Hides the panel; none when the panel is pinned open. */
  onClose: (() => void) | null;
  /** The panel's name in its top bar: Quest, or what another screen gave it. */
  title: string;
  /** The column's width on a wide window. */
  width: number;
}) {
  if (isWide)
    return (
      <View style={[local.questColumn, { width }]}>
        {edge}
        <View style={local.questBody}>{children}</View>
      </View>
    );
  return (
    <View style={local.questColumnNarrow}>
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
  crumbCurrent: { color: colors.onGround },
  crumbGlyph: { color: colors.onGround, fontSize: fontSizes.md },
  crumbLast: { flexShrink: 1 },
  crumbLink: { color: colors.highlight },
  crumbPinned: { paddingLeft: 6 },
  crumbPressed: { opacity: 0.7 },
  crumbSeparator: { color: colors.edge, fontFamily: fonts.sans, fontSize: fontSizes.lg },
  crumbs: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, overflow: "hidden" },
  crumbText: { fontFamily: fonts.sans, fontSize: fontSizes.lg },
  iskiosButton: {
    alignItems: "center",
    borderRadius: radii.sm,
    flexDirection: "row",
    gap: 6,
    height: 28,
    paddingHorizontal: 9,
  },
  iskiosMark: { color: colors.accentText, fontSize: fontSizes.md },
  iskiosText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  panelIcon: {
    borderColor: colors.onGround,
    borderRadius: 3,
    borderWidth: 1.5,
    flexDirection: "row",
    height: 13,
    overflow: "hidden",
    width: 16,
  },
  panelIconEnd: { borderColor: colors.onGround, borderLeftWidth: 1.5, marginLeft: "auto", width: 5 },
  panelIconLeft: { borderColor: colors.onGround, borderRightWidth: 1.5, width: 5 },
  panelIconRight: { justifyContent: "flex-end" },
  questBody: { backgroundColor: colors.page, flex: 1 },
  questClose: { color: colors.highlight, fontSize: fontSizes.base, paddingHorizontal: 4 },
  questColumn: { borderColor: colors.edge, borderLeftWidth: 1 },
  questColumnNarrow: { flex: 1 },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderBottomColor: colors.edge,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 40,
    paddingHorizontal: 10,
  },
  topBarTitle: { paddingLeft: 82 },
  topIcon: { alignItems: "center", borderRadius: radii.sm, height: 28, justifyContent: "center", width: 28 },
  topIconActive: { backgroundColor: colors.ground },
  topSpending: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.sm },
});
