import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { colors, fontSizes, fonts } from "./theme";

const goldDark = "#8a6320";

/** A gilt diamond, as on the frame's corners and the banner rods. */
const diamond = (x: number, y: number, r: number) =>
  `M${x} ${y - r} L${x + r * 0.7} ${y} L${x} ${y + r} L${x - r * 0.7} ${y}z`;

/** The bookmark cloths: the dyes of the column banners. */
export const bookmarkCloths = {
  blue: { dark: "#192f66", light: "#3159a6" },
  green: { dark: "#173d29", light: "#2f6a45" },
  red: { dark: "#6f1a18", light: "#a3302b" },
  violet: { dark: "#3c2a63", light: "#6b4b9e" },
} as const;

/**
 * The gilt frame of a parchment panel, drawn over it and never catching a press: a darkening toward the edges as on
 * old paper, a double gold line with a diamond at each corner, and a red bookmark hanging from the top edge with a
 * gilt star. It fills its parent, which must be positioned, and draws once the parent has a size.
 */
export function ParchmentFrame({
  bookmark = "red",
  hasBookmark = true,
}: {
  /** The bookmark's cloth, matching the banner of the quest's column. */
  bookmark?: keyof typeof bookmarkCloths;
  hasBookmark?: boolean;
}) {
  const [size, setSize] = useState({ height: 0, width: 0 });
  const { height, width } = size;
  const outer = 8;
  const inner = 13;
  return (
    <View onLayout={(event) => setSize(event.nativeEvent.layout)} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {width > 0 && (
        <Svg height={height} style={StyleSheet.absoluteFill} width={width}>
          <Defs>
            <RadialGradient cx="50%" cy="45%" id="paper-age" r="75%">
              <Stop offset="0.55" stopColor="#8a5a1e" stopOpacity={0} />
              <Stop offset="1" stopColor="#8a5a1e" stopOpacity={0.22} />
            </RadialGradient>
            <LinearGradient id="bookmark" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={bookmarkCloths[bookmark].light} />
              <Stop offset="1" stopColor={bookmarkCloths[bookmark].dark} />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#paper-age)" height={height} width={width} />
          <Rect
            fill="none"
            height={height - outer * 2}
            rx={3}
            stroke={colors.gold}
            strokeWidth={2.2}
            width={width - outer * 2}
            x={outer}
            y={outer}
          />
          <Rect
            fill="none"
            height={height - inner * 2}
            rx={2}
            stroke={colors.gold}
            strokeOpacity={0.65}
            strokeWidth={0.9}
            width={width - inner * 2}
            x={inner}
            y={inner}
          />
          {[
            [outer, outer],
            [width - outer, outer],
            [outer, height - outer],
            [width - outer, height - outer],
          ].map(([x, y]) => (
            <Path
              d={diamond(x ?? 0, y ?? 0, 6)}
              fill={colors.goldHi}
              key={`${x}:${y}`}
              stroke={goldDark}
              strokeWidth={1}
            />
          ))}
          {hasBookmark && (
            <>
              <Path
                d={`M${width - 58} ${outer} H${width - 24} V${outer + 66} L${width - 41} ${outer + 54} L${width - 58} ${outer + 66}z`}
                fill="url(#bookmark)"
                stroke={colors.gold}
                strokeWidth={1.6}
              />
              <Path
                d={`M${width - 41} ${outer + 14} l3 7 l7 1 l-5.4 4.6 l1.8 7 l-6.4 -4 l-6.4 4 l1.8 -7 l-5.4 -4.6 l7 -1z`}
                fill={colors.goldHi}
              />
            </>
          )}
        </Svg>
      )}
    </View>
  );
}

/** A button in gilt, raised on a darker lower edge; the plain kind is an outline on parchment. */
export function GoldButton({
  isDisabled = false,
  isPrimary = true,
  label,
  onPress,
}: {
  isDisabled?: boolean;
  isPrimary?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        local.button,
        isPrimary ? local.primary : local.plain,
        pressed && local.pressed,
        isDisabled && local.disabled,
      ]}
    >
      <Text style={[local.buttonText, isPrimary && local.primaryText]}>{label}</Text>
    </Pressable>
  );
}

const local = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 16,
    paddingVertical: 6,
    // Web only: the press answers the hand.
    ...(Platform.OS === "web" ? ({ cursor: "pointer", userSelect: "none" } as object) : {}),
  },
  buttonText: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: fontSizes.md,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  disabled: { opacity: 0.5 },
  plain: { backgroundColor: "rgba(255,248,229,0.65)", borderColor: colors.gold },
  pressed: { transform: [{ translateY: 1 }] },
  primary: { backgroundColor: "#e6bd62", borderBottomColor: goldDark, borderBottomWidth: 3, borderColor: goldDark },
  primaryText: { color: "#3a230f" },
});
