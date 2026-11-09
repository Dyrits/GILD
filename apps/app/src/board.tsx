import type { MissionSummary } from "@gild/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type BoardColumn, boardColumns, boardOf, isStateShownOn } from "./boardColumns";
import { BudgetMeters } from "./budgets";
import type { ServiceClient } from "./client";
import { StateBadge } from "./controls";
import { timeOf, usageText } from "./formatting";
import { threadCountOf } from "./labels";
import { MissionEndingActions } from "./missionActions";
import { EmptyBoard } from "./sketches";
import { styles } from "./styles";
import { colors, cut, fontSizes, fonts, ink, lift, stateLabels } from "./theme";

/** One mission as a card: its title, where and how much, its budget, and its ending actions. */
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
  const place = [mission.workspaceName, threadCountOf(mission)].filter((part) => part !== null).join(" · ");
  const isCircled = mission.state === "Attention";
  return (
    <View style={[local.card, mission.state === "Done" && local.cardDone]}>
      <View pointerEvents="none" style={local.pin} />
      {isCircled && (
        <View pointerEvents="none" style={local.circle}>
          <Text style={local.seal}>!</Text>
        </View>
      )}
      <Pressable accessibilityRole="button" onPress={onOpen} style={local.cardMain}>
        <Text numberOfLines={2} style={local.cardTitle}>
          {mission.state === "Done" && <Text style={local.tick}>✓ </Text>}
          {mission.title}
        </Text>
        {place !== "" && (
          <Text numberOfLines={1} style={styles.muted}>
            {place}
          </Text>
        )}
        <Text numberOfLines={1} style={local.cardMeta}>
          {usageText(mission.usage)} · {timeOf(mission.lastActivityAt)}
        </Text>
      </Pressable>
      {(column === null || isStateShownOn(column, mission.state)) && <StateBadge state={mission.state} />}
      <BudgetMeters use={mission.budget} />
      <MissionEndingActions client={client} mission={mission} />
    </View>
  );
}

/** A column's handwritten name; Attention's is highlighted, as with a marker. */
function ColumnHeading({ column, count }: { column: BoardColumn; count: number }) {
  return (
    <View
      style={[
        local.heading,
        {
          backgroundColor:
            column === "Attention"
              ? colors.danger
              : column === "Done"
                ? colors.success
                : column === "Idle"
                  ? colors.violet
                  : colors.accent,
        },
      ]}
    >
      <Text style={local.headingText}>{stateLabels[column]}</Text>
      <Text style={local.count}>{count}</Text>
    </View>
  );
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
  },
  cardDone: { opacity: 0.8 },
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
  column: { flex: 1, minWidth: 0 },
  columns: { alignItems: "flex-start", flexDirection: "row", gap: 16 },
  count: { color: colors.onWood, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
  heading: {
    alignItems: "center",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 3,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginBottom: 16,
    padding: 8,
  },
  headingText: { color: colors.onWood, fontFamily: fonts.hand, fontSize: 13, lineHeight: 20 },
  highlighted: { backgroundColor: colors.marker },
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
  seal: { color: colors.canvas, fontFamily: fonts.hand, fontSize: 18 },
  stacked: { gap: 8 },
  tick: { color: colors.success },
});
