import type { MissionState } from "@gild/contracts";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, radii, stateTones } from "./theme";

/** The strokes of each emblem, drawn on a 24 by 24 grid. */
const emblemPaths = {
  anchor: ["M12 3v14", "M8 7h8", "M5 13c0 4 3 7 7 7s7-3 7-7", "M3 13h4", "M17 13h4"],
  bolt: ["M13 3 6 13h5l-1 8 8-11h-5z"],
  castle: ["M4 20V8h3v3h3V8h4v3h3V8h3v12z", "M10 20v-5h4v5"],
  compass: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M15 9l-2 5-5 2 2-5z"],
  crown: ["M4 8l4 4 4-7 4 7 4-4-2 11H6z"],
  flask: ["M9 3h6", "M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"],
  gem: ["M6 4h12l3 5-9 11L3 9z", "M3 9h18", "M9 4l3 5 3-5", "M12 9v11"],
  key: ["M8 5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z", "M11 11l9 9", "M16 16l2-2", "M18 18l2-2"],
  leaf: ["M5 19C5 10 10 5 20 4c0 9-5 14-13 14", "M5 19l8-8"],
  moon: ["M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"],
  quill: ["M20 4C12 4 7 9 6 16l-2 4 4-2c7-1 12-6 12-14z", "M9 15l7-7"],
  scroll: ["M7 4h11a2 2 0 0 1 2 2v1H9", "M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7", "M9 11h7", "M9 15h5"],
  shield: ["M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"],
  star: ["M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"],
  sword: ["M5 19l10-10", "M14 4h6v6l-9 9", "M5 19l-1 1", "M7 13l4 4"],
  tower: ["M8 21V9l-2-3V3h12v3l-2 3v12z", "M10 21v-4h4v4", "M12 11v2"],
} as const satisfies Record<string, readonly string[]>;

/** The names of the emblems a realm or a quest can wear. */
export type EmblemName = keyof typeof emblemPaths;
const emblemNames = Object.keys(emblemPaths) as EmblemName[];

/** The tints an emblem takes, light enough to read on the rail's leather and dark enough on parchment. */
const tints = ["#e2b85a", "#9fc6e8", "#e59a85", "#a9d49b", "#c9a6e6", "#f0c7b4", "#8fd1c6", "#d9d18a"] as const;

const hashOf = (id: string) => {
  let hash = 7;
  for (const char of id) hash = (hash * 33 + char.charCodeAt(0)) % 1_000_003;
  return hash;
};

/** The emblem and tint of a realm or a quest, taken from its id so they stay the same between renders and sessions. */
export const emblemOf = (id: string): { name: EmblemName; tint: string } => {
  const hash = hashOf(id);
  return {
    name: emblemNames[hash % emblemNames.length] ?? "star",
    tint: tints[Math.floor(hash / 17) % tints.length] ?? tints[0],
  };
};

/** One emblem as a stroked line drawing. */
export function Emblem({ name, size = 18, tint }: { name: EmblemName; size?: number; tint: string }) {
  return (
    <Svg
      fill="none"
      height={size}
      stroke={tint}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
      width={size}
    >
      {emblemPaths[name].map((d) => (
        <Path d={d} key={d} />
      ))}
    </Svg>
  );
}

/**
 * The emblem of one realm or quest, by its id; a quest adds a corner dot in the color of its state. With `isChip` it
 * sits on a round leather disc, so its tint reads on parchment.
 */
export function Badge({
  id,
  isChip = false,
  size = 18,
  state,
}: {
  id: string;
  isChip?: boolean;
  size?: number;
  state?: MissionState;
}) {
  const { name, tint } = emblemOf(id);
  const chip = isChip
    ? {
        backgroundColor: colors.leather,
        borderColor: colors.gold,
        borderRadius: radii.pill,
        borderWidth: 1,
        padding: size * 0.2,
      }
    : null;
  return (
    <View style={[chip, { height: size, width: size }]}>
      <Emblem name={name} size={isChip ? size * 0.6 : size} tint={tint} />
      {state !== undefined && <View style={[local.dot, { backgroundColor: stateTones[state].color }]} />}
    </View>
  );
}

/** A small stack of dots, for the realms menu button: a realm's own emblem is not one icon, so the menu has its own. */
export function RealmsIcon({ size = 18, tint }: { size?: number; tint: string }) {
  return (
    <Svg
      fill="none"
      height={size}
      stroke={tint}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
      width={size}
    >
      <Path d="M12 3l9 5-9 5-9-5z" />
      <Path d="M3 12l9 5 9-5" />
      <Path d="M3 16l9 5 9-5" />
      <Circle cx={12} cy={8} fill={tint} r={1} />
    </Svg>
  );
}

const local = StyleSheet.create({
  dot: {
    borderColor: colors.leather,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    bottom: -3,
    height: 9,
    position: "absolute",
    right: -3,
    width: 9,
  },
});
