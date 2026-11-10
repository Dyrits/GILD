import type { BackupCompanion, ThreadId } from "@gild/contracts";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "./client";
import { effortLabel, harnessLabels, modelLabelOf } from "./formatting";
import { RunnerPickers, useHarnesses } from "./runners";
import { styles } from "./styles";
import { colors, fontSizes, fonts, radii } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

const maxBackups = 5;

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
  const list = backups ?? [];
  const move = (index: number, by: -1 | 1) => {
    const next = [...list];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(index + by, 0, moved);
    save(next);
  };
  const add = () => {
    // The first harness other than the thread's own listed, on its first listed model.
    const other = harnesses?.harnesses.find((candidate) => candidate.problem === null && candidate.models.length > 0);
    save([
      ...list,
      {
        accountId: null,
        effort: "default",
        harness: other?.name ?? "claude",
        model: other?.models[0]?.id ?? "default",
      },
    ]);
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
        <View style={local.card}>
          {list.map((backup, index) => (
            // A backup has no identity but its place in the list.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <View key={index} style={[local.item, index > 0 && local.itemRuled]}>
              <Text style={local.number}>{index + 1}</Text>
              <View style={local.pickers}>
                <RunnerPickers
                  harnesses={harnesses}
                  isCompact={true}
                  onChange={(next) => save(list.map((current, other) => (other === index ? next : current)))}
                  value={backup}
                />
              </View>
              <Pressable
                accessibilityLabel={`Move backup ${index + 1} up`}
                accessibilityRole="button"
                disabled={index === 0}
                onPress={() => move(index, -1)}
              >
                <Text style={[local.control, index === 0 && local.controlOff]}>↑</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Move backup ${index + 1} down`}
                accessibilityRole="button"
                disabled={index === list.length - 1}
                onPress={() => move(index, 1)}
              >
                <Text style={[local.control, index === list.length - 1 && local.controlOff]}>↓</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Remove backup ${index + 1}`}
                accessibilityRole="button"
                onPress={() => save(list.filter((_, other) => other !== index))}
              >
                <Text style={local.remove}>Remove</Text>
              </Pressable>
            </View>
          ))}
          {list.length < maxBackups ? (
            <Pressable
              accessibilityRole="button"
              onPress={add}
              style={[local.item, list.length > 0 && local.itemRuled]}
            >
              <Text style={local.add}>+ Add a backup Companion</Text>
            </Pressable>
          ) : (
            <Text style={[styles.muted, local.item]}>The most a thread has is {maxBackups}.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  add: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
  card: {
    backgroundColor: "rgba(255,250,236,0.85)",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  content: { gap: 12, paddingVertical: 8 },
  control: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, paddingHorizontal: 4 },
  controlOff: { color: colors.textMuted, opacity: 0.4 },
  item: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, minHeight: 46, padding: 12 },
  itemRuled: { borderTopColor: colors.border, borderTopWidth: 1 },
  label: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
  number: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md, width: 16 },
  pickers: { alignItems: "center", flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 10, minWidth: 200 },
  remove: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
});
