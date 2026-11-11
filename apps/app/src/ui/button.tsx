import { Platform, Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";

/** A button: the accent fill for the main action, an outline for the others. */
export function Button({
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
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 14,
    paddingVertical: 6,
    // Web only: the press answers the hand.
    ...(Platform.OS === "web" ? ({ cursor: "pointer", userSelect: "none" } as object) : {}),
  },
  buttonText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  plain: { backgroundColor: "transparent", borderColor: colors.edge },
  pressed: { opacity: 0.8 },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  primaryText: { color: colors.onAccent },
});
