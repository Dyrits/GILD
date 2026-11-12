import { type ReactNode, useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { HostMenuContext } from "../foundation/hostContext";
import { usedTextOf } from "../foundation/labels";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { HostMenu } from "./hostMenu";

// The window's top bar: the host menu, the spending, the quest panel's icon, and the column that
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

/**
 * The top bar: the host menu at its start and, at the end, the spending, which the collapsed rail no longer shows,
 * and Iskios's button. It names no place: the rail and the screens say where the owner is.
 */
export function TopBar({
  client,
  details,
  iskios,
}: {
  client: ServiceClient;
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
      <View style={local.spacer} />
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
  tabs,
  title,
  width,
}: {
  children: ReactNode;
  /** The strip on the column's left edge that resizes it; wide windows only. */
  edge?: ReactNode;
  isWide: boolean;
  /** Hides the panel; none when the panel is pinned open. */
  onClose: (() => void) | null;
  /** Tabs drawn above the content on a wide window, such as Quest and Companion. */
  tabs?: ReactNode;
  /** The panel's name in its top bar: Quest, or what another screen gave it. */
  title: string;
  /** The column's width on a wide window. */
  width: number;
}) {
  if (isWide)
    return (
      <View style={[local.questColumn, { width }]}>
        {edge}
        <View style={local.questBody}>
          {tabs}
          {children}
        </View>
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
  crumbCurrent: { color: colors.onGround },
  crumbPinned: { paddingLeft: 6 },
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
  spacer: { flex: 1 },
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
