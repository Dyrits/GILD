import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, fonts } from "./theme";

/**
 * The drawings behind the Canopy look (art direction of 2026-11-08): a cockpit canopy drawn in ink, as a sketchbook
 * would, never as a spaceship. It appears in three places only: the logo, a panel's arched top, and the empty board.
 */

/** The logo: a canopy arch on its sill with one strut and a hinge. */
export function CanopyMark({ size = 30 }: { size?: number }) {
  return (
    <Svg
      fill="none"
      height={(size * 24) / 30}
      stroke={colors.text}
      strokeLinecap="round"
      strokeWidth={1.8}
      viewBox="0 0 30 24"
      width={size}
    >
      <Path d="M3 19 C 4 7, 26 5, 27 19" />
      <Path d="M1.5 19.5 L 28.5 19.2" />
      <Path d="M15 6.5 L 15.4 19" />
      <Circle cx={3} cy={19.3} fill={colors.text} r={1.4} />
    </Svg>
  );
}

/** A panel's arched top, as if the panel were a canopy opened over the page. */
export function CanopyArch() {
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

/** The empty state of a place with nothing for the owner: a closed canopy and a handwritten line. */
export function ClosedCanopy({ line }: { line: string }) {
  return (
    <View style={local.empty}>
      <Svg
        fill="none"
        height={64}
        stroke={colors.text}
        strokeLinecap="round"
        strokeWidth={1.8}
        viewBox="0 0 120 64"
        width={120}
      >
        <Path d="M8 50 C 12 18, 108 14, 112 50" />
        <Path d="M4 51 L 116 50.5" />
        <Path d="M60 16 L 60.5 50" />
        <Path d="M26 34 q 6 -6 12 0" stroke={colors.textMuted} />
        <Path d="M82 30 q 6 -5 12 1" stroke={colors.textMuted} />
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
