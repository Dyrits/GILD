import type { MissionDetail } from "@gild/contracts";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BudgetMeters } from "./budgets";
import type { ServiceClient } from "./client";
import { StateBadge } from "./controls";
import { usageDetail } from "./formatting";
import { tokenCountOf } from "./labels";
import { MissionEndingActions, MissionTitle } from "./missionActions";
import { styles } from "./styles";
import { colors, fontSizes, fonts, ink, radii } from "./theme";

/** A labelled group of rows in the card, as in the quest's side panel. */
function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={local.group}>
      <Text style={local.groupLabel}>{label}</Text>
      <View style={local.card}>{children}</View>
    </View>
  );
}

/** One row of a group: its name, a short value, and a chevron when pressing it opens something. */
function Row({ onPress, label, value }: { label: string; onPress?: () => void; value?: string }) {
  const content = (
    <>
      <Text style={local.rowLabel}>{label}</Text>
      {value !== undefined && (
        <Text numberOfLines={1} style={local.rowValue}>
          {value}
        </Text>
      )}
      {onPress !== undefined && <Text style={local.chevron}>›</Text>}
    </>
  );
  return onPress === undefined ? (
    <View style={local.row}>{content}</View>
  ) : (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.row, pressed && local.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** What a quest's budget shows as a row value: what is spent against the limit, or that there is none. */
const budgetValueOf = (budget: MissionDetail["mission"]["budget"]) => {
  const { limits, spent } = budget;
  if (limits.tokens !== null) return `${tokenCountOf(spent.tokens)} of ${tokenCountOf(limits.tokens)} tokens`;
  if (limits.cost !== null) return `$${spent.cost.toFixed(2)} of $${limits.cost.toFixed(2)}`;
  return "No limit";
};

/**
 * The quest's right side panel, under the header the window's frame gives it: its name, what it knows (journal), what it spends (budget, usage), and how it ends.
 * It leaves the thread's own conversation alone.
 */
export function QuestSidebar({
  client,
  mission,
  onOpenBudget,
  onOpenJournal,
}: {
  client: ServiceClient;
  mission: MissionDetail["mission"];
  onOpenBudget: () => void;
  onOpenJournal: () => void;
}) {
  const { usage } = mission;
  return (
    <ScrollView contentContainerStyle={local.content} style={local.panel}>
      <View style={local.group}>
        <Text style={local.groupLabel}>Name</Text>
        <View style={local.field}>
          <MissionTitle client={client} key={mission.title} mission={mission} textStyle={local.name} />
        </View>
      </View>
      <Group label="Status">
        <View style={local.row}>
          <Text style={local.rowLabel}>State</Text>
          <StateBadge state={mission.state} />
        </View>
      </Group>
      <Group label="Knows">
        <Row label="Journal" onPress={onOpenJournal} />
      </Group>
      <Group label="Spends">
        <Row label="Budget" onPress={onOpenBudget} value={budgetValueOf(mission.budget)} />
        <Row
          label="Usage"
          value={`${tokenCountOf(usage.input + usage.cacheRead + usage.cacheCreation + usage.output)} tokens`}
        />
      </Group>
      <BudgetMeters onPress={onOpenBudget} use={mission.budget} />
      <Text style={styles.muted}>{usageDetail(usage)}</Text>
      <Group label="Does">
        <View style={local.row}>
          <MissionEndingActions client={client} mission={mission} />
        </View>
      </Group>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  card: { ...ink, backgroundColor: colors.control, borderRadius: radii.md, overflow: "hidden" },
  chevron: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.lg },
  content: { gap: 14, padding: 16 },
  field: { ...ink, backgroundColor: colors.control, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8 },
  group: { gap: 4 },
  groupLabel: {
    color: colors.textMuted,
    fontFamily: fonts.hand,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  name: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md },
  panel: { flex: 1 },
  pressed: { backgroundColor: colors.controlActive },
  row: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 40, paddingHorizontal: 12 },
  rowLabel: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  rowValue: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
});
