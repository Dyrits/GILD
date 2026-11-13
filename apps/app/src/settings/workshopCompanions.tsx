import type { BackupCompanion, Settings, TierName } from "@iskios/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackupsEditor } from "../editors/backupsEditor";
import { runnerSummaryOf } from "../editors/companionPicker";
import { RunnerPickers, useHarnesses } from "../editors/runners";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Fold, FoldGroup } from "../ui/fold";
import type { WorkshopFocus } from "./workshopTabs";

/** The three presets, as the Companions tab and the page name them. */
export const tierNames: ReadonlyArray<{ hint: string; name: TierName }> = [
  { hint: "Small, well-scoped, checkable work: renames, small fixes.", name: "Light" },
  { hint: "Ordinary implementation, debugging, and tests.", name: "Balanced" },
  { hint: "Ambiguous, architectural, or risky work.", name: "Heavy" },
];

/** A row of tabs in the Companions tab's own style. */
function Tabs<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (option: T) => void;
  options: ReadonlyArray<T>;
  value: T;
}) {
  return (
    <View accessibilityRole="tablist" style={local.tabs}>
      {options.map((option) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: option === value }}
          key={option}
          onPress={() => onChange(option)}
          style={[local.tab, option === value && local.tabActive]}
        >
          <Text style={[local.tabText, option === value && local.tabTextActive]}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The backup Companions new quests start with, under the default Companion: what the list does, then one fold for each.
 * The tab draws it away from the page, so it reads and saves the list itself, as a thread's does; every change is
 * saved at once.
 */
function DefaultBackups({ client, settings }: { client: ServiceClient; settings: Settings | null }) {
  const { data: harnesses } = useHarnesses(client);
  // The list is the owner's own once they change it; until then it is the saved one.
  const [own, setOwn] = useState<ReadonlyArray<BackupCompanion> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = (backups: ReadonlyArray<BackupCompanion>) => {
    setOwn(backups);
    setError(null);
    client.request({ _tag: "ChangeSettings", change: { backups } }).catch((reason) => setError(messageOf(reason)));
  };
  return (
    <View style={local.backups}>
      <Text style={local.title}>Backup companions</Text>
      <Text style={local.note}>
        When a turn fails, as when a usage limit is reached, a quest carries on with the first of these that differs
        from its own Companion.
      </Text>
      <BackupsEditor
        backups={own ?? settings?.backups ?? []}
        harnesses={harnesses}
        isCompact={false}
        isFolded={true}
        onChange={save}
      />
      {error !== null && <Text style={local.error}>{error}</Text>}
    </View>
  );
}

/**
 * The Companions tab of the Workshop: Default and Presets, and under Presets one tab for each of Light, Balanced, and
 * Heavy. It reads and saves the settings itself; the page's tables show the same values and open it where it is
 * pressed.
 */
export function WorkshopCompanions({
  client,
  focus,
  lastTier,
  onFocus,
}: {
  client: ServiceClient;
  /** What the tab shows; the page's tables and the tab's tabs share it. */
  focus: WorkshopFocus;
  /** The preset the Presets tab opens on. */
  lastTier: TierName;
  onFocus: (focus: WorkshopFocus) => void;
}) {
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: harnesses } = useHarnesses(client);
  const isPresets = focus !== "Default";
  const tierName = focus === "Default" ? lastTier : focus;
  const [error, setError] = useState<string | null>(null);
  const save = (change: Partial<Settings>) => {
    setError(null);
    client.request({ _tag: "ChangeSettings", change }).catch((reason) => setError(messageOf(reason)));
  };
  if (settings === null) return <Text style={local.note}>Reading the settings…</Text>;
  const defaults = {
    accountId: null,
    effort: settings.defaultEffort,
    harness: settings.defaultHarness,
    model: settings.defaultModel,
  };
  const tier = settings.tiers[tierName];
  return (
    <View style={local.panel}>
      <Tabs
        onChange={(next) => onFocus(next === "Presets" ? lastTier : "Default")}
        options={["Default", "Presets"]}
        value={isPresets ? "Presets" : "Default"}
      />
      {isPresets && <Tabs onChange={onFocus} options={tierNames.map(({ name }) => name)} value={tierName} />}
      {!isPresets ? (
        <FoldGroup initial="main" key="default">
          <Fold harness={defaults.harness} id="main" summary={runnerSummaryOf(harnesses, defaults)} title="Companion">
            <RunnerPickers
              client={client}
              harnesses={harnesses}
              isAccountShown={false}
              isCompact={false}
              isPanel={true}
              onChange={(runner) =>
                save({ defaultEffort: runner.effort, defaultHarness: runner.harness, defaultModel: runner.model })
              }
              value={defaults}
            />
          </Fold>
          <DefaultBackups client={client} settings={settings} />
        </FoldGroup>
      ) : (
        <View key={tierName} style={local.tier}>
          <Text style={local.note}>
            {tierNames.find(({ name }) => name === tierName)?.hint} Iskios picks it for work of this weight.
          </Text>
          {tier === null ? (
            <>
              <Text style={local.note}>Not set: this work starts on the default Companion.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => save({ tiers: { ...settings.tiers, [tierName]: defaults } })}
              >
                <Text style={styles.link}>Set a Companion</Text>
              </Pressable>
            </>
          ) : (
            <FoldGroup initial="main">
              <Fold harness={tier.harness} id="main" summary={runnerSummaryOf(harnesses, tier)} title="Companion">
                <RunnerPickers
                  client={client}
                  harnesses={harnesses}
                  isCompact={false}
                  isPanel={true}
                  onChange={(runner) => save({ tiers: { ...settings.tiers, [tierName]: runner } })}
                  value={tier}
                />
              </Fold>
              <Pressable
                accessibilityRole="button"
                onPress={() => save({ tiers: { ...settings.tiers, [tierName]: null } })}
              >
                <Text style={styles.link}>Clear</Text>
              </Pressable>
            </FoldGroup>
          )}
        </View>
      )}
      {error !== null && <Text style={local.error}>{error}</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  backups: { gap: 8, paddingTop: 8 },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  // The column's tabs sit 20 px above the first row (its own 12 px of padding, shortened to 6 for this panel) and the rows 8 px apart; every gap is 14 px.
  panel: { gap: 14 },
  tab: {
    alignItems: "center",
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 5,
  },
  tabActive: { backgroundColor: colors.controlActive },
  tabs: { flexDirection: "row", gap: 6 },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  tabTextActive: { color: colors.accentText, fontWeight: "700" },
  tier: { gap: 8 },
  title: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
});
