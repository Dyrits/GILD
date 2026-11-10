import type { MissionId, MissionSummary } from "@gild/contracts";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { CrestBadge } from "../crest/crest";
import { BudgetMeters } from "../editors/budgets";
import {
  type BoardColumn,
  boardColumns,
  boardOf,
  isStateShownOn,
  splitEarlier,
  trimmedColumns,
} from "../foundation/boardColumns";
import type { ServiceClient } from "../foundation/client";
import { tokenCountOf } from "../foundation/labels";
import { colors, cut, fonts, ink, lift, stateLabels } from "../foundation/theme";
import { Banner } from "../ui/banner";
import { StateBadge } from "../ui/controls";
import { MissionEndingActions } from "./missionActions";

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
  isSelected = false,
  mission,
  onOpen,
  onOpenQuest,
}: {
  client: ServiceClient;
  /** The column it sits in, or null outside the board (the Archived view). */
  column: BoardColumn | null;
  /** Whether the quest panel beside the board shows this quest. */
  isSelected?: boolean;
  mission: MissionSummary;
  /** Pressing the card: opens the quest, or selects it for the panel beside the board. */
  onOpen: () => void;
  /** Opens the quest itself, from the Open link on the card. */
  onOpenQuest: () => void;
}) {
  const isCircled = mission.state === "Attention";
  // A card under the pointer straightens and rises a little, so the board answers the hand.
  const [isHovered, setIsHovered] = useState(false);
  const cost = mission.budget.spent.cost;
  const { usage } = mission;
  const tokens = usage.input + usage.cacheRead + usage.cacheCreation + usage.output;
  return (
    <View
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      style={[
        local.card,
        mission.state === "Done" && local.cardDone,
        isCircled && local.cardAttention,
        isHovered && local.cardHovered,
        isSelected && local.cardSelected,
        {
          transform: [
            { rotate: isHovered || column === null ? "0deg" : `${tiltOf(mission.id)}deg` },
            { scale: isHovered ? 1.02 : 1 },
          ],
        },
      ]}
    >
      <View pointerEvents="none" style={local.inner} />
      {mission.state === "Done" && column === null && (
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
          <CrestBadge
            crest={mission.workspaceCrest}
            id={mission.workspaceId ?? mission.id}
            isLoose={mission.workspaceId === null}
            size={38}
          />
          <Text numberOfLines={3} style={[local.cardTitle, local.titleText]}>
            {mission.state === "Done" && <Text style={local.tick}>✓ </Text>}
            {mission.title}
          </Text>
        </View>
        <View
          accessibilityLabel={`${cost > 0 ? `API cost $${cost.toFixed(2)}, ` : ""}${tokens} tokens`}
          style={local.costRow}
        >
          <View style={local.coin} />
          {cost > 0 && <Text style={local.cost}>${cost.toFixed(2)}</Text>}
          <Text style={local.tokens}>{tokenCountOf(tokens)} tokens</Text>
        </View>
      </Pressable>
      {mission.state !== "Done" && (column === null || isStateShownOn(column, mission.state)) && (
        <StateBadge state={mission.state} />
      )}
      <BudgetMeters use={mission.budget} />
      <MissionEndingActions client={client} mission={mission} onOpen={onOpenQuest} />
    </View>
  );
}

/** A column's banner, its cloth the color of what the column means. */
function ColumnHeading({ column }: { column: BoardColumn }) {
  const cloth = column === "Attention" ? "red" : column === "Done" ? "green" : column === "Idle" ? "violet" : "blue";
  return <Banner cloth={cloth} title={stateLabels[column]} />;
}

/**
 * The dashboard's missions as a board of three columns, Attention first (art direction of 2026-11-08, after
 * intentic's board): side by side on a wide panel, stacked on a narrow one.
 */
export function MissionBoard({
  client,
  isFiltered = false,
  isWide,
  missions,
  onOpen,
  onOpenQuest,
  selectedId = null,
}: {
  client: ServiceClient;
  /** Whether a search narrows the missions, so every match shows and none is folded away. */
  isFiltered?: boolean;
  isWide: boolean;
  missions: ReadonlyArray<MissionSummary>;
  onOpen: (mission: MissionSummary) => void;
  /** Opens a quest itself, from the Open link on its card. */
  onOpenQuest: (mission: MissionSummary) => void;
  /** The quest the panel beside the board shows, if any. */
  selectedId?: MissionId | null;
}) {
  // The columns whose earlier quests the owner asked to see.
  const [unfolded, setUnfolded] = useState<ReadonlySet<BoardColumn>>(new Set());
  const board = boardOf(missions);
  const toggle = (column: BoardColumn) => {
    const next = new Set(unfolded);
    if (!next.delete(column)) next.add(column);
    setUnfolded(next);
  };
  return (
    <View style={isWide ? local.columns : local.stacked}>
      {boardColumns.map((column) => {
        // Resting and Fulfilled show what was touched today; the rest wait behind a line under the cards.
        const { earlier, shown } =
          trimmedColumns.includes(column) && !isFiltered
            ? splitEarlier(board[column], Date.now(), selectedId)
            : { earlier: [], shown: board[column] };
        const isOpen = unfolded.has(column);
        const visible = isOpen ? board[column] : shown;
        return (
          <View key={column} style={isWide ? local.column : null}>
            <ColumnHeading column={column} />
            {board[column].length === 0 && (
              <Text accessibilityLabel={column === "Attention" ? "Nothing needs you" : "None"} style={local.empty}>
                ✧
              </Text>
            )}
            {board[column].length > 0 && visible.length === 0 && (
              <Text accessibilityLabel="Nothing today" style={local.empty}>
                ✧
              </Text>
            )}
            {visible.map((mission) => (
              <MissionCard
                client={client}
                column={column}
                isSelected={mission.id === selectedId}
                key={mission.id}
                mission={mission}
                onOpen={() => onOpen(mission)}
                onOpenQuest={() => onOpenQuest(mission)}
              />
            ))}
            {earlier.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                onPress={() => toggle(column)}
                style={local.earlier}
              >
                <Text style={local.earlierRule}>── ✧ ──</Text>
                <Text style={local.earlierText}>{isOpen ? "Hide earlier" : `+ ${earlier.length} earlier`}</Text>
                <Text style={local.earlierRule}>── ✧ ──</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    ...ink,
    ...cut,
    ...lift,
    backgroundColor: colors.canvas,
    borderColor: "#9b7544",
    borderWidth: 2,
    gap: 10,
    marginBottom: 22,
    padding: 16,
    paddingTop: 22,
    shadowOffset: { height: 4, width: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    // Web only: the tilt eases away and back instead of snapping.
    ...(Platform.OS === "web" ? ({ transitionDuration: "140ms", transitionProperty: "transform" } as object) : {}),
  },
  cardAttention: { borderColor: colors.danger, borderWidth: 2.5 },
  cardDone: { opacity: 0.8 },
  cardHovered: { borderColor: colors.goldHi, opacity: 1 },
  cardMain: { gap: 4 },
  cardSelected: { borderColor: colors.goldHi, borderWidth: 3 },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: 0.3,
    lineHeight: 24,
    textTransform: "uppercase",
  },
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
  coin: { backgroundColor: colors.gold, borderRadius: 8, height: 15, width: 15 },
  column: {
    borderRightColor: "rgba(184,134,43,0.22)",
    borderRightWidth: 1,
    flexBasis: 220,
    flexGrow: 1,
    minWidth: 0,
    paddingRight: 16,
  },
  // The columns wrap when the board is narrow, as beside the quest panel, so a card never gets too thin to read.
  columns: { alignItems: "stretch", flexDirection: "row", flexWrap: "wrap", gap: 16 },
  cost: { color: colors.text, fontFamily: fonts.mono, fontSize: 15 },
  costRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    paddingTop: 8,
  },
  earlier: { alignItems: "center", gap: 2, marginBottom: 12, paddingVertical: 6 },
  earlierRule: { color: colors.gold, fontFamily: fonts.sans, fontSize: 13, opacity: 0.8 },
  earlierText: { color: colors.goldHi, fontFamily: fonts.sans, fontSize: 16, fontStyle: "italic" },
  // An empty column shows a lone gilt ornament, not a sentence.
  empty: { color: colors.gold, fontSize: 22, marginBottom: 12, opacity: 0.6, textAlign: "center" },
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
  tokens: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 15 },
});
