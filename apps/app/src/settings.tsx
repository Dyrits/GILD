import {
  BudgetPeriod,
  MessageDelivery as MessageDeliveries,
  type MessageDelivery,
  type Settings,
} from "@gild/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AccountsSection } from "./accounts";
import { BudgetEditor } from "./budgets";
import type { ServiceClient } from "./client";
import { Toggle } from "./controls";
import { levelLabels } from "./permissions";
import { Choice } from "./pickers";
import { RunnerPickers, useHarnesses } from "./runners";
import { useHasSidebar } from "./sidebar";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";

/** What each delivery does to a running thread, as the Settings choice names it. */
const deliveryLabels = {
  Queue: "Queue for its next turn",
  Steer: "Steer its current turn",
} as const satisfies Record<MessageDelivery, string>;

/** A whole-number setting with its own Save, checked against its minimum before saving. */
function NumberSetting({
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
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inlineRow}>
        <TextInput
          accessibilityLabel={label}
          keyboardType="number-pad"
          onChangeText={setDraft}
          style={styles.input}
          value={draft ?? String(value)}
        />
        <Pressable
          onPress={() => {
            const parsed = Number(draft ?? value);
            if (!Number.isSafeInteger(parsed) || parsed < minimum) {
              onInvalid(`Use a whole number of at least ${minimum}.`);
              return;
            }
            onSave(parsed);
          }}
        >
          <Text style={styles.link}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The Settings page, where the owner chooses how Gild runs their threads. */
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
  const save = (change: Partial<Settings>) => {
    if (settings === null) return;
    client.request({ _tag: "UpdateSettings", settings: { ...settings, ...change } }).then(
      () => setSaveError(null),
      (reason: Error) => setSaveError(reason.message),
    );
  };
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        {!hasSidebar && (
          <Pressable onPress={onBack}>
            <Text style={styles.link}>← Quests</Text>
          </Pressable>
        )}
        <Text style={styles.heading}>Settings</Text>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {saveError !== null && <Text style={styles.error}>{saveError}</Text>}
      {settings && (
        <View style={styles.settings}>
          <Pressable onPress={onPermissions} style={styles.row}>
            <Text style={[styles.body, styles.flex]}>Permissions · {levelLabels[settings.approvalLevel]}</Text>
            <Text style={styles.link}>›</Text>
          </Pressable>
          <Text style={styles.label}>Default harness, model, and effort before your first quest</Text>
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
          <AccountsSection
            client={client}
            harnesses={harnesses.data}
            onChanged={harnesses.setData}
            onRefresh={harnesses.refresh}
          />
          <Text style={styles.label}>Send, while work is underway</Text>
          <Choice
            label={(delivery) => deliveryLabels[delivery]}
            onChange={(defaultDelivery) => save({ defaultDelivery })}
            options={MessageDeliveries.literals}
            value={settings.defaultDelivery}
          />
          <View style={styles.toggle}>
            <Toggle
              onValueChange={(shouldShowAgentThreads) => save({ shouldShowAgentThreads })}
              value={settings.shouldShowAgentThreads}
            />
            <Text style={styles.body}>Show side-quests opened by agents</Text>
          </View>
          <NumberSetting
            label="Chatter guard · messages between quests and side-quests"
            minimum={2}
            onInvalid={setSaveError}
            onSave={(chatterThreshold) => save({ chatterThreshold })}
            value={settings.chatterThreshold}
          />
          <NumberSetting
            label="Briefing limit · tokens a quest's briefing may hold"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(briefingLimit) => save({ briefingLimit })}
            value={settings.briefingLimit}
          />
          <NumberSetting
            label="Lore warning · percent of a model's context window before a quest or side-quest's lore icon turns red"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(intelWarningPercent) => save({ intelWarningPercent: Math.min(intelWarningPercent, 100) })}
            value={settings.intelWarningPercent}
          />
          <NumberSetting
            label="Lore half-life · days for an unused preference lore to fade by half"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(preference) => save({ intelHalfLives: { ...settings.intelHalfLives, preference } })}
            value={settings.intelHalfLives.preference}
          />
          <NumberSetting
            label="Lore half-life · days for an unused decision lore to fade by half"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(decision) => save({ intelHalfLives: { ...settings.intelHalfLives, decision } })}
            value={settings.intelHalfLives.decision}
          />
          <NumberSetting
            label="Lore half-life · days for an unused fact lore to fade by half"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(fact) => save({ intelHalfLives: { ...settings.intelHalfLives, fact } })}
            value={settings.intelHalfLives.fact}
          />
          <NumberSetting
            label="Lore half-life · days for an unused temporary lore to fade by half"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(temporary) => save({ intelHalfLives: { ...settings.intelHalfLives, temporary } })}
            value={settings.intelHalfLives.temporary}
          />
          <NumberSetting
            label="Ask about a quest after this many days without activity"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(inactivityDays) => save({ inactivityDays })}
            value={settings.inactivityDays}
          />
          <View style={styles.toggle}>
            <Toggle
              onValueChange={(shouldAutoArchive) => save({ shouldAutoArchive })}
              value={settings.shouldAutoArchive}
            />
            <Text style={styles.body}>Archive done quests automatically</Text>
          </View>
          <View style={styles.toggle}>
            <Toggle
              onValueChange={(shouldOpenOffTopicMissions) => save({ shouldOpenOffTopicMissions })}
              value={settings.shouldOpenOffTopicMissions}
            />
            <Text style={styles.body}>
              Open an off-topic message as a new quest without asking when no other quest fits
            </Text>
          </View>
          <NumberSetting
            label="Days after a quest is marked done before it is archived"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(autoArchiveDays) => save({ autoArchiveDays })}
            value={settings.autoArchiveDays}
          />
          <View style={styles.toggle}>
            <Toggle
              onValueChange={(shouldStreamReplies) => save({ shouldStreamReplies })}
              value={settings.shouldStreamReplies}
            />
            <Text style={styles.body}>Show replies as they're written</Text>
          </View>
          <Text style={styles.label}>Default budget for new quests</Text>
          <BudgetEditor
            key={`default:${JSON.stringify(settings.defaultMissionBudget)}`}
            limits={settings.defaultMissionBudget}
            onSave={(defaultMissionBudget) =>
              client.request({ _tag: "UpdateSettings", settings: { ...settings, defaultMissionBudget } })
            }
            saveLabel="Save default"
          />
          <Text style={styles.label}>Global budget, over the period</Text>
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
        </View>
      )}
    </ScrollView>
  );
}
