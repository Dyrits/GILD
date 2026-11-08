import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { styles } from "./styles";
import { colors, cut, fontSizes, fonts, ink } from "./theme";

/** Past this many options, a choice is a drop-down field rather than a segmented control. */
const segmentedLimit = 3;

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
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={[styles.menu, isField && local.fieldWrap, isOpen && styles.menuOpen]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={() => setIsOpen(!isOpen)}
        style={[isField ? local.field : styles.menuButton, isOpen && styles.menuButtonOpen]}
      >
        <Text numberOfLines={1} style={isField ? local.fieldText : local.compactText}>
          {label(value)}
        </Text>
        <Text style={styles.menuCaret}>⌄</Text>
      </Pressable>
      {isOpen && (
        <ScrollView style={[styles.menuList, isField && local.fieldList]}>
          {options.map((option) => (
            <Pressable
              accessibilityRole="menuitem"
              key={String(option)}
              onPress={() => {
                onChange(option);
                setIsOpen(false);
              }}
              style={[styles.menuItem, option === value && styles.menuItemSelected]}
            >
              <Text numberOfLines={1} style={[styles.menuItemText, option === value && styles.chipTextSelected]}>
                {label(option)}
              </Text>
              {option === value && <Text style={styles.chipTextSelected}>✓</Text>}
            </Pressable>
          ))}
        </ScrollView>
      )}
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
  fieldList: { right: 0 },
  fieldText: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  fieldWrap: { alignSelf: "stretch", maxWidth: 420 },
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
