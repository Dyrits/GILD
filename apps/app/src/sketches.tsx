import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors, fonts } from "./theme";

/**
 * The drawings behind the Gild look (art direction of 2026-11-08): an arch drawn in ink, as a sketchbook would,
 * and a gilt frame for a place with nothing in it. The brand mark itself is the owner's logo, for now.
 */

/** The logo: the owner's gold G, its dark background keyed out so it sits on paper. */
export function GildMark({ size = 30 }: { size?: number }) {
  return <Image source={require("../assets/gild-mark.png")} style={{ height: size, width: size }} />;
}

/** A panel's arched top, as if the panel were a sheet hung under a sketchbook arch. */
export function PanelArch() {
  return (
    <View style={local.arch}>
      <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 360 34" width="100%">
        <Path
          d="M0 34 C 40 4, 320 4, 360 34"
          fill={colors.canvas}
          stroke={colors.borderStrong}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <Path d="M180 11.5 L 180 34" stroke={colors.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </Svg>
    </View>
  );
}

/** The empty state of a place with nothing for the owner: an empty gilt frame and a handwritten line. */
export function EmptyBoard({ line }: { line: string }) {
  return (
    <View style={local.empty}>
      <Svg fill="none" height={64} strokeLinecap="round" viewBox="0 0 120 64" width={120}>
        <Rect height={44} rx={2} stroke={colors.text} strokeWidth={1.8} width={100} x={10} y={8} />
        <Rect height={34} rx={1} stroke={colors.warning} strokeWidth={1.4} width={88} x={16} y={13} />
        <Path d="M34 30 q 6 -6 12 0" stroke={colors.textMuted} />
        <Path d="M74 27 q 6 -5 12 1" stroke={colors.textMuted} />
      </Svg>
      <Text style={local.emptyText}>{line}</Text>
    </View>
  );
}

const local = StyleSheet.create({
  arch: { height: 34, width: "100%" },
  empty: { alignItems: "center", gap: 6, paddingVertical: 28 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.hand, fontSize: 21 },
});
