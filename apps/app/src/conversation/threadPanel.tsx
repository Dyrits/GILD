import type { ContextGauge, ContextPartKind, MissionDetail, ThreadId } from "@iskios/contracts";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import {
  contextLevelOf,
  contextPartLabels,
  contextUseTextOf,
  loreGaugeValueOf,
  planLimitsSummaryOf,
  threadSpendingTextOf,
  tokenCountOf,
} from "../foundation/labels";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useSkills } from "../foundation/useSkills";
import { QuestSidebar, Row } from "../quests/questPanel";
import { Button } from "../ui/button";

/** The colors the gauge's parts are drawn in, from the part filling the bar first. */
const partColors = {
  Instructions: colors.ground,
  Journal: colors.violet,
  Lore: colors.accent,
  Messages: colors.success,
  ToolsAndResults: colors.edge,
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

/** The side-quest's own "Mark as done": it ends the side-quest and leaves its quest as it is. */
function SideQuestDone({ client, state, threadId }: { client: ServiceClient; state: string; threadId: ThreadId }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={local.done}>
      <Button
        isDisabled={state === "Done"}
        label={state === "Done" ? "Done" : "Mark as done"}
        onPress={() =>
          client.request({ _tag: "MarkThreadDone", threadId }).then(
            () => setError(null),
            (reason) => setError(messageOf(reason)),
          )
        }
      />
      {error !== null && <Text style={local.error}>{error}</Text>}
    </View>
  );
}

/**
 * The quest's side panel as its conversation shows it (thread-panel): the quest, then what the selected thread runs
 * with, how full its context window is and what fills it, its realm, lore, skills, and what it spent.
 */
export function ThreadPanel({
  client,
  detail,
  onOpenBudget,
  onOpenJournal,
  onOpenLore,
  onOpenQuest,
}: {
  client: ServiceClient;
  detail: MissionDetail;
  onOpenBudget: () => void;
  onOpenJournal: () => void;
  onOpenLore: () => void;
  /** Opens the quest's own thread, from a side-quest's panel. */
  onOpenQuest: () => void;
}) {
  const { thread } = detail;
  const { data: panel } = useServiceQuery(client, { _tag: "ReadThreadPanel", threadId: thread.id }, thread.id);
  const skills = useSkills(client, thread.workspace?.path ?? null);
  const [isShowingSkills, setIsShowingSkills] = useState(false);
  const modelValue = `${modelLabelOf(thread.model)} · ${effortLabel(thread.effort)}`;
  const harnessValue =
    thread.accountId === null
      ? harnessLabels[thread.harness]
      : `${harnessLabels[thread.harness]} · ${thread.accountLabel}`;
  const companions = (
    <>
      <Row icon="chip" label="Harness" mark={thread.harness} value={harnessValue} />
      {panel !== null && <Row icon="chart" label="Plan limits" value={planLimitsSummaryOf(panel.planLimits)} />}
      <Row icon="model" label="Model" value={modelValue} />
      <View style={local.contextRow}>
        {panel === null || panel.context === null ? (
          <Text style={local.empty}>Context not measured yet</Text>
        ) : (
          <ContextMeter gauge={panel.context} />
        )}
      </View>
    </>
  );
  const knows = (
    <>
      <Row
        icon="folder"
        label={thread.workspace?.name ?? "Scratch folder"}
        value={thread.workspace?.isMissing === true ? "Folder missing" : (thread.workspace?.path ?? "The quest's own")}
      />
      <Row icon="library" label="Lore" onPress={onOpenLore} value={loreGaugeValueOf(detail.loreGauge)} />
      <Row
        icon="puzzle"
        label="Skills"
        onPress={skills.length === 0 ? undefined : () => setIsShowingSkills(!isShowingSkills)}
        value={skills.length === 0 ? "None found" : `${skills.length} available`}
      />
      {isShowingSkills && <Text style={local.skills}>{skills.map((skill) => `/${skill.name}`).join("  ")}</Text>}
    </>
  );
  const spends = panel !== null && <Row icon="coins" label="This thread" value={threadSpendingTextOf(panel)} />;
  return (
    <QuestSidebar
      client={client}
      mission={detail.mission}
      onOpenBudget={onOpenBudget}
      onOpenJournal={onOpenJournal}
      thread={{
        companions,
        knows,
        sideQuest:
          thread.depth === 0
            ? null
            : {
                action: <SideQuestDone client={client} state={thread.state} threadId={thread.id} />,
                onOpenQuest,
                title: thread.title,
              },
        spends,
      }}
    />
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
  contextRow: { borderTopColor: colors.border, borderTopWidth: 1 },
  done: { alignItems: "flex-start", gap: 6, padding: 12 },
  empty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md, padding: 12 },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  legend: { alignItems: "center", flexDirection: "row", gap: 6 },
  legendLabel: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  meter: { gap: 6, padding: 12 },
  meterText: { fontFamily: fonts.sans, fontSize: fontSizes.md },
  row: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 42, paddingHorizontal: 12 },
  rowLabel: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  rowValue: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  skills: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    padding: 12,
  },
  swatch: { borderRadius: 2, height: 10, width: 10 },
});
