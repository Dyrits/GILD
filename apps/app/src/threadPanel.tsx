import type { ContextGauge, ContextPartKind, MissionDetail } from "@gild/contracts";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BudgetMeters } from "./budgets";
import type { ServiceClient } from "./client";
import { StateBadge } from "./controls";
import { effortLabel, harnessLabels, modelLabelOf } from "./formatting";
import {
  contextLevelOf,
  contextPartLabels,
  contextUseTextOf,
  loreGaugeValueOf,
  threadSpendingTextOf,
  tokenCountOf,
} from "./labels";
import { budgetValueOf, Group, Row } from "./questPanel";
import { colors, fontSizes, fonts, radii } from "./theme";
import { useServiceQuery } from "./useServiceQuery";
import { useSkills } from "./useSkills";

/** The colors the gauge's parts are drawn in, from the part filling the bar first. */
const partColors = {
  Instructions: colors.wood,
  Journal: colors.violet,
  Lore: colors.accent,
  Messages: colors.success,
  ToolsAndResults: colors.gold,
} as const satisfies Record<ContextPartKind, string>;

const levelColors = { normal: colors.success, reached: colors.danger, warning: colors.warning } as const;

/** The context gauge: a bar split by what fills the window, and one line per part (thread-panel). */
function ContextMeter({ gauge }: { gauge: ContextGauge }) {
  const level = contextLevelOf(gauge.tokens, gauge.windowTokens);
  return (
    <View accessibilityLabel="Context" style={local.meter}>
      <Text style={[local.meterText, { color: levelColors[level] }]}>{contextUseTextOf(gauge)}</Text>
      <View style={local.bar}>
        {gauge.parts.map((part) => (
          <View
            key={part.kind}
            style={{ backgroundColor: partColors[part.kind], flexGrow: part.tokens, flexShrink: 1, height: 8 }}
          />
        ))}
        <View style={{ flexGrow: Math.max(0, gauge.windowTokens - gauge.tokens), flexShrink: 1 }} />
      </View>
      {gauge.parts.map((part) => (
        <View key={part.kind} style={local.legend}>
          <View style={[local.swatch, { backgroundColor: partColors[part.kind] }]} />
          <Text style={local.legendLabel}>{contextPartLabels[part.kind]}</Text>
          <Text style={local.rowValue}>{tokenCountOf(part.tokens)}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The selected thread's panel (thread-panel): what it runs with, how full its context window is and what fills
 * it, its lore, skills, budget, and what it spent. Read-only.
 */
export function ThreadPanel({
  client,
  detail,
  onOpenLore,
}: {
  client: ServiceClient;
  detail: MissionDetail;
  onOpenLore: () => void;
}) {
  const { thread } = detail;
  const { data: panel } = useServiceQuery(client, { _tag: "ReadThreadPanel", threadId: thread.id }, thread.id);
  const skills = useSkills(client, thread.workspace?.path ?? null);
  const [isShowingAllSkills, setIsShowingAllSkills] = useState(false);
  const shownSkills = isShowingAllSkills ? skills : skills.slice(0, 6);
  return (
    <ScrollView contentContainerStyle={local.content} style={local.panel}>
      <Group label="Companion">
        <Row label="Harness" value={harnessLabels[thread.harness]} />
        {thread.accountId !== null && <Row label="Account" value={thread.accountLabel} />}
        <Row label="Model" value={modelLabelOf(thread.model)} />
        <Row label="Effort" value={effortLabel(thread.effort)} />
      </Group>
      <Group label="Realm">
        <Row label={thread.workspace?.name ?? "Scratch folder"} value={thread.workspace?.path ?? "The quest's own"} />
        {thread.workspace?.isMissing === true && <Row label="Folder missing" />}
      </Group>
      <Group label="State">
        <View style={local.row}>
          <Text style={local.rowLabel}>{thread.depth === 0 ? "Quest" : "Side-quest"}</Text>
          <StateBadge state={thread.state} />
        </View>
      </Group>
      <View style={local.section}>
        <Text style={local.groupLabel}>Context</Text>
        <View style={local.card}>
          {panel === null || panel.context === null ? (
            <Text style={local.empty}>Not measured yet</Text>
          ) : (
            <ContextMeter gauge={panel.context} />
          )}
        </View>
      </View>
      <Group label="Knows">
        <Row label="Lore" onPress={onOpenLore} value={loreGaugeValueOf(detail.loreGauge)} />
        {skills.length === 0 ? (
          <Row label="Skills" value="None found" />
        ) : (
          <>
            <Row label="Skills" onPress={() => setIsShowingAllSkills(!isShowingAllSkills)} value={`${skills.length}`} />
            {shownSkills.map((skill) => (
              <Text key={skill.name} numberOfLines={1} style={local.skill}>
                /{skill.name}
              </Text>
            ))}
          </>
        )}
      </Group>
      {panel !== null && (
        <>
          <Group label="Spends">
            <Row label="This thread" value={threadSpendingTextOf(panel)} />
            <Row label="Quest budget" value={budgetValueOf(panel.budget)} />
          </Group>
          <BudgetMeters use={panel.budget} />
        </>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  bar: {
    backgroundColor: colors.controlActive,
    borderRadius: radii.sm,
    flexDirection: "row",
    height: 8,
    overflow: "hidden",
  },
  card: {
    backgroundColor: colors.control,
    borderColor: colors.gold,
    borderRadius: radii.md,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  content: { gap: 14, padding: 16 },
  empty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md, padding: 12 },
  groupLabel: {
    color: colors.textMuted,
    fontFamily: fonts.hand,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  legend: { alignItems: "center", flexDirection: "row", gap: 6 },
  legendLabel: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  meter: { gap: 6, padding: 12 },
  meterText: { fontFamily: fonts.sans, fontSize: fontSizes.md },
  panel: { flex: 1 },
  row: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 40, paddingHorizontal: 12 },
  rowLabel: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  rowValue: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  section: { gap: 4 },
  skill: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.sm, paddingHorizontal: 24 },
  swatch: { borderRadius: 2, height: 10, width: 10 },
});
