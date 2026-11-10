import type { BackupCompanion, ThreadId } from "@gild/contracts";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BackupsEditor } from "./backupsEditor";
import type { ServiceClient } from "./client";
import { effortLabel, harnessLabels, modelLabelOf } from "./formatting";
import { useHarnesses } from "./runners";
import { styles } from "./styles";
import { colors, fontSizes, fonts } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

const messageOf = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

/** A backup Companion in a line, such as "Claude Code · Sonnet 5.5 · High effort". */
export const backupTextOf = (backup: BackupCompanion) =>
  `${harnessLabels[backup.harness]} · ${modelLabelOf(backup.model)} · ${effortLabel(backup.effort)}`;

/**
 * The menu of a thread's backup Companions (thread-panel, Backups): the order a failed turn falls back through them,
 * each with its harness, account, model, and effort. Every change is saved at once.
 */
export function BackupsScreen({
  client,
  onBack,
  threadId,
  title,
}: {
  client: ServiceClient;
  onBack: () => void;
  threadId: ThreadId;
  title: string;
}) {
  const { data: panel } = useServiceQuery(client, { _tag: "ReadThreadPanel", threadId }, `backups:${threadId}`);
  const { data: harnesses } = useHarnesses(client);
  const [backups, setBackups] = useState<ReadonlyArray<BackupCompanion> | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The list shown is the owner's own once they change it; until then it is the saved one.
  useEffect(() => {
    if (panel !== null) setBackups((current) => current ?? panel.backups);
  }, [panel]);
  const save = (next: ReadonlyArray<BackupCompanion>) => {
    setBackups(next);
    setError(null);
    client
      .request({ _tag: "SetThreadBackups", backups: next, threadId })
      .catch((reason) => setError(messageOf(reason)));
  };
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={[styles.heading, styles.flex]}>
          {title}
        </Text>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <ScrollView contentContainerStyle={local.content} style={styles.flex}>
        <Text style={styles.muted}>
          When a turn of this thread fails, as when a usage limit is reached, the thread carries on with the first
          backup Companion of the order that differs from its own, with the conversation so far. The thread's own
          Companion is not changed back.
        </Text>
        <Text style={local.label}>Order</Text>
        <BackupsEditor backups={backups ?? []} harnesses={harnesses} isCompact={true} onChange={save} />
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  content: { gap: 12, paddingVertical: 8 },
  label: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
});
