import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors, fonts } from "./theme";

/** The logo: the owner's gold G, its dark background keyed out so it sits on paper. */
export function GildMark({ size = 30 }: { size?: number }) {
  return <Image source={require("../assets/gild-mark.png")} style={{ height: size, width: size }} />;
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
});
