import { Image, Pressable } from "react-native";
import { colorScheme } from "../foundation/colorScheme";

/** The same archive icon for a quest's header and a realm's overview. */
export function ArchiveButton({
  isDisabled = false,
  label,
  onPress,
}: {
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={isDisabled} onPress={onPress}>
      <Image
        accessibilityElementsHidden
        source={
          colorScheme === "dark"
            ? require("../../assets/nav/dark/archive.png")
            : require("../../assets/nav/light/archive.png")
        }
        style={{ height: 18, width: 18 }}
      />
    </Pressable>
  );
}
