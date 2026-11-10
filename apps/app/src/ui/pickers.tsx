import { type ComponentRef, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors, cut, fontSizes, fonts, ink } from "../foundation/theme";
import { type MenuPlacement, menuPlacementOf } from "./menuPlacement";

/** Past this many options, a choice is a drop-down field rather than a segmented control. */
const segmentedLimit = 3;

/** An open list's narrowest width; a drop-down field's list is as wide as the field. */
const listWidth = 200;

/**
 * One choice among options: a segmented control for a few short ones, a drop-down field past that, so a form never
 * shows a row of chips (art direction of 2026-11-08).
 */
export function Choice<T extends string | null>({
  accessibilityLabel,
  options,
  value,
  label,
  onChange,
}: {
  accessibilityLabel?: string;
  options: ReadonlyArray<T>;
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  if (options.length > segmentedLimit) {
    return (
      <Menu
        accessibilityLabel={accessibilityLabel ?? "Choice"}
        isField
        label={label}
        onChange={onChange}
        options={options}
        value={value}
      />
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" style={local.segmented}>
      {options.map((option, index) => {
        const isSelected = option === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            key={String(option)}
            onPress={() => onChange(option)}
            style={[local.segment, index > 0 && local.segmentDivided, isSelected && local.segmentSelected]}
          >
            <Text numberOfLines={1} style={[local.segmentText, isSelected && local.segmentTextSelected]}>
              {label(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * One choice among options that opens its list below it: a compact underlined word, as in a composer's pickers, or
 * with `isField` a full drop-down field, as in a form.
 */
export function Menu<T extends string | null>({
  accessibilityLabel,
  isField = false,
  options,
  value,
  label,
  onChange,
}: {
  accessibilityLabel: string;
  isField?: boolean;
  options: ReadonlyArray<T>;
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  // Where the open list stands in the window, or null while closed.
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
    <View style={[styles.menu, isField && local.fieldWrap]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={isOpen ? close : open}
        ref={button}
        style={[isField ? local.field : styles.menuButton, isOpen && styles.menuButtonOpen]}
      >
        <Text numberOfLines={1} style={isField ? local.fieldText : local.compactText}>
          {label(value)}
        </Text>
        <Text style={styles.menuCaret}>⌄</Text>
      </Pressable>
      {/* The list opens in its own layer over the whole window, so nothing drawn later covers it, a click
          outside closes it, and only one menu is open at a time. */}
      <Modal animationType="none" onRequestClose={close} transparent visible={isOpen}>
        <Pressable accessibilityLabel="Close the menu" onPress={close} style={StyleSheet.absoluteFill} />
        {placement !== null && (
          <ScrollView style={[styles.menuList, local.floating, placement]}>
            {options.map((option) => (
              <Pressable
                accessibilityRole="menuitem"
                key={String(option)}
                onPress={() => {
                  onChange(option);
                  close();
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && local.itemHovered,
                  option === value && styles.menuItemSelected,
                ]}
              >
                <Text numberOfLines={1} style={[styles.menuItemText, option === value && styles.chipTextSelected]}>
                  {label(option)}
                </Text>
                {option === value && <Text style={styles.chipTextSelected}>✓</Text>}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

/** One step on an ordered scale, such as effort: a line with a stop per option and the chosen one filled. */
export function Steps<T extends string>({
  accessibilityLabel,
  options,
  value,
  label,
  onChange,
}: {
  accessibilityLabel: string;
  options: ReadonlyArray<T>;
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="adjustable" style={local.steps}>
      <View style={[local.stepsLine, { left: `${50 / options.length}%`, right: `${50 / options.length}%` }]} />
      <View style={local.stepsRow}>
        {options.map((option) => {
          const isSelected = option === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              key={option}
              onPress={() => onChange(option)}
              style={local.step}
            >
              <View style={isSelected ? local.knob : local.tick} />
              <Text numberOfLines={1} style={[local.stepText, isSelected && local.stepTextSelected]}>
                {label(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  compactText: {
    borderBottomWidth: 1.5,
    borderColor: colors.textDim,
    borderStyle: "dashed",
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "500",
  },
  field: {
    ...ink,
    ...cut,
    alignItems: "center",
    backgroundColor: colors.control,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    minWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fieldText: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  fieldWrap: { alignSelf: "stretch", maxWidth: 420 },
  // The list's own place comes from its button's frame; the shared style's place below the button is dropped.
  // `auto` and not an undefined `top`: react-native-web skips an undefined value, so `top: 100%` stayed and a list
  // placed above its button (a composer at the window's foot) was pushed out of the window.
  floating: { position: "absolute", top: "auto" },
  itemHovered: { backgroundColor: colors.controlHover },
  knob: {
    ...ink,
    backgroundColor: colors.accent,
    borderRadius: 9,
    height: 18,
    marginTop: 1,
    width: 18,
  },
  segment: { flexShrink: 1, paddingHorizontal: 12, paddingVertical: 6 },
  segmentDivided: { borderColor: colors.borderStrong, borderLeftWidth: 1.5 },
  segmented: { ...ink, ...cut, alignSelf: "flex-start", flexDirection: "row", overflow: "hidden" },
  segmentSelected: { backgroundColor: colors.text },
  segmentText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
  segmentTextSelected: { color: colors.onAccent, fontWeight: "600" },
  step: { alignItems: "center", flex: 1, gap: 4 },
  steps: { alignSelf: "stretch", maxWidth: 420, paddingTop: 2 },
  // The line runs between the first and last stops' centers (set inline): each stop takes an equal share of the row.
  stepsLine: { borderColor: colors.borderStrong, borderTopWidth: 1.5, position: "absolute", top: 11 },
  stepsRow: { flexDirection: "row" },
  stepText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs },
  stepTextSelected: { color: colors.accentText, fontWeight: "700" },
  tick: { backgroundColor: colors.borderStrong, height: 12, marginTop: 4, width: 1.5 },
});
