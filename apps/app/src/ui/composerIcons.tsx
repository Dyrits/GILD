import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "../foundation/theme";

/** The stop icon: a filled square, in the same ink as the send arrow. */
export function StopSquare() {
  return (
    <Svg fill={colors.onAccent} height={16} viewBox="0 0 16 16" width={16}>
      <Rect height={9} rx={1.5} width={9} x={3.5} y={3.5} />
    </Svg>
  );
}

/** The send icon: an arrow drawn in paper ink, pointing up and away from the box. */
export function SendArrow() {
  return (
    <Svg
      fill="none"
      height={16}
      stroke={colors.onAccent}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 16 16"
      width={16}
    >
      <Path d="M8 13.5 L 8.2 3" />
      <Path d="M3.5 7.2 L 8.2 2.6 L 12.6 7" />
    </Svg>
  );
}

/** The side-quest icon: a branch leaving the main line, in dim ink. */
export function SideQuestBranch() {
  return (
    <Svg
      fill="none"
      height={18}
      stroke={colors.textDim}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 20 20"
      width={18}
    >
      <Path d="M5 3v14M5 7h5a5 5 0 0 0 5-5M12 3l3-1 1 3" />
    </Svg>
  );
}
