import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { colors, fonts } from "./theme";

/** The cloth of each kind of banner: its light and dark red, blue, violet, or green, and whether a tassel hangs from it. */
const cloths = {
  blue: { dark: "#192f66", light: "#3159a6", tassel: true },
  green: { dark: "#173d29", light: "#2f6a45", tassel: false },
  red: { dark: "#591511", light: "#963029", tassel: true },
  violet: { dark: "#3c2a63", light: "#6b4b9e", tassel: true },
} as const;

export type BannerCloth = keyof typeof cloths;

const height = 134;
const rodY = 10;
const clothTop = 15;
const sideEnd = 94;
const pointEnd = 126;
const inset = 24;

/** A gilt diamond, as on a rod's middle and a banner's point. */
const diamond = (x: number, y: number, r: number) =>
  `M${x} ${y - r} L${x + r * 0.7} ${y} L${x} ${y + r} L${x - r * 0.7} ${y}z`;

/**
 * A hanging banner drawn to its width: a gilt rod with a finial at each end and a diamond in the middle, a cloth
 * shaded from light to dark with a double gilt trim and a pointed lower edge, a tassel on its left when its kind has
 * one, and the title and its meaning over the cloth.
 */
export function Banner({
  cloth,
  count,
  caption,
  title,
}: {
  cloth: BannerCloth;
  count: number;
  caption: string;
  title: string;
}) {
  const [width, setWidth] = useState(0);
  const { dark, light, tassel } = cloths[cloth];
  const left = inset;
  const right = width - inset;
  const mid = width / 2;
  const edge = (offset: number) =>
    `M${left + offset} ${clothTop + offset} H${right - offset} V${sideEnd - offset / 2} L${mid} ${pointEnd - offset * 1.6} L${left + offset} ${sideEnd - offset / 2}z`;
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={local.frame}>
      {width > 0 && (
        <Svg height={height} style={local.art} width={width}>
          <Defs>
            <LinearGradient id={`cloth-${cloth}`} x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={light} />
              <Stop offset="1" stopColor={dark} />
            </LinearGradient>
            <LinearGradient id="rod" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={colors.goldHi} />
              <Stop offset="1" stopColor="#8a6320" />
            </LinearGradient>
          </Defs>
          {tassel && (
            <>
              <Path d={`M${left - 12} ${rodY + 4} V84`} stroke={colors.gold} strokeWidth={2} />
              <Ellipse cx={left - 12} cy={90} fill={colors.goldHi} rx={4} ry={5} />
              <Path
                d={`M${left - 16} 95 L${left - 18} 119 M${left - 14} 95 L${left - 15} 121 M${left - 12} 95 V122 M${left - 10} 95 L${left - 9} 121 M${left - 8} 95 L${left - 6} 119`}
                stroke={colors.gold}
                strokeWidth={1.6}
              />
            </>
          )}
          <Path d={edge(0)} fill={`url(#cloth-${cloth})`} />
          <Path
            d={Array.from(
              { length: Math.max(0, Math.floor((right - left - 16) / 7)) },
              (_, i) => `M${left + 10 + i * 7} ${clothTop + 8} V${sideEnd - 8}`,
            ).join(" ")}
            stroke="#000"
            strokeOpacity={0.08}
            strokeWidth={2}
          />
          <Path d={edge(0)} fill="none" stroke={colors.gold} strokeLinejoin="round" strokeWidth={2.2} />
          <Path
            d={edge(6)}
            fill="none"
            stroke={colors.goldHi}
            strokeLinejoin="round"
            strokeOpacity={0.75}
            strokeWidth={1}
          />
          <Path d={diamond(mid, pointEnd - 12, 6)} fill={colors.goldHi} stroke="#8a6320" strokeWidth={0.8} />
          <Rect fill="url(#rod)" height={5} rx={2.5} width={width - 10} x={5} y={rodY - 2} />
          <Circle cx={7} cy={rodY + 0.5} fill={colors.goldHi} r={6} stroke="#8a6320" strokeWidth={1} />
          <Circle cx={width - 7} cy={rodY + 0.5} fill={colors.goldHi} r={6} stroke="#8a6320" strokeWidth={1} />
          <Path d={diamond(mid, rodY + 0.5, 9)} fill={colors.goldHi} stroke="#8a6320" strokeWidth={1} />
        </Svg>
      )}
      <View pointerEvents="none" style={local.text}>
        <Text style={local.title}>
          {title} <Text style={local.count}>{count}</Text>
        </Text>
        <View style={local.rule} />
        <Text style={local.caption}>{caption}</Text>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  art: { left: 0, position: "absolute", top: 0 },
  caption: { color: colors.onWood, fontFamily: fonts.sans, fontSize: 14, fontStyle: "italic" },
  count: { fontSize: 15 },
  frame: { height, marginBottom: 12 },
  rule: { backgroundColor: colors.goldHi, height: 1, marginVertical: 3, opacity: 0.6, width: "46%" },
  text: { alignItems: "center", left: 0, position: "absolute", right: 0, top: 38 },
  title: {
    color: "#f5e8c8",
    fontFamily: fonts.hand,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1.4,
    lineHeight: 24,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 2,
    textTransform: "uppercase",
  },
});
