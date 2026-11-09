import type { MissionSummary } from "@gild/contracts";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Banner } from "./banner";
import { type BoardColumn, boardColumns, boardOf, isStateShownOn } from "./boardColumns";
import { BudgetMeters } from "./budgets";
import type { ServiceClient } from "./client";
import { StateBadge } from "./controls";
import { Badge } from "./emblems";
import { harnessLabels, modelLabelOf, timeOf, usageText } from "./formatting";
import { threadCountOf } from "./labels";
import { MissionEndingActions } from "./missionActions";
import { EmptyBoard } from "./sketches";
import { styles } from "./styles";
import { colors, cut, fontSizes, fonts, ink, lift, stateLabels } from "./theme";

/** A card's slight, steady tilt (between -1.8 and 1.8 degrees), taken from its id so it does not change between renders. */
const tiltOf = (id: string) => {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return Math.round(((hash % 37) / 36 - 0.5) * 3.6 * 10) / 10;
};

/** One mission as a card: its title, where and how much, its budget, and its ending actions. Cards on the board tilt slightly; those outside it (the archives) lie straight. */
export function MissionCard({
  client,
  column,
  mission,
  onOpen,
}: {
  client: ServiceClient;
  /** The column it sits in, or null outside the board (the Archived view). */
  column: BoardColumn | null;
  mission: MissionSummary;
  onOpen: () => void;
}) {
  const place = [
    harnessLabels[mission.harness],
    modelLabelOf(mission.model),
    mission.workspaceName,
    threadCountOf(mission),
  ]
    .filter((part) => part !== null)
    .join(" · ");
  const isCircled = mission.state === "Attention";
  // A card under the pointer straightens and rises a little, so the board answers the hand.
  const [isHovered, setIsHovered] = useState(false);
  const cost = mission.budget.spent.cost;
  return (
    <View
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      style={[
        local.card,
        mission.state === "Done" && local.cardDone,
        isCircled && local.cardAttention,
        isHovered && local.cardHovered,
        {
          transform: [
            { rotate: isHovered || column === null ? "0deg" : `${tiltOf(mission.id)}deg` },
            { scale: isHovered ? 1.02 : 1 },
          ],
        },
      ]}
    >
      <View pointerEvents="none" style={local.inner} />
      <View pointerEvents="none" style={local.pin} />
      {mission.state === "Done" && (
        <View pointerEvents="none" style={local.ribbon}>
          <Text style={local.ribbonText}>{stateLabels.Done}</Text>
        </View>
      )}
      {isCircled && (
        <View pointerEvents="none" style={local.circle}>
          <Text style={local.seal}>!</Text>
        </View>
      )}
      <Pressable accessibilityRole="button" onPress={onOpen} style={local.cardMain}>
        <View style={local.titleRow}>
          <Badge id={mission.id} isChip size={28} />
          <Text numberOfLines={2} style={[local.cardTitle, local.titleText]}>
            {mission.state === "Done" && <Text style={local.tick}>✓ </Text>}
            {mission.title}
          </Text>
        </View>
        {place !== "" && (
          <Text numberOfLines={1} style={styles.muted}>
            {place}
          </Text>
        )}
        <Text numberOfLines={1} style={local.cardMeta}>
          {usageText(mission.usage)} · {timeOf(mission.lastActivityAt)}
        </Text>
        {cost > 0 && (
          <View accessibilityLabel={`API cost $${cost.toFixed(2)}`} style={local.costRow}>
            <View style={local.coin} />
            <Text style={local.cost}>${cost.toFixed(2)}</Text>
          </View>
        )}
      </Pressable>
      {mission.state !== "Done" && (column === null || isStateShownOn(column, mission.state)) && (
        <StateBadge state={mission.state} />
      )}
      <BudgetMeters use={mission.budget} />
      <MissionEndingActions client={client} mission={mission} />
    </View>
  );
}

/** What each column means, in one italic line under its ribbon. */
const columnCaptions = { Attention: "needs you", Done: "Done", Idle: "Resting", Running: "Running" } as const;

/** A column's banner, its cloth the color of what the column means. */
function ColumnHeading({ column, count }: { column: BoardColumn; count: number }) {
  const cloth = column === "Attention" ? "red" : column === "Done" ? "green" : column === "Idle" ? "violet" : "blue";
  return <Banner caption={columnCaptions[column]} cloth={cloth} count={count} title={stateLabels[column]} />;
}

/**
 * The dashboard's missions as a board of three columns, Attention first (art direction of 2026-11-08, after
 * intentic's board): side by side on a wide panel, stacked on a narrow one.
 */
export function MissionBoard({
  client,
  isWide,
  missions,
  onOpen,
}: {
  client: ServiceClient;
  isWide: boolean;
  missions: ReadonlyArray<MissionSummary>;
  onOpen: (mission: MissionSummary) => void;
}) {
  if (missions.length === 0) return <EmptyBoard line="No quests here yet." />;
  const board = boardOf(missions);
  return (
    <View style={isWide ? local.columns : local.stacked}>
      {boardColumns.map((column) => (
        <View key={column} style={isWide ? local.column : null}>
          <ColumnHeading column={column} count={board[column].length} />
          {board[column].length === 0 && (
            <Text style={local.note}>{column === "Attention" ? "Nothing needs you." : "None."}</Text>
          )}
          {board[column].map((mission) => (
            <MissionCard
              client={client}
              column={column}
              key={mission.id}
              mission={mission}
              onOpen={() => onOpen(mission)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    ...ink,
    ...cut,
    ...lift,
    backgroundColor: colors.canvas,
    gap: 6,
    marginBottom: 12,
    padding: 13,
    paddingTop: 20,
    // Web only: the tilt eases away and back instead of snapping.
    ...(Platform.OS === "web" ? ({ transitionDuration: "140ms", transitionProperty: "transform" } as object) : {}),
  },
  cardAttention: { borderColor: colors.danger },
  cardDone: { opacity: 0.8 },
  cardHovered: { borderColor: colors.goldHi, opacity: 1 },
  cardMain: { gap: 2 },
  cardMeta: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  cardTitle: { color: colors.text, fontFamily: fonts.hand, fontSize: fontSizes.base, fontWeight: "600" },
  circle: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: 16,
    bottom: -8,
    height: 30,
    justifyContent: "center",
    position: "absolute",
    right: -7,
    width: 30,
    zIndex: 1,
  },
  coin: { backgroundColor: colors.gold, borderRadius: 6, height: 11, width: 11 },
  column: { flex: 1, minWidth: 0 },
  columns: { alignItems: "flex-start", flexDirection: "row", gap: 16 },
  cost: { color: colors.text, fontFamily: fonts.mono, fontSize: fontSizes.sm },
  costRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 2 },
  highlighted: { backgroundColor: colors.marker },
  inner: {
    borderColor: colors.border,
    borderRadius: 2,
    borderWidth: 1,
    bottom: 3,
    left: 3,
    opacity: 0.7,
    position: "absolute",
    right: 3,
    top: 3,
  },
  note: { color: colors.onWood, fontFamily: fonts.sans, fontSize: 15, marginBottom: 12 },
  pin: {
    alignSelf: "center",
    backgroundColor: colors.textMuted,
    borderColor: colors.border,
    borderRadius: 4,
    borderWidth: 1,
    height: 7,
    position: "absolute",
    top: 5,
    width: 7,
  },
  ribbon: {
    backgroundColor: colors.success,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 9,
    paddingVertical: 2,
    position: "absolute",
    right: 0,
    top: -7,
    zIndex: 1,
  },
  ribbonText: {
    color: colors.onWood,
    fontFamily: fonts.hand,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  seal: { color: colors.canvas, fontFamily: fonts.hand, fontSize: 18 },
  stacked: { gap: 8 },
  tick: { color: colors.success },
  titleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  titleText: { flex: 1 },
});
