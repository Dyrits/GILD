import { type ComponentRef, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { type MenuPlacement, menuPlacementOf } from "./menuPlacement";

/** The narrowest an open list of actions is drawn. */
const listWidth = 180;

/** One thing the menu can do: its words and what pressing it runs. */
export type MenuAction = { readonly label: string; readonly onPress: () => void };

/**
 * A small "⋯" button that opens a list of actions below it (or above, near the window's foot); pressing an action runs
 * it and closes the list. The list opens in its own layer, as `Menu` does, so a click outside closes it.
 */
export function ActionMenu({ accessibilityLabel, actions }: { accessibilityLabel: string; actions: MenuAction[] }) {
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const button = useRef<ComponentRef<typeof View>>(null);
  const window = useWindowDimensions();
  const isOpen = placement !== null;
  const close = () => setPlacement(null);
  const open = () =>
    button.current?.measureInWindow((x, y, width, height) =>
      setPlacement(menuPlacementOf({ height, width, x, y }, window, listWidth)),
    );
  return (
    <View style={styles.menu}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={isOpen ? close : open}
        ref={button}
        style={({ pressed }) => [local.button, (isOpen || pressed) && styles.menuButtonOpen]}
      >
        <Text style={local.dots}>⋯</Text>
      </Pressable>
      <Modal animationType="none" onRequestClose={close} transparent visible={isOpen}>
        <Pressable accessibilityLabel="Close the menu" onPress={close} style={StyleSheet.absoluteFill} />
        {placement !== null && (
          <View style={[styles.menuList, local.floating, placement]}>
            {actions.map((action) => (
              <Pressable
                accessibilityRole="menuitem"
                key={action.label}
                onPress={() => {
                  close();
                  action.onPress();
                }}
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.controlHover }]}
              >
                <Text numberOfLines={1} style={styles.menuItemText}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Modal>
    </View>
  );
}

const local = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 30,
    justifyContent: "center",
    width: 34,
  },
  dots: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
  // See `Menu`: `auto` and not an undefined `top`, so a list placed above its button is not pushed out of the window.
  floating: { position: "absolute", top: "auto" },
});
