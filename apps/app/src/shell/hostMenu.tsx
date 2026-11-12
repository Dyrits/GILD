import { type ComponentRef, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { HostMenuProps } from "../foundation/hostContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { type MenuPlacement, menuPlacementOf } from "../ui/menuPlacement";

const listWidth = 280;

/**
 * The top bar's host menu, as OpenBot's: it names the computer whose Iskios the window shows and lists this computer
 * and every paired host, with a way to pair another (device-pairing, Behavior).
 */
export function HostMenu({ activeId, computerName, hosts, onAdd, onChoose }: HostMenuProps) {
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const button = useRef<ComponentRef<typeof View>>(null);
  const window = useWindowDimensions();
  const isOpen = placement !== null;
  const close = () => setPlacement(null);
  const open = () =>
    button.current?.measureInWindow((x, y, width, height) =>
      setPlacement(menuPlacementOf({ height, width, x, y }, window, listWidth)),
    );
  const active = hosts.find((host) => host.id === activeId);
  const activeName = activeId === null ? computerName : (active?.name ?? "Host");
  const choose = (hostId: string | null) => {
    close();
    onChoose(hostId);
  };
  return (
    <View>
      <Pressable
        accessibilityLabel="Hosts"
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={isOpen ? close : open}
        ref={button}
        style={({ pressed }) => [local.button, (pressed || isOpen) && local.buttonActive]}
      >
        <View style={[local.dot, activeId !== null && local.dotHost]} />
        <Text numberOfLines={1} style={local.buttonText}>
          {activeName}
        </Text>
        <Text style={styles.menuCaret}>⌄</Text>
      </Pressable>
      <Modal animationType="none" onRequestClose={close} transparent visible={isOpen}>
        <Pressable accessibilityLabel="Close the menu" onPress={close} style={StyleSheet.absoluteFill} />
        {placement !== null && (
          <View style={[styles.menuList, local.list, placement]}>
            <Text style={local.heading}>Hosts</Text>
            <HostRow
              isActive={activeId === null}
              label={computerName}
              note="This computer"
              onPress={() => choose(null)}
            />
            {hosts.map((host) => (
              <HostRow
                isActive={host.id === activeId}
                key={host.id}
                label={host.name}
                note="Paired host"
                onPress={() => choose(host.id)}
              />
            ))}
            <View style={local.rule} />
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => {
                close();
                onAdd();
              }}
              style={({ pressed }) => [styles.menuItem, pressed && local.rowPressed]}
            >
              <Text style={local.add}>＋</Text>
              <Text style={styles.menuItemText}>Add a host</Text>
            </Pressable>
          </View>
        )}
      </Modal>
    </View>
  );
}

function HostRow({
  isActive,
  label,
  note,
  onPress,
}: {
  isActive: boolean;
  label: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && local.rowPressed, isActive && styles.menuItemSelected]}
    >
      <View style={[local.dot, local.rowDot, !isActive && local.dotQuiet]} />
      <View style={local.rowText}>
        <Text numberOfLines={1} style={[styles.menuItemText, isActive && styles.chipTextSelected]}>
          {label}
        </Text>
        <Text style={local.note}>{note}</Text>
      </View>
      {isActive && <Text style={styles.chipTextSelected}>✓</Text>}
    </Pressable>
  );
}

const local = StyleSheet.create({
  add: { color: colors.accentText, fontSize: fontSizes.md, width: 18 },
  button: {
    alignItems: "center",
    borderRadius: radii.sm,
    flexDirection: "row",
    gap: 7,
    height: 28,
    maxWidth: 220,
    paddingHorizontal: 9,
  },
  buttonActive: { backgroundColor: colors.ground },
  buttonText: { color: colors.text, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  dot: { backgroundColor: colors.accentText, borderRadius: 5, height: 10, width: 10 },
  dotHost: { backgroundColor: colors.highlight },
  dotQuiet: { backgroundColor: colors.edge },
  heading: {
    color: colors.textDim,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  list: { position: "absolute" },
  note: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  rowDot: { marginRight: 10 },
  rowPressed: { backgroundColor: colors.controlActive },
  rowText: { flex: 1 },
  rule: { backgroundColor: colors.edge, height: 1, marginVertical: 4 },
});
