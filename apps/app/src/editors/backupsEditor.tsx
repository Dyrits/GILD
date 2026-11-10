import type { BackupCompanion, HarnessList } from "@gild/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { RunnerPickers } from "./runners";

/** The most backup Companions a thread, or the Charter's default list, holds. */
export const maxBackups = 5;

/**
 * An ordered list of backup Companions (thread-panel, Backup companions): each with its harness, account, model, and
 * effort, a move up and a move down, Remove, and **+ Add a backup Companion**. It owns no state: every change goes to
 * `onChange`. A thread's menu and the Charter's default list both draw it.
 */
export function BackupsEditor({
  backups,
  harnesses,
  isBare = false,
  isCompact,
  onChange,
}: {
  backups: ReadonlyArray<BackupCompanion>;
  harnesses: HarnessList | null;
  /** Without its own frame, for a list drawn inside another card. */
  isBare?: boolean;
  /** Compact underlined words beside each number; named fields beneath it otherwise. */
  isCompact: boolean;
  onChange: (backups: ReadonlyArray<BackupCompanion>) => void;
}) {
  const move = (index: number, by: -1 | 1) => {
    const next = [...backups];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(index + by, 0, moved);
    onChange(next);
  };
  const add = () => {
    // The first installed harness, on its first listed model.
    const first = harnesses?.harnesses.find((candidate) => candidate.problem === null && candidate.models.length > 0);
    onChange([
      ...backups,
      {
        accountId: null,
        effort: "default",
        harness: first?.name ?? "claude",
        model: first?.models[0]?.id ?? "default",
      },
    ]);
  };
  return (
    <View style={isBare ? undefined : local.card}>
      {backups.map((backup, index) => (
        // A backup has no identity but its place in the list.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <View key={index} style={[local.item, index > 0 && local.itemRuled]}>
          <View style={local.header}>
            <Text style={local.number}>{index + 1}</Text>
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
              disabled={index === backups.length - 1}
              onPress={() => move(index, 1)}
            >
              <Text style={[local.control, index === backups.length - 1 && local.controlOff]}>↓</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Remove backup ${index + 1}`}
              accessibilityRole="button"
              onPress={() => onChange(backups.filter((_, other) => other !== index))}
            >
              <Text style={local.remove}>Remove</Text>
            </Pressable>
          </View>
          <View style={[local.pickers, !isCompact && local.pickersNamed]}>
            <RunnerPickers
              harnesses={harnesses}
              isCompact={isCompact}
              onChange={(next) => onChange(backups.map((current, other) => (other === index ? next : current)))}
              value={backup}
            />
          </View>
        </View>
      ))}
      {backups.length < maxBackups ? (
        <Pressable accessibilityRole="button" onPress={add} style={[local.item, backups.length > 0 && local.itemRuled]}>
          <Text style={local.add}>+ Add a backup Companion</Text>
        </Pressable>
      ) : (
        <Text style={[styles.muted, local.item]}>The most is {maxBackups}.</Text>
      )}
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
  control: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, paddingHorizontal: 4 },
  controlOff: { color: colors.textMuted, opacity: 0.4 },
  header: { alignItems: "center", flexDirection: "row", gap: 10 },
  item: { gap: 8, minHeight: 46, padding: 12 },
  itemRuled: { borderTopColor: colors.border, borderTopWidth: 1 },
  number: { color: colors.textMuted, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  pickers: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pickersNamed: { alignItems: "stretch", flexDirection: "column", gap: 6 },
  remove: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
});
