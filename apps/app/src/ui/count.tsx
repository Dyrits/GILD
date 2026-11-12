import { type StyleProp, Text, type TextStyle } from "react-native";
import { exactCountOf } from "../shell/usageFormat";
import { tooltipOf } from "./pointer";

/** A count shortened for reading, with its exact value as the accessible label and, on the web, the tooltip. */
export function Count({
  compact,
  style,
  unit = "tokens",
  value,
}: {
  /** The shortened text shown. */
  compact: string;
  style?: StyleProp<TextStyle>;
  unit?: string;
  value: number;
}) {
  return (
    <Text accessibilityLabel={`${exactCountOf(value)} ${unit}`} style={style} {...tooltipOf(exactCountOf(value))}>
      {compact}
    </Text>
  );
}
