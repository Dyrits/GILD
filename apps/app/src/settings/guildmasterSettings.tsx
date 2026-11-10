import type { Settings, Tier, TierName } from "@gild/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RunnerPickers, useHarnesses } from "../editors/runners";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Toggle } from "../ui/controls";
import { SettingsCard, SettingsRule } from "./settingsParts";

const tierNames: ReadonlyArray<{ hint: string; name: TierName }> = [
  { hint: "Small, well-scoped, checkable work: renames, small fixes.", name: "Light" },
  { hint: "Ordinary implementation, debugging, and tests.", name: "Balanced" },
  { hint: "Ambiguous, architectural, or risky work.", name: "Heavy" },
];

/**
 * One tier: its Companion when the owner set it, or the words that it is not set. Setting one starts from the
 * default Companion; clearing it returns the tier to the default.
 */
function TierRow({
  client,
  hint,
  name,
  onChange,
  settings,
  tier,
}: {
  client: ServiceClient;
  hint: string;
  name: TierName;
  onChange: (tier: Tier | null) => void;
  settings: Settings;
  tier: Tier | null;
}) {
  const { data: harnesses } = useHarnesses(client);
  return (
    <View style={local.tier}>
      <View style={local.tierHead}>
        <View style={styles.flex}>
          <Text style={local.tierName}>{name}</Text>
          <Text style={styles.muted}>{hint}</Text>
        </View>
        {tier === null ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              onChange({
                accountId: null,
                effort: settings.defaultEffort,
                harness: settings.defaultHarness,
                model: settings.defaultModel,
              })
            }
          >
            <Text style={styles.link}>Set a Companion</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => onChange(null)}>
            <Text style={styles.link}>Clear</Text>
          </Pressable>
        )}
      </View>
      {tier === null ? (
        <Text style={styles.muted}>Not set: this work starts on the default Companion.</Text>
      ) : (
        <RunnerPickers harnesses={harnesses} isCompact={false} onChange={onChange} value={tier} />
      )}
    </View>
  );
}

/**
 * The Guildmaster's settings (quest coordination): whether the rail shows it, and the up to three Companions it picks
 * from by how complex a request is. With none set, quests start on the default Companion.
 */
export function GuildmasterSettings({
  client,
  onSave,
  settings,
}: {
  client: ServiceClient;
  onSave: (change: Partial<Settings>) => void;
  settings: Settings;
}) {
  return (
    <SettingsCard icon="people" title="The Guildmaster">
      <View style={local.toggleRow}>
        <Toggle
          onValueChange={(shouldShowGuildmaster) => onSave({ shouldShowGuildmaster })}
          value={settings.shouldShowGuildmaster}
        />
        <Text style={[styles.body, local.toggleLabel]}>Show the Guildmaster in the rail</Text>
      </View>
      <SettingsRule />
      <Text style={styles.body}>
        Companions the Guildmaster picks from by how demanding a request is. Set only the tiers you want; any left out
        use the default Companion.
      </Text>
      {tierNames.map(({ hint, name }) => (
        <TierRow
          client={client}
          hint={hint}
          key={name}
          name={name}
          onChange={(next) => onSave({ tiers: { ...settings.tiers, [name]: next } })}
          settings={settings}
          tier={settings.tiers[name]}
        />
      ))}
    </SettingsCard>
  );
}

const local = StyleSheet.create({
  tier: { gap: 6, paddingVertical: 6 },
  tierHead: { alignItems: "center", flexDirection: "row", gap: 12 },
  tierName: { color: colors.text, fontFamily: fonts.hand, fontSize: fontSizes.lg, fontWeight: "700" },
  toggleLabel: { flex: 1 },
  toggleRow: { alignItems: "center", flexDirection: "row", gap: 12 },
});
