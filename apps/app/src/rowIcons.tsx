import Svg, { Path } from "react-native-svg";

/** The strokes of the small icons that begin the side panel's rows, drawn on a 24 by 24 grid. */
const rowIconPaths = {
  account: ["M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M4 20c0-4 3.6-6 8-6s8 2 8 6"],
  book: ["M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z", "M5 17a3 3 0 0 1 3-3h11"],
  chart: ["M4 20V10", "M10 20V4", "M16 20v-7", "M21 20H3"],
  chevron: ["M9 6l6 6-6 6"],
  chip: [
    "M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
    "M10 10h4v4h-4z",
    "M9 3v3",
    "M15 3v3",
    "M9 18v3",
    "M15 18v3",
  ],
  coins: [
    "M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z",
    "M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7",
    "M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  ],
  folder: ["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  gauge: ["M4 17a8 8 0 1 1 16 0", "M12 17l4-5"],
  library: ["M5 4v16", "M10 4v16", "M15 5l4 15", "M3 20h18"],
  model: [
    "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
    "M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z",
  ],
  puzzle: ["M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4H4a2 2 0 1 1 0-4h2V6h4z"],
  shield: ["M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"],
  state: ["M6 21V4", "M6 5h12l-3 4 3 4H6"],
  wallet: ["M4 7a2 2 0 0 1 2-2h12v4", "M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2z", "M16 14.5h.01"],
} as const satisfies Record<string, readonly string[]>;

/** The names of the icons a side-panel row can begin with. */
export type RowIconName = Exclude<keyof typeof rowIconPaths, "chevron">;

function Icon({ name, size, tint }: { name: keyof typeof rowIconPaths; size: number; tint: string }) {
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
      {rowIconPaths[name].map((d) => (
        <Path d={d} key={d} />
      ))}
    </Svg>
  );
}

/** The icon that begins a side-panel row. */
export const RowIcon = ({ name, tint }: { name: RowIconName; tint: string }) => (
  <Icon name={name} size={18} tint={tint} />
);

/** The chevron that ends a row which opens something. */
export const RowChevron = ({ tint }: { tint: string }) => <Icon name="chevron" size={16} tint={tint} />;
