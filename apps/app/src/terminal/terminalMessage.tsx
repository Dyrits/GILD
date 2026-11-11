import { ScrollView, Text, View } from "react-native";
import { colors, fonts } from "../foundation/theme";

/** A frozen terminal block in the owner's message, backed by the same text the Companion receives. */
export function TerminalMessage({ cwd, output }: { cwd: string; output: string }) {
  return (
    <View
      accessibilityLabel="Terminal snapshot"
      style={{
        backgroundColor: colors.terminal,
        borderColor: colors.border,
        borderRadius: 4,
        borderWidth: 1,
        gap: 6,
        padding: 10,
      }}
    >
      <Text numberOfLines={1} style={{ color: colors.textMuted, fontFamily: fonts.mono, fontSize: 12 }}>
        Terminal · {cwd}
      </Text>
      <ScrollView style={{ maxHeight: 280 }}>
        <Text selectable style={{ color: colors.text, fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 }}>
          {output}
        </Text>
      </ScrollView>
    </View>
  );
}
