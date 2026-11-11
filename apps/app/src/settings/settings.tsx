import {
  BudgetPeriod,
  MessageDelivery as MessageDeliveries,
  type MessageDelivery,
  type Settings,
} from "@iskios/contracts";
import { type ReactNode, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BackupsEditor } from "../editors/backupsEditor";
import { BudgetEditor } from "../editors/budgets";
import { levelLabels } from "../editors/permissions";
import { RunnerPickers, useHarnesses } from "../editors/runners";
import { messageOf, type ServiceClient } from "../foundation/client";
import { useHasSidebar } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { Choice } from "../ui/pickers";
import { AccountBudgetsCard } from "./accountBudgetsCard";
import { AccountsCard, HarnessesCard } from "./accounts";
import { GuildmasterSettings } from "./guildmasterSettings";
import { PricesCard } from "./pricesCard";
import { SettingsCard, SettingsHeading, SettingsMenu, SettingsRule, ToggleRow } from "./settingsParts";
import { activeSectionOf, type SettingsSectionId } from "./settingsSections";

// Stored and wire names keep `intel` so existing data and agents still work: settings keys (`intelHalfLives`, `intelWarningPercent`).

/** What each delivery does to a running thread, as the Settings choice names it. */
const deliveryLabels = {
  Queue: "Queue for its next turn",
  Steer: "Steer its current turn",
} as const satisfies Record<MessageDelivery, string>;

/** A whole-number field with its own Save, checked against its minimum before saving. */
function NumberField({
  label,
  minimum,
  value,
  onSave,
  onInvalid,
}: {
  label: string;
  minimum: number;
  value: number;
  onSave: (value: number) => void;
  onInvalid: (message: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <View style={styles.inlineRow}>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        onChangeText={setDraft}
        style={[styles.input, local.number]}
        value={draft ?? String(value)}
      />
      <Button
        label="Save"
        onPress={() => {
          const parsed = Number(draft ?? value);
          if (!Number.isSafeInteger(parsed) || parsed < minimum) {
            onInvalid(`Use a whole number of at least ${minimum}.`);
            return;
          }
          onSave(parsed);
        }}
      />
    </View>
  );
}

/** A labelled whole-number setting, as one row of a card that holds several. */
function NumberSetting(props: Parameters<typeof NumberField>[0]) {
  return (
    <View style={local.settingRow}>
      <Text style={[styles.body, styles.flex, local.settingLabel]}>{props.label}</Text>
      <NumberField {...props} />
    </View>
  );
}

/** One section of the page: its cards, with its top measured for the menu to scroll to and to mark. */
function Section({
  children,
  id,
  tops,
}: {
  children: ReactNode;
  id: SettingsSectionId;
  tops: { current: Partial<Record<SettingsSectionId, number>> };
}) {
  return (
    <View
      onLayout={(event) => {
        tops.current[id] = event.nativeEvent.layout.y;
      }}
      style={local.section}
    >
      {children}
    </View>
  );
}

/** The Charter (Settings), where the owner chooses how Iskios runs their threads. */
export function SettingsScreen({
  client,
  onBack,
  onPermissions,
}: {
  client: ServiceClient;
  onBack: () => void;
  onPermissions: () => void;
}) {
  const hasSidebar = useHasSidebar();
  const { data: settings, error } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const [saveError, setSaveError] = useState<string | null>(null);
  const harnesses = useHarnesses(client);
  const scroll = useRef<ScrollViewInstance>(null);
  const tops = useRef<Partial<Record<SettingsSectionId, number>>>({});
  const [active, setActive] = useState<SettingsSectionId>("permissions");
  const save = (change: Partial<Settings>) => {
    if (settings === null) return;
    client.request({ _tag: "UpdateSettings", settings: { ...settings, ...change } }).then(
      () => setSaveError(null),
      (reason) => setSaveError(messageOf(reason)),
    );
  };
  const mark = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setActive(
      activeSectionOf({
        isAtEnd: contentOffset.y + layoutMeasurement.height >= contentSize.height - 4,
        scrollTop: contentOffset.y,
        tops: tops.current,
      }),
    );
  };
  const choose = (id: SettingsSectionId) => {
    setActive(id);
    scroll.current?.scrollTo({ animated: true, y: Math.max(0, (tops.current[id] ?? 0) - 4) });
  };
  const menu = <SettingsMenu active={active} isCompact={!hasSidebar} onChoose={choose} />;
  return (
    <View style={[local.page, hasSidebar && local.pageWide]}>
      {hasSidebar && <View style={local.menuColumn}>{menu}</View>}
      <ScrollView
        contentContainerStyle={local.content}
        onScroll={mark}
        ref={scroll}
        scrollEventThrottle={50}
        style={styles.flex}
      >
        {!hasSidebar && (
          <Pressable onPress={onBack}>
            <Text style={[styles.link, local.back]}>← Back</Text>
          </Pressable>
        )}
        <SettingsHeading />
        {!hasSidebar && menu}
        {error !== null && <Text style={local.error}>{error}</Text>}
        {saveError !== null && <Text style={local.error}>{saveError}</Text>}
        {settings && (
          <>
            <Section id="permissions" tops={tops}>
              <SettingsCard
                icon="shield"
                onPress={onPermissions}
                summary={levelLabels[settings.approvalLevel]}
                title="Permissions"
              />
            </Section>
            <Section id="defaults" tops={tops}>
              <SettingsCard icon="sliders" title="Default harness, model, and effort before your first quest">
                <RunnerPickers
                  harnesses={harnesses.data}
                  isAccountShown={false}
                  isCompact={false}
                  onChange={(runner) =>
                    save({ defaultEffort: runner.effort, defaultHarness: runner.harness, defaultModel: runner.model })
                  }
                  // The account is chosen per mission; new missions otherwise start as the last one did.
                  value={{
                    accountId: null,
                    effort: settings.defaultEffort,
                    harness: settings.defaultHarness,
                    model: settings.defaultModel,
                  }}
                />
              </SettingsCard>
              <SettingsCard icon="layers" title="Backup companions">
                <Text style={styles.body}>
                  When a turn fails, as when a usage limit is reached, a quest carries on with the first of these that
                  differs from its own Companion. New quests and their side-quests start with this list; each quest can
                  change its own from its panel.
                </Text>
                <BackupsEditor
                  backups={settings.backups}
                  harnesses={harnesses.data}
                  isCompact={false}
                  onChange={(backups) => save({ backups })}
                />
              </SettingsCard>
              <GuildmasterSettings client={client} onSave={save} settings={settings} />
              <SettingsCard icon="hourglass" title="Quest upkeep">
                <NumberSetting
                  label="Ask about a quest after this many days without activity"
                  minimum={1}
                  onInvalid={setSaveError}
                  onSave={(inactivityDays) => save({ inactivityDays })}
                  value={settings.inactivityDays}
                />
                <SettingsRule />
                <ToggleRow
                  label="Archive done quests automatically"
                  onChange={(shouldAutoArchive) => save({ shouldAutoArchive })}
                  value={settings.shouldAutoArchive}
                />
                <NumberSetting
                  label="Days after a quest is marked done before it is archived"
                  minimum={1}
                  onInvalid={setSaveError}
                  onSave={(autoArchiveDays) => save({ autoArchiveDays })}
                  value={settings.autoArchiveDays}
                />
                <SettingsRule />
                <ToggleRow
                  label="Open an off-topic message as a new quest without asking when no other quest fits"
                  onChange={(shouldOpenOffTopicMissions) => save({ shouldOpenOffTopicMissions })}
                  value={settings.shouldOpenOffTopicMissions}
                />
                <ToggleRow
                  label="Show replies as they're written"
                  onChange={(shouldStreamReplies) => save({ shouldStreamReplies })}
                  value={settings.shouldStreamReplies}
                />
              </SettingsCard>
              <SettingsCard icon="gem" title="Default budget for new quests">
                <BudgetEditor
                  key={`default:${JSON.stringify(settings.defaultMissionBudget)}`}
                  limits={settings.defaultMissionBudget}
                  onSave={(defaultMissionBudget) =>
                    client.request({ _tag: "UpdateSettings", settings: { ...settings, defaultMissionBudget } })
                  }
                  saveLabel="Save default"
                />
              </SettingsCard>
            </Section>
            <Section id="harnesses" tops={tops}>
              <HarnessesCard
                client={client}
                harnesses={harnesses.data}
                onChanged={harnesses.setData}
                onRefresh={harnesses.refresh}
              />
            </Section>
            <Section id="accounts" tops={tops}>
              <AccountsCard client={client} harnesses={harnesses.data} onChanged={harnesses.setData} />
            </Section>
            <Section id="messaging" tops={tops}>
              <SettingsCard
                icon="hourglass"
                title="Send, while work is underway"
                trailing={
                  <Choice
                    label={(delivery) => deliveryLabels[delivery]}
                    onChange={(defaultDelivery) => save({ defaultDelivery })}
                    options={MessageDeliveries.literals}
                    value={settings.defaultDelivery}
                  />
                }
              >
                <ToggleRow
                  label="Show side-quests opened by agents"
                  onChange={(shouldShowAgentThreads) => save({ shouldShowAgentThreads })}
                  value={settings.shouldShowAgentThreads}
                />
              </SettingsCard>
              <SettingsCard
                icon="chat"
                title="Chatter guard · messages between quests and side-quests"
                trailing={
                  <NumberField
                    label="Chatter guard · messages between quests and side-quests"
                    minimum={2}
                    onInvalid={setSaveError}
                    onSave={(chatterThreshold) => save({ chatterThreshold })}
                    value={settings.chatterThreshold}
                  />
                }
              />
            </Section>
            <Section id="limits" tops={tops}>
              <SettingsCard
                icon="layers"
                title="Briefing limit · tokens a quest's briefing may hold"
                trailing={
                  <NumberField
                    label="Briefing limit · tokens a quest's briefing may hold"
                    minimum={1}
                    onInvalid={setSaveError}
                    onSave={(briefingLimit) => save({ briefingLimit })}
                    value={settings.briefingLimit}
                  />
                }
              />
              <SettingsCard
                icon="scroll"
                title="Lore warning · percent of a model's context window before a quest or side-quest's lore icon turns red"
                trailing={
                  <NumberField
                    label="Lore warning · percent of a model's context window before a quest or side-quest's lore icon turns red"
                    minimum={1}
                    onInvalid={setSaveError}
                    onSave={(intelWarningPercent) => save({ intelWarningPercent: Math.min(intelWarningPercent, 100) })}
                    value={settings.intelWarningPercent}
                  />
                }
              />
              <SettingsCard icon="hourglass" title="Lore half-life · days for an unused lore to fade by half">
                {(["preference", "decision", "fact", "temporary"] as const).map((kind) => (
                  <NumberSetting
                    key={kind}
                    label={`Lore half-life · days for an unused ${kind} lore to fade by half`}
                    minimum={1}
                    onInvalid={setSaveError}
                    onSave={(days) => save({ intelHalfLives: { ...settings.intelHalfLives, [kind]: days } })}
                    value={settings.intelHalfLives[kind]}
                  />
                ))}
              </SettingsCard>
              <PricesCard client={client} onSave={save} settings={settings} />
              <AccountBudgetsCard client={client} />
              <SettingsCard icon="gem" title="Global budget, over the period">
                <Choice
                  label={(period) => period}
                  onChange={(globalBudgetPeriod) => save({ globalBudgetPeriod })}
                  options={BudgetPeriod.literals}
                  value={settings.globalBudgetPeriod}
                />
                <BudgetEditor
                  key={`global:${JSON.stringify(settings.globalBudget)}`}
                  limits={settings.globalBudget}
                  onSave={(globalBudget) =>
                    client.request({ _tag: "UpdateSettings", settings: { ...settings, globalBudget } })
                  }
                  saveLabel="Save global budget"
                />
              </SettingsCard>
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  back: { color: colors.highlight },
  content: { gap: 18, paddingHorizontal: 28, paddingVertical: 20 },
  error: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.md },
  menuColumn: { paddingLeft: 20, paddingTop: 20 },
  number: { textAlign: "center", width: 96 },
  page: { backgroundColor: colors.page, flex: 1 },
  pageWide: { flexDirection: "row" },
  section: { gap: 14 },
  settingLabel: { minWidth: 200 },
  settingRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12 },
});
