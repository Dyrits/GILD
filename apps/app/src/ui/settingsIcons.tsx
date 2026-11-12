import Svg, { Path } from "react-native-svg";
import { emblemPaths } from "../foundation/emblems";

/** The line drawings of the Charter's sections on a 24 by 24 grid, apart from the realm emblems the crest studio offers. */
const iconPaths = {
  chat: ["M4 5h16v11H11l-4 4v-4H4z", "M8 9.5h8", "M8 12.5h5"],
  code: ["M8 7l-5 5 5 5", "M16 7l5 5-5 5", "M14 5l-4 14"],
  gear: emblemPaths.gear,
  gem: emblemPaths.gem,
  hourglass: ["M6 3h12", "M6 21h12", "M7 3c0 5 3 6 5 9-2 3-5 4-5 9", "M17 3c0 5-3 6-5 9 2 3 5 4 5 9"],
  layers: ["M12 3l9 5-9 5-9-5z", "M3 12l9 5 9-5", "M3 16l9 5 9-5"],
  monitor: ["M3 5h18v11H3z", "M9 20h6", "M12 16v4"],
  people: [
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    "M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6",
    "M16 4.5a3.2 3.2 0 0 1 0 6",
    "M18 14.3c2.2.6 3.5 2.6 3.5 5.7",
  ],
  scroll: emblemPaths.scroll,
  shield: emblemPaths.shield,
  sliders: ["M4 7h3", "M11 7h9", "M9 4v6", "M4 17h9", "M17 17h3", "M15 14v6"],
} as const satisfies Record<string, readonly string[]>;

/** The names of the icons the Charter draws: one per section, and the gear of its heading. */
export type SettingsIconName = keyof typeof iconPaths;

/** One Charter icon as a stroked line drawing. */
export function SettingsIcon({ name, size = 18, tint }: { name: SettingsIconName; size?: number; tint: string }) {
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
      {iconPaths[name].map((d) => (
        <Path d={d} key={d} />
      ))}
    </Svg>
  );
}
