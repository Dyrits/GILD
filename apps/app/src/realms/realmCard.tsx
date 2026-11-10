import type { MissionSummary, WorkspaceChoice } from "@gild/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { CrestBadge } from "../crest/crest";
import { threadCountOf } from "../foundation/labels";
import { colors, cut, fontSizes, fonts, ink, lift } from "../foundation/theme";

const hovered = (state: { pressed: boolean }) => state.pressed || (state as { hovered?: boolean }).hovered === true;

/**
 * A realm as a card: its crest, its name, its folder, and how many of its quests are open and done. Pressing it leads
 * somewhere; where a realm is being chosen, the chosen one is marked.
 */
export function RealmCard({
  isFluid = false,
  isSelected = false,
  missions,
  onPress,
  realm,
}: {
  /** Shares the row with its neighbours, two to a row where there is room and one where there is not. */
  isFluid?: boolean;
  isSelected?: boolean;
  /** Every quest on the board, from which the realm's own are counted. */
  missions: ReadonlyArray<MissionSummary>;
  onPress: () => void;
  realm: WorkspaceChoice;
}) {
  const own = missions.filter((mission) => mission.workspaceId === realm.id);
  const open = own.filter((mission) => mission.state !== "Done").length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={(state) => [
        local.card,
        isFluid && local.fluid,
        hovered(state) && local.cardHovered,
        isSelected && local.cardSelected,
      ]}
    >
      <CrestBadge crest={realm.crest} id={realm.id} size={56} />
      <View style={local.text}>
        <Text numberOfLines={1} style={local.title}>
          {realm.name}
        </Text>
        <Text numberOfLines={1} style={local.path}>
          {realm.path}
        </Text>
        <Text style={local.meta}>
          {open} open · {own.length - open} done
          {own[0] !== undefined && own.length === 1 ? ` · ${threadCountOf(own[0])}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The sign of choosing no realm: a crossed circle, at the left of the realm cards. It is lit while no realm is chosen,
 * and pressing it unchooses the chosen one.
 */
export function NoRealmButton({ isSelected, onPress }: { isSelected: boolean; onPress: () => void }) {
  const color = isSelected ? colors.text : colors.goldHi;
  return (
    <Pressable
      accessibilityLabel="No realm"
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={(state) => [local.none, isSelected && local.noneOn, hovered(state) && local.cardHovered]}
    >
      <Svg height={30} viewBox="0 0 24 24" width={30}>
        <Circle cx={12} cy={12} fill="none" r={9} stroke={color} strokeWidth={2} />
        <Path d="M5.6 5.6 L18.4 18.4" stroke={color} strokeLinecap="round" strokeWidth={2} />
      </Svg>
    </Pressable>
  );
}

/** The card that adds a realm: a plus and a label, in the size of a realm's card. */
export function AddRealmCard({
  isFluid = false,
  label,
  onPress,
}: {
  isFluid?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [local.card, local.add, isFluid && local.fluid, hovered(state) && local.cardHovered]}
    >
      <Text style={local.plus}>+</Text>
      <Text style={local.title}>{label}</Text>
    </Pressable>
  );
}

const local = StyleSheet.create({
  add: { opacity: 0.85 },
  card: {
    ...ink,
    ...cut,
    ...lift,
    alignItems: "center",
    backgroundColor: colors.canvas,
    flexDirection: "row",
    gap: 14,
    maxWidth: "100%",
    padding: 16,
    width: 380,
  },
  cardHovered: { borderColor: colors.goldHi, transform: [{ translateY: -2 }] },
  cardSelected: { backgroundColor: "#efdcae", borderColor: colors.goldHi, borderWidth: 3 },
  fluid: { flexBasis: 300, flexGrow: 1, minWidth: 0, width: "auto" },
  meta: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  none: {
    alignItems: "center",
    borderColor: colors.gold,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  noneOn: { backgroundColor: "#efdcae", borderColor: colors.goldHi, borderWidth: 3 },
  path: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fontSizes.xs },
  plus: { color: colors.gold, fontFamily: fonts.sans, fontSize: 40, lineHeight: 48, textAlign: "center", width: 56 },
  text: { flex: 1, gap: 2 },
  title: { color: colors.text, fontFamily: fonts.hand, fontSize: fontSizes.lg, fontWeight: "700" },
});
