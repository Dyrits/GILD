import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";

// Where Iskios's conversation lives (quest coordination, Iskios everywhere): a pill at the window's corner opens it, as a
// card floating over the Guild Hall's hub or in a column beside any other screen, and the owner folds it back.

/** How wide the column beside a screen is as it opens, and the least the owner can drag it to. */
export const iskiosColumnWidth = 380;

/** The floating card's size, held within the window. */
const floatingWidth = 420;
const floatingHeight = 620;
const edge = 20;

/** The pill that opens Iskios, at the content's lower right corner while the panel is folded. */
export function IskiosLauncher({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Ask Iskios"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.pill, pressed && local.pillPressed]}
    >
      <Text style={local.pillMark}>✦</Text>
      <Text style={local.pillText}>Ask Iskios</Text>
    </Pressable>
  );
}

/** Iskios as a card floating at the lower right over the screen, which stays whole beneath it. */
export function IskiosFloating({ children }: { children: ReactNode }) {
  const { height, width } = useWindowDimensions();
  return (
    <View
      accessibilityLabel="Iskios"
      style={[
        local.card,
        { height: Math.min(floatingHeight, height - 120), width: Math.min(floatingWidth, width - edge * 2) },
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Iskios as a column at the window's far right, beyond the quest panel and below the top bar, which spans the window:
 * `edge` is the strip on its left edge that the owner drags to widen it.
 */
export function IskiosColumn({ children, edge, width }: { children: ReactNode; edge: ReactNode; width: number }) {
  return (
    <View accessibilityLabel="Iskios" style={[local.column, { width }]}>
      {edge}
      {children}
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    backgroundColor: colors.page,
    borderColor: colors.borderStrong,
    borderRadius: radii.xl + 4,
    borderWidth: 1.5,
    bottom: edge,
    overflow: "hidden",
    position: "absolute",
    right: edge,
    shadowColor: colors.text,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    zIndex: 6,
  },
  column: {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderLeftWidth: 1,
  },
  pill: {
    alignItems: "center",
    backgroundColor: colors.text,
    borderRadius: radii.pill,
    bottom: edge,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    position: "absolute",
    right: edge,
    shadowColor: colors.text,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    zIndex: 5,
  },
  pillMark: { color: colors.marker, fontSize: fontSizes.lg },
  pillPressed: { opacity: 0.85 },
  pillText: { color: colors.page, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "700" },
});
