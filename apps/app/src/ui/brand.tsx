import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts } from "../foundation/theme";

/** The empty state of a place with nothing for the owner: one quiet line. */
export function EmptyBoard({ line }: { line: string }) {
  return (
    <View style={local.empty}>
      <Text style={local.emptyText}>{line}</Text>
    </View>
  );
}

const local = StyleSheet.create({
  empty: { alignItems: "center", paddingVertical: 28 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base },
});
