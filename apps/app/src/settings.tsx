import {
  BudgetPeriod,
  EffortChoice as EffortChoices,
  MessageDelivery as MessageDeliveries,
  type MessageDelivery,
  ModelChoice as ModelChoices,
  type Settings,
} from "@openmission/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { BudgetEditor } from "./budgets";
import type { ServiceClient } from "./client";
import { Choice } from "./controls";
import { effortLabel, modelLabels } from "./formatting";
import { levelLabels } from "./permissions";
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
      <View style={styles.row}>
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

export function SettingsScreen({
  client,
  onBack,
  onPermissions,
}: {
  client: ServiceClient;
  onBack: () => void;
  onPermissions: () => void;
}) {
  const { data: settings, error } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const [saveError, setSaveError] = useState<string | null>(null);
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
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Missions</Text>
        </Pressable>
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
          <Text style={styles.label}>Default model for new missions</Text>
          <Choice
            label={(m) => modelLabels[m]}
            onChange={(defaultModel) => save({ defaultModel })}
            options={ModelChoices.literals}
            value={settings.defaultModel}
          />
          <Text style={styles.label}>Default effort for new missions</Text>
          <Choice
            label={effortLabel}
            onChange={(defaultEffort) => save({ defaultEffort })}
            options={EffortChoices.literals}
            value={settings.defaultEffort}
          />
          <Text style={styles.label}>Send, while a thread is running</Text>
          <Choice
            label={(delivery) => deliveryLabels[delivery]}
            onChange={(defaultDelivery) => save({ defaultDelivery })}
            options={MessageDeliveries.literals}
            value={settings.defaultDelivery}
          />
          <View style={styles.toggle}>
            <Switch
              onValueChange={(shouldShowAgentThreads) => save({ shouldShowAgentThreads })}
              value={settings.shouldShowAgentThreads}
            />
            <Text style={styles.body}>Show threads opened by agents</Text>
          </View>
          <NumberSetting
            label="Chatter guard · messages between two threads"
            minimum={2}
            onInvalid={setSaveError}
            onSave={(chatterThreshold) => save({ chatterThreshold })}
            value={settings.chatterThreshold}
          />
          <NumberSetting
            label="Briefing limit · tokens a mission's briefing may hold"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(briefingLimit) => save({ briefingLimit })}
            value={settings.briefingLimit}
          />
          <NumberSetting
            label="Intel warning · percent of a model's context window before a thread's intel icon turns red"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(intelWarningPercent) => save({ intelWarningPercent: Math.min(intelWarningPercent, 100) })}
            value={settings.intelWarningPercent}
          />
          <NumberSetting
            label="Intel half-life · days for an unused preference intel to fade by half"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(preference) => save({ intelHalfLives: { ...settings.intelHalfLives, preference } })}
            value={settings.intelHalfLives.preference}
          />
          <NumberSetting
            label="Intel half-life · days for an unused decision intel to fade by half"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(decision) => save({ intelHalfLives: { ...settings.intelHalfLives, decision } })}
            value={settings.intelHalfLives.decision}
          />
          <NumberSetting
            label="Intel half-life · days for an unused fact intel to fade by half"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(fact) => save({ intelHalfLives: { ...settings.intelHalfLives, fact } })}
            value={settings.intelHalfLives.fact}
          />
          <NumberSetting
            label="Intel half-life · days for an unused temporary intel to fade by half"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(temporary) => save({ intelHalfLives: { ...settings.intelHalfLives, temporary } })}
            value={settings.intelHalfLives.temporary}
          />
          <NumberSetting
            label="Ask about a mission after this many days without activity"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(inactivityDays) => save({ inactivityDays })}
            value={settings.inactivityDays}
          />
          <View style={styles.toggle}>
            <Switch
              onValueChange={(shouldAutoArchive) => save({ shouldAutoArchive })}
              value={settings.shouldAutoArchive}
            />
            <Text style={styles.body}>Archive done missions automatically</Text>
          </View>
          <View style={styles.toggle}>
            <Switch
              onValueChange={(shouldOpenOffTopicMissions) => save({ shouldOpenOffTopicMissions })}
              value={settings.shouldOpenOffTopicMissions}
            />
            <Text style={styles.body}>
              Open an off-topic message as a new mission without asking when no other mission fits
            </Text>
          </View>
          <NumberSetting
            label="Days after a mission is marked done before it is archived"
            minimum={1}
            onInvalid={setSaveError}
            onSave={(autoArchiveDays) => save({ autoArchiveDays })}
            value={settings.autoArchiveDays}
          />
          <View style={styles.toggle}>
            <Switch
              onValueChange={(shouldStreamReplies) => save({ shouldStreamReplies })}
              value={settings.shouldStreamReplies}
            />
            <Text style={styles.body}>Show replies as they're written</Text>
          </View>
          <Text style={styles.label}>Default budget for new missions</Text>
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
