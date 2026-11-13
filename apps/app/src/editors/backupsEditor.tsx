import { type BackupCompanion, type HarnessList, maxBackups } from "@iskios/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { runnerSummaryOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { Fold, useOpenFold } from "../ui/fold";
import { SortableItem } from "../ui/sortable";
import { RunnerPickers } from "./runners";

/** A bin: removes a backup. A line drawing in the sidebar's style, in the danger color. */
function BinIcon({ color }: { color: string }) {
  return (
    <Svg
      fill="none"
      height={16}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={16}
    >
      <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Svg>
  );
}

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
  isFolded = false,
  onChange,
}: {
  backups: ReadonlyArray<BackupCompanion>;
  harnesses: HarnessList | null;
  /** Without its own frame, for a list drawn inside another card. */
  isBare?: boolean;
  /** Compact underlined words beside each number; named fields beneath it otherwise. */
  isCompact: boolean;
  /** One fold of the Companions tab for each backup, with the same picker as the thread's own Companion. */
  isFolded?: boolean;
  onChange: (backups: ReadonlyArray<BackupCompanion>) => void;
}) {
  const reorder = (from: number, to: number) => {
    const next = [...backups];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    onChange(next);
  };
  const move = (index: number, by: -1 | 1) => reorder(index, index + by);
  const openFold = useOpenFold();
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
    // The one just added is unfolded, to choose it.
    openFold(`backup-${backups.length}`);
  };
  const controls = (index: number) => (
    <View style={local.header}>
      <Text style={local.number}>Order {index + 1}</Text>
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
        hitSlop={6}
        onPress={() => onChange(backups.filter((_, other) => other !== index))}
      >
        <BinIcon color={colors.dangerText} />
      </Pressable>
    </View>
  );
  if (isFolded) {
    return (
      <View style={local.folds}>
        {backups.map((backup, index) => (
          // A backup has no identity but its place in the list.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <SortableItem index={index} key={index} onMove={(from, to) => reorder(from, to)}>
            {(grip) => (
              <Fold
                grip={grip}
                harness={backup.harness}
                id={`backup-${index}`}
                summary={runnerSummaryOf(harnesses, backup)}
                title={`Backup ${index + 1}`}
              >
                {controls(index)}
                <RunnerPickers
                  harnesses={harnesses}
                  isCompact={false}
                  isPanel={true}
                  onChange={(next) => onChange(backups.map((current, other) => (other === index ? next : current)))}
                  value={backup}
                />
              </Fold>
            )}
          </SortableItem>
        ))}
        {backups.length < maxBackups ? (
          <Pressable accessibilityRole="button" onPress={add}>
            <Text style={local.add}>+ Add a backup Companion</Text>
          </Pressable>
        ) : (
          <Text style={styles.muted}>The most is {maxBackups}.</Text>
        )}
      </View>
    );
  }
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  control: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, paddingHorizontal: 4 },
  controlOff: { color: colors.textMuted, opacity: 0.4 },
  folds: { gap: 8 },
  header: { alignItems: "center", flexDirection: "row", gap: 10 },
  item: { gap: 8, minHeight: 46, padding: 12 },
  itemRuled: { borderTopColor: colors.border, borderTopWidth: 1 },
  number: { color: colors.textMuted, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  pickers: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pickersNamed: { alignItems: "stretch", flexDirection: "column", gap: 6 },
  remove: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
});
