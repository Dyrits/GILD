import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontSizes, fonts, outline, round } from "../foundation/theme";
import { noFocusRing } from "../ui/pointer";
import { type ChosenFilter, filterTextOf } from "./usageLabels";
import { periodOfRange } from "./usageScale";

/** The active filters as chips, each easy to clear, and one to clear them all. */
export function FilterChips({
  filters,
  onClear,
  onClearAll,
}: {
  filters: ReadonlyArray<ChosenFilter>;
  onClear: (filter: ChosenFilter) => void;
  onClearAll: () => void;
}) {
  if (filters.length === 0) return null;
  return (
    <View accessibilityLabel="Active filters" style={local.chips}>
      {filters.map((filter) => (
        <Pressable
          accessibilityLabel={`Clear filter ${filterTextOf(filter)}`}
          accessibilityRole="button"
          key={filter.dimension}
          onPress={() => onClear(filter)}
          style={local.chip}
        >
          <Text style={local.chipText}>{filterTextOf(filter)} ✕</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={onClearAll} style={local.chipPlain}>
        <Text style={local.link}>Clear filters</Text>
      </Pressable>
    </View>
  );
}

/** The two days of a custom range, typed as `YYYY-MM-DD`; the page follows them once both are real days within a year. */
export function RangeFields({
  from,
  onChange,
  to,
}: {
  from: string;
  onChange: (from: string, to: string) => void;
  to: string;
}) {
  const isValid = periodOfRange(from, to) !== null;
  return (
    <View style={local.range}>
      <TextInput
        accessibilityLabel="First day"
        onChangeText={(text) => onChange(text, to)}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.placeholder}
        style={[local.dateField, !isValid && local.dateFieldInvalid]}
        value={from}
      />
      <Text style={local.caption}>to</Text>
      <TextInput
        accessibilityLabel="Last day"
        onChangeText={(text) => onChange(from, text)}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.placeholder}
        style={[local.dateField, !isValid && local.dateFieldInvalid]}
        value={to}
      />
      {!isValid && <Text style={local.invalid}>Use real days, the first not after the last, up to a year.</Text>}
    </View>
  );
}

/** What the estimates are and are not, folded under the page. */
export function Estimates() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={local.caption}>{isOpen ? "▾" : "▸"} About these estimates</Text>
      </Pressable>
      {isOpen && (
        <View style={{ gap: 4 }}>
          <Text style={local.caption}>
            Costs are API-equivalent estimates from a public price table, not subscription charges. A cost marked ≈ is
            estimated; one without it is what the harness reported. Tools, media, and other separate fees are not
            calculated.
          </Text>
          <Text style={local.caption}>
            A turn with an unknown price or incomplete usage stays unavailable and is never guessed, so known totals may
            understate what was used. Cached input can exceed the other tokens because a conversation's context is read
            again with each turn. A quest's realm is the one it is in now.
          </Text>
          <Text style={local.caption}>
            Token figures here do not change the tokens that budgets count, which include cache reads.
          </Text>
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  caption: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  chip: { ...round, ...outline, backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 5 },
  chipPlain: { paddingHorizontal: 6, paddingVertical: 5 },
  chips: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipText: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.md },
  dateField: {
    ...round,
    ...outline,
    backgroundColor: colors.canvas,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 128,
    ...noFocusRing,
  },
  dateFieldInvalid: { borderColor: colors.danger },
  invalid: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md },
  link: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.md },
  range: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
