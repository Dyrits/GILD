import { EffortChoice as EffortChoices, ModelChoice as ModelChoices, type Settings } from "@openmission/contracts";
import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import type { ServiceClient } from "./client";
import { Choice } from "./controls";
import { effortLabel, modelLabels } from "./formatting";
import { levelLabels } from "./permissions";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";

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
    <View style={styles.screen}>
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
          <View style={styles.toggle}>
            <Switch
              onValueChange={(shouldStreamReplies) => save({ shouldStreamReplies })}
              value={settings.shouldStreamReplies}
            />
            <Text style={styles.body}>Show replies as they're written</Text>
          </View>
        </View>
      )}
    </View>
  );
}
