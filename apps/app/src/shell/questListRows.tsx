import type { MissionId, MissionSummary, ThreadId, ThreadSummary } from "@iskios/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { harnessLabels, modelLabelOf } from "../foundation/formatting";
import { colors, fontSizes, fonts, radii, stateLabels, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { agoOf, questListRowsOf } from "./questTree";

/** The shared compact quest and side-quest row, indented beneath its parent. */
function QuestLine({
  depth,
  harness,
  isOpen,
  lastActivityAt,
  model,
  now,
  onOpen,
  onToggle,
  state,
  title,
}: {
  depth: number;
  harness: MissionSummary["harness"];
  isOpen: boolean;
  lastActivityAt: number;
  model: MissionSummary["model"];
  now: number;
  onOpen: () => void;
  onToggle: (() => void) | null;
  state: keyof typeof stateTones;
  title: string;
}) {
  const tone = stateTones[state];
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onOpen}
      style={(pressed: { pressed: boolean; hovered?: boolean }) => [
        local.line,
        { paddingLeft: 4 + depth * 18 },
        (pressed.pressed || pressed.hovered) && local.lineHovered,
      ]}
    >
      {onToggle === null ? (
        <View style={local.fold} />
      ) : (
        <Pressable
          accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${title}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          hitSlop={6}
          onPress={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          style={local.fold}
        >
          <Text style={[local.foldMark, isOpen && local.foldMarkOpen]}>›</Text>
        </Pressable>
      )}
      <View accessibilityLabel={stateLabels[state]} style={[local.dot, { backgroundColor: tone.color }]} />
      <Text numberOfLines={1} style={local.title}>
        {title}
      </Text>
      <Text numberOfLines={1} style={local.meta}>
        {harnessLabels[harness]} · {modelLabelOf(model)} · {agoOf(lastActivityAt, now)}
      </Text>
    </Pressable>
  );
}

/** A quest's tree read at the shared service seam and drawn with the same rows on every overview. */
export function QuestTreeLines({
  client,
  collapsed,
  mission,
  now,
  onOpen,
  onOpenThread,
  onToggle,
  shouldShowAgentThreads,
}: {
  client: ServiceClient;
  collapsed: ReadonlySet<string>;
  mission: MissionSummary;
  now: number;
  onOpen: (missionId: MissionId) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  onToggle: (id: string) => void;
  shouldShowAgentThreads: boolean;
}) {
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadThreadTree", missionId: mission.id },
    `${mission.id}:tree`,
  );
  const threads: ReadonlyArray<ThreadSummary> | null = mission.threadCount > 1 ? data : null;
  return (
    <>
      {questListRowsOf(mission, threads, collapsed, shouldShowAgentThreads).map((row) => (
        <QuestLine
          depth={row.depth}
          harness={row.thread?.harness ?? mission.harness}
          isOpen={!collapsed.has(row.id)}
          key={row.id}
          lastActivityAt={row.thread?.lastActivityAt ?? mission.lastActivityAt}
          model={row.thread?.model ?? mission.model}
          now={now}
          onOpen={() =>
            row.thread === null ? onOpen(mission.id) : onOpenThread(mission.id, row.thread.id as ThreadId)
          }
          onToggle={row.hasChildren ? () => onToggle(row.id) : null}
          state={row.thread?.state ?? mission.state}
          title={row.thread?.title ?? mission.title}
        />
      ))}
      {error !== null && <Text style={local.error}>{error}</Text>}
    </>
  );
}

const local = StyleSheet.create({
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  error: { color: colors.dangerText },
  fold: { alignItems: "center", height: 20, justifyContent: "center", width: 14 },
  foldMark: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 16, lineHeight: 18 },
  foldMarkOpen: { transform: [{ rotate: "90deg" }] },
  line: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  lineHovered: { backgroundColor: colors.controlHover },
  meta: { color: colors.textMuted, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  title: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base },
});
