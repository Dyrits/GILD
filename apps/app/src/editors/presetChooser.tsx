import type { AccountId, EffortChoice, HarnessList, HarnessName, ModelChoice } from "@iskios/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { runnerSummaryOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, round } from "../foundation/theme";
import { ProviderMark } from "../ui/providerMarks";
import { type PresetChoice, presetOf } from "./presets";

/** The preset chooser of the Companions tab: the presets, above the thread's own Companion, each putting its whole stack in place with one press. */
export function PresetChooser({
  accountId,
  choice: { backups, onPreset, presets },
  effort,
  harness,
  harnesses,
  model,
}: {
  accountId: AccountId | null;
  choice: PresetChoice;
  effort: EffortChoice;
  harness: HarnessName;
  harnesses: HarnessList | null;
  model: ModelChoice;
}) {
  const chosen = presetOf(presets, backups === null ? null : { accountId, backups, effort, harness, model });
  return (
    <View style={local.card}>
      <Text style={local.title}>Preset</Text>
      <View accessibilityLabel="Companion presets" accessibilityRole="radiogroup">
        {presets.map((preset) => {
          const isChosen = preset.name === chosen?.name;
          return (
            <Pressable
              accessibilityLabel={`Preset ${preset.name}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isChosen }}
              aria-checked={isChosen}
              key={preset.name}
              onPress={() => onPreset(preset)}
              style={({ pressed }) => [
                styles.menuItem,
                local.preset,
                pressed && local.pressed,
                isChosen && styles.menuItemSelected,
              ]}
            >
              <ProviderMark harness={preset.runner.harness} size={14} />
              <Text style={[local.name, isChosen && styles.chipTextSelected]}>{preset.name}</Text>
              <Text numberOfLines={1} style={local.summary}>
                {runnerSummaryOf(harnesses, preset.runner)}
                {` · ${countedOf(preset.backups.length, "backup")}`}
              </Text>
              {isChosen && <Text style={styles.chipTextSelected}>✓</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    ...outline,
    ...round,
    backgroundColor: colors.surface,
    gap: 4,
    paddingBottom: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  name: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  preset: { alignItems: "center", flexDirection: "row", gap: 8 },
  pressed: { backgroundColor: colors.controlHover },
  summary: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    textAlign: "right",
  },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
});
