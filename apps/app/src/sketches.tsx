import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { colors, fonts } from "./theme";

/** The logo: the owner's gold G, its dark background keyed out so it sits on paper. */
export function GildMark({ size = 30 }: { size?: number }) {
  return <Image source={require("../assets/gild-mark.png")} style={{ height: size, width: size }} />;
}

/**
 * A far-off castle on its hills, drawn in the board's dark tones, for the board's heading: mountains in two layers,
 * a keep with towers and pennants, and a fade into the wood on its left and bottom so it sits behind the title.
 */
export function GuildHero() {
  return (
    <View pointerEvents="none" style={local.hero}>
      <Svg height="100%" preserveAspectRatio="xMaxYMax slice" viewBox="0 0 600 140" width="100%">
        <Defs>
          <LinearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor="#c98a3a" stopOpacity={0.6} />
            <Stop offset="1" stopColor={colors.wood} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="fade" x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor={colors.wood} stopOpacity={1} />
            <Stop offset="0.45" stopColor={colors.wood} stopOpacity={0.15} />
            <Stop offset="1" stopColor={colors.wood} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="floor" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={colors.wood} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.wood} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#sky)" height={140} width={600} />
        <Path
          d="M0 120 L70 70 L120 100 L190 48 L260 105 L330 62 L410 108 L480 66 L560 100 L600 84 L600 140 L0 140z"
          fill="#7a6247"
        />
        <Path d="M0 132 L90 96 L170 122 L260 90 L350 124 L450 94 L540 122 L600 108 L600 140 L0 140z" fill="#4a3724" />
        <Path
          d="M418 112 V78 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 V112z M440 112 V56 h8 v-6 h8 v6 h8 V112z M466 112 V70 h6 v-6 h6 v6 h6 v-6 h6 v6 h4 V112z M436 56 V40 l10 6 l10 -6 V56z"
          fill="#241810"
        />
        <Path d="M446 40 V24 M446 24 l12 4 l-12 5" stroke="#9e2a22" strokeWidth={1.6} />
        <Path d="M478 64 V50 M478 50 l10 3 l-10 4" stroke="#9e2a22" strokeWidth={1.4} />
        <Rect fill="url(#fade)" height={140} width={600} />
        <Rect fill="url(#floor)" height={140} width={600} />
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
  empty: { alignItems: "center", gap: 6, paddingVertical: 28 },
  emptyText: { color: colors.onWood, fontFamily: fonts.hand, fontSize: 21 },
  hero: { height: 150, position: "absolute", right: 0, top: 0, width: "70%" },
});
