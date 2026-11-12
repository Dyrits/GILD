import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../foundation/theme";

/**
 * The app's fold mark: an archery arrow, its fletching at the tail and its head pointing right while the group is
 * folded and down while it is open. The sidebar's headings and rows and the Companions tab's folds use it.
 */
export function BowArrow({
  color = colors.text,
  isOpen,
  size = 22,
}: {
  color?: string;
  isOpen: boolean;
  size?: number;
}) {
  return (
    <View style={isOpen && local.open}>
      <Svg
        fill="none"
        height={size}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
        width={size}
      >
        <Path d="M3 12h15" />
        <Path d="M21.5 12 16 8.5v7Z" fill={color} />
        <Path d="M3 12 1.5 9M3 12l-1.5 3M6 12 4.5 9M6 12l-1.5 3" />
      </Svg>
    </View>
  );
}

const local = StyleSheet.create({ open: { transform: [{ rotate: "90deg" }] } });
