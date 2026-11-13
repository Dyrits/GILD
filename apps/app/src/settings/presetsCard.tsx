import type { Settings, Tier, TierName } from "@iskios/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useHarnesses } from "../editors/runners";
import type { ServiceClient } from "../foundation/client";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Row } from "../quests/questPanel";
import { CompanionTable } from "./companionTable";
import { SettingsCard } from "./settingsParts";
import { tierNames } from "./workshopCompanions";

/**
 * One preset: its name and what it is for, a Set or Clear beside them, and its Companion as the same table as the
 * default's, or the words that it is not set. Setting one starts from the default Companion; clearing it returns the
 * work to the default.
 */
function PresetRow({
  client,
  hint,
  name,
  onChange,
  rank,
  settings,
  tier,
}: {
  client: ServiceClient;
  hint: string;
  name: TierName;
  onChange: (tier: Tier | null) => void;
  rank: number;
  settings: Settings;
  tier: Tier | null;
}) {
  const { data: harnesses } = useHarnesses(client);
  const defaults = {
    accountId: null,
    effort: settings.defaultEffort,
    harness: settings.defaultHarness,
    model: settings.defaultModel,
  };
  const models = harnesses?.harnesses.find((candidate) => candidate.name === tier?.harness)?.models;
  const account = harnesses?.harnesses
    .find((candidate) => candidate.name === tier?.harness)
    ?.accounts.find((candidate) => candidate.id === tier?.accountId);
  return (
    <View style={local.tier}>
      <View style={local.tierHead}>
        <View style={styles.flex}>
          <Text style={local.tierName}>{name}</Text>
          <Text style={styles.muted}>{hint}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => onChange(tier === null ? defaults : null)}>
          <Text style={styles.link}>{tier === null ? "Set a Companion" : "Clear"}</Text>
        </Pressable>
      </View>
      <CompanionTable
        client={client}
        focus={name}
        harnesses={harnesses}
        onChange={onChange}
        rank={rank}
        rows={
          tier === null ? (
            <Row icon="chip" label="Not set" value="Work of this weight starts on the default Companion" />
          ) : (
            <>
              <Row
                icon="chip"
                label="Harness"
                mark={tier.harness}
                value={
                  account === undefined || tier.accountId === null
                    ? harnessLabels[tier.harness]
                    : `${harnessLabels[tier.harness]} · ${account.label}`
                }
              />
              <Row
                icon="model"
                label="Model"
                value={`${modelLabelOf(tier.model, models)} · ${effortLabel(tier.effort)}`}
              />
            </>
          )
        }
        runner={tier ?? defaults}
      />
    </View>
  );
}

/**
 * The presets: the up to three Companions Iskios picks from by how demanding a request is (quest coordination). With
 * none set, quests start on the default Companion.
 */
export function PresetsCard({
  client,
  onSave,
  settings,
}: {
  client: ServiceClient;
  onSave: (change: Partial<Settings>) => void;
  settings: Settings;
}) {
  return (
    <SettingsCard icon="layers" summary="Iskios picks one by how demanding a request is" title="Presets">
      <Text style={styles.body}>Set only the presets you want; any left out use the default Companion.</Text>
      {tierNames.map(({ hint, name }, index) => (
        <PresetRow
          client={client}
          hint={hint}
          key={name}
          name={name}
          onChange={(next) => onSave({ tiers: { ...settings.tiers, [name]: next } })}
          rank={index + 1}
          settings={settings}
          tier={settings.tiers[name]}
        />
      ))}
    </SettingsCard>
  );
}

const local = StyleSheet.create({
  tier: { gap: 8, paddingVertical: 6 },
  tierHead: { alignItems: "center", flexDirection: "row", gap: 12 },
  tierName: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
});
