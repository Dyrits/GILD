import type { MissionDetail } from "@gild/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BudgetMeters } from "./budgets";
import type { ServiceClient } from "./client";
import { Badge, Emblem } from "./emblems";
import { usageDetail } from "./formatting";
import { threadCountOf, tokenCountOf } from "./labels";
import { MissionEndingActions, MissionTitle } from "./missionActions";
import { ParchmentFrame } from "./parchment";
import { styles } from "./styles";
import { colors, fontSizes, fonts, ink, radii, stateLabels, stateTones } from "./theme";

/** A labelled group of rows in the card, as in the quest's side panel. */
export function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={local.group}>
      <Text style={local.groupLabel}>{label}</Text>
      <View style={local.card}>{children}</View>
    </View>
  );
}

/** One row of a group: its name, a short value, and a chevron when pressing it opens something. */
export function Row({ onPress, label, value }: { label: string; onPress?: () => void; value?: string }) {
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
export const budgetValueOf = (budget: MissionDetail["mission"]["budget"]) => {
  const { limits, spent } = budget;
  if (limits.tokens !== null) return `${tokenCountOf(spent.tokens)} of ${tokenCountOf(limits.tokens)} tokens`;
  if (limits.cost !== null) return `$${spent.cost.toFixed(2)} of $${limits.cost.toFixed(2)}`;
  return "No limit";
};

type PanelTab = "Knows" | "Spends";

/** The panel's tabs: the name in small capitals, the open one underlined in red; a tab may carry a figure in green. */
function Tabs({
  figures,
  onChange,
  value,
}: {
  figures: Partial<Record<PanelTab, string>>;
  onChange: (tab: PanelTab) => void;
  value: PanelTab;
}) {
  return (
    <View accessibilityRole="tablist" style={local.tabs}>
      {(["Knows", "Spends"] as const).map((tab) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === value }}
          key={tab}
          onPress={() => onChange(tab)}
          style={[local.tab, tab === value && local.tabActive]}
        >
          <Text style={[local.tabText, tab === value && local.tabTextActive]}>
            {tab}
            {figures[tab] !== undefined && <Text style={local.tabFigure}> {figures[tab]}</Text>}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The quest's right side panel, under the header the window's frame gives it: a parchment in a gilt frame with a red
 * bookmark, the quest's emblem and name (press to rename), how it stands, then Knows (its journal), Spends (its
 * budget and usage), and the framed question of how it ends.
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
  const [tab, setTab] = useState<PanelTab>("Knows");
  const tone = stateTones[mission.state];
  const cost = mission.budget.spent.cost;
  return (
    <View style={local.panel}>
      <ScrollView contentContainerStyle={local.content} style={styles.flex}>
        <View style={local.hero}>
          <Text style={local.kicker}>Quest</Text>
          <View style={local.heroRow}>
            <View style={local.tile}>
              <Badge id={mission.id} isChip size={44} />
            </View>
            <MissionTitle client={client} key={mission.title} mission={mission} textStyle={local.heroName} />
          </View>
          <Text numberOfLines={2} style={local.meta}>
            <Text style={[local.metaState, { color: tone.color }]}>{stateLabels[mission.state]}</Text>
            {[mission.workspaceName, threadCountOf(mission)]
              .filter((part) => part !== null)
              .map((part) => ` · ${part}`)
              .join("")}
          </Text>
        </View>
        <Tabs figures={cost > 0 ? { Spends: `$${cost.toFixed(2)}` } : {}} onChange={setTab} value={tab} />
        {tab === "Knows" ? (
          <Pressable accessibilityRole="button" onPress={onOpenJournal} style={local.note}>
            <Emblem name="quill" size={30} tint={colors.accentText} />
            <Text style={local.noteText}>Open the journal: where this quest stands and what it has learned.</Text>
            <Text style={local.chevron}>›</Text>
          </Pressable>
        ) : (
          <View style={local.spends}>
            <Group label="So far">
              <Row label="Budget" onPress={onOpenBudget} value={budgetValueOf(mission.budget)} />
              <Row
                label="Usage"
                value={`${tokenCountOf(usage.input + usage.cacheRead + usage.cacheCreation + usage.output)} tokens`}
              />
            </Group>
            <BudgetMeters onPress={onOpenBudget} use={mission.budget} />
            <Text style={styles.muted}>{usageDetail(usage)}</Text>
          </View>
        )}
        <View style={local.does}>
          <Text style={local.doesHeading}>Does</Text>
          <MissionEndingActions client={client} isButtons={true} mission={mission} />
        </View>
      </ScrollView>
      <ParchmentFrame />
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    ...ink,
    backgroundColor: "rgba(255,248,229,0.6)",
    borderRadius: radii.md,
    overflow: "hidden",
  },
  chevron: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.lg },
  content: { gap: 18, paddingHorizontal: 28, paddingVertical: 26 },
  does: {
    backgroundColor: "rgba(249,236,209,0.55)",
    borderColor: "#ae4735",
    borderRadius: 5,
    borderWidth: 1.5,
    gap: 12,
    padding: 16,
  },
  doesHeading: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: fontSizes.lg,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  group: { gap: 4 },
  groupLabel: {
    color: colors.textMuted,
    fontFamily: fonts.hand,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  hero: { gap: 10 },
  heroName: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.4,
    lineHeight: 27,
    textTransform: "uppercase",
  },
  heroRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingRight: 34 },
  kicker: {
    color: colors.gold,
    fontFamily: fonts.hand,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  meta: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  metaState: { fontWeight: "700" },
  note: {
    alignItems: "center",
    backgroundColor: "#d9e6f6",
    borderColor: "#a6c4ee",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  noteText: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base, fontStyle: "italic" },
  panel: { backgroundColor: colors.paper, flex: 1 },
  pressed: { backgroundColor: colors.controlActive },
  row: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 40, paddingHorizontal: 12 },
  rowLabel: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  rowValue: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  spends: { gap: 10 },
  tab: { borderBottomColor: "transparent", borderBottomWidth: 3, marginBottom: -1, paddingBottom: 8, paddingTop: 4 },
  tabActive: { borderBottomColor: colors.danger },
  tabFigure: { color: colors.success },
  tabs: { borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: 22 },
  tabText: {
    color: colors.textMuted,
    fontFamily: fonts.hand,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  tabTextActive: { color: colors.text },
  tile: {
    alignItems: "center",
    backgroundColor: "#f3e0b6",
    borderColor: colors.gold,
    borderWidth: 2,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
});
