import { StyleSheet, Text, View } from "react-native";
import {
  canChooseColorScheme,
  chooseColorPreference,
  chooseTheme,
  colorPreference,
  theme,
} from "../foundation/colorScheme";
import { colorSchemePreferences } from "../foundation/colorSchemeRules";
import { styles } from "../foundation/styles";
import { type Theme, themes } from "../foundation/themeRules";
import { Choice } from "../ui/pickers";
import { SettingsCard, SettingsRule } from "./settingsParts";

const themeLabels = { gild: "Gild", iskios: "Iskios", one: "One" } as const satisfies Record<Theme, string>;
const colorSchemeLabels = { dark: "Dark", light: "Light", system: "System" } as const satisfies Record<
  (typeof colorSchemePreferences)[number],
  string
>;

/** The Workshop's local theme and light/dark preferences, applied through the existing reload flow. */
export function LookCard() {
  if (!canChooseColorScheme) return null;
  return (
    <SettingsCard icon="sliders" title="Look">
      <View style={local.row}>
        <Text style={[styles.body, local.label]}>Theme</Text>
        <Choice
          accessibilityLabel="Theme"
          label={(name) => themeLabels[name]}
          onChange={chooseTheme}
          options={themes}
          value={theme}
        />
      </View>
      <SettingsRule />
      <View style={local.row}>
        <Text style={[styles.body, local.label]}>Appearance · light, dark, or the system's</Text>
        <Choice
          accessibilityLabel="Appearance"
          label={(preference) => colorSchemeLabels[preference]}
          onChange={chooseColorPreference}
          options={colorSchemePreferences}
          value={colorPreference}
        />
      </View>
    </SettingsCard>
  );
}

const local = StyleSheet.create({
  label: { flex: 1 },
  row: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
});
