import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, round } from "../foundation/theme";
import { Toggle } from "../ui/controls";
import { SettingsIcon, type SettingsIconName } from "../ui/settingsIcons";
import { type SettingsSectionId, settingsSections } from "./settingsSections";

/**
 * One parchment card of the Charter: a red chip with the section's icon, the title in capitals, an optional
 * summary or control beside it, and below them what the card holds. With `onPress` the whole card is a link.
 */
export function SettingsCard({
  children,
  icon,
  onPress,
  summary,
  title,
  trailing,
}: {
  children?: ReactNode;
  icon: SettingsIconName;
  onPress?: () => void;
  /** A short italic line after the title. */
  summary?: string;
  title: string;
  /** A control at the card's right end, level with the title. */
  trailing?: ReactNode;
}) {
  const head = (
    <View style={local.head}>
      <View style={local.headLeft}>
        <View style={local.chip}>
          <SettingsIcon name={icon} size={20} tint={colors.highlight} />
        </View>
        <Text style={local.title}>{title}</Text>
        {summary !== undefined && <Text style={local.summary}>{summary}</Text>}
      </View>
      {trailing !== undefined && <View style={local.trailing}>{trailing}</View>}
      {onPress !== undefined && <Text style={local.chevron}>›</Text>}
    </View>
  );
  return (
    <View style={local.card}>
      {onPress === undefined ? (
        head
      ) : (
        <Pressable accessibilityRole="button" onPress={onPress}>
          {head}
        </Pressable>
      )}
      {children !== undefined && <View style={local.body}>{children}</View>}
    </View>
  );
}

/** A thin gold rule between the blocks of one card. */
export const SettingsRule = () => <View style={local.rule} />;

/**
 * The menu beside the Charter's page: one entry per section, the one in view marked. On a window with room it is a
 * column on a parchment card; on a narrow one, a row to scroll sideways.
 */
export function SettingsMenu({
  active,
  isCompact,
  onChoose,
}: {
  active: SettingsSectionId;
  isCompact: boolean;
  onChoose: (id: SettingsSectionId) => void;
}) {
  const entries = settingsSections.map((section) => {
    const isActive = section.id === active;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        key={section.id}
        onPress={() => onChoose(section.id)}
        style={({ pressed }) => [local.entry, isActive && local.entryActive, pressed && local.entryPressed]}
      >
        <SettingsIcon name={section.icon} size={18} tint={isActive ? colors.text : colors.textMuted} />
        <Text style={[local.entryText, isActive && local.entryTextActive]}>{section.label}</Text>
      </Pressable>
    );
  });
  if (isCompact) {
    return (
      <ScrollView contentContainerStyle={local.menuRow} horizontal style={local.menuRowScroll}>
        {entries}
      </ScrollView>
    );
  }
  return (
    <View style={local.menu}>
      <Text style={local.menuTitle}>Workshop</Text>
      <View style={local.rule} />
      {entries}
    </View>
  );
}

/** The page's heading on the wood: a red tab with the gear, the title, and what the page is for. */
export function SettingsHeading() {
  return (
    <View style={local.heading}>
      <View style={local.tab}>
        <SettingsIcon name="gear" size={30} tint={colors.highlight} />
      </View>
      <View style={local.headingText}>
        <Text accessibilityRole="header" style={local.headingTitle}>
          Workshop
        </Text>
        <Text style={local.headingLine}>Configure your guild's accounts, budgets, and word limits.</Text>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  body: { gap: 12, paddingBottom: 16, paddingHorizontal: 18 },
  card: { ...outline, ...round, backgroundColor: colors.canvas },
  chevron: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 22 },
  chip: {
    alignItems: "center",
    backgroundColor: colors.controlActive,
    borderRadius: radii.md,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  entry: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 3,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  entryActive: { backgroundColor: colors.controlActive, borderColor: colors.edge },
  entryPressed: { backgroundColor: colors.controlHover },
  entryText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  entryTextActive: { color: colors.text, fontWeight: "700" },
  head: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 14 },
  heading: { alignItems: "center", flexDirection: "row", gap: 16 },
  headingLine: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.base, fontStyle: "italic" },
  headingText: { flex: 1, gap: 2 },
  headingTitle: {
    color: colors.onGround,
    fontFamily: fonts.sans,
    fontSize: 28,
    fontWeight: "700",
  },
  headLeft: { alignItems: "center", flexDirection: "row", flexGrow: 1, flexShrink: 1, gap: 12 },
  menu: { ...outline, ...round, backgroundColor: colors.canvas, gap: 4, padding: 12, width: 210 },
  menuRow: { gap: 6 },
  menuRowScroll: { flexGrow: 0 },
  menuTitle: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.lg,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  rule: { backgroundColor: colors.edge, height: 1, opacity: 0.6 },
  summary: {
    color: colors.textSecondary,
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    fontStyle: "italic",
  },
  tab: {
    alignItems: "center",
    backgroundColor: colors.controlActive,
    borderRadius: radii.lg,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  title: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    fontWeight: "700",
  },
  trailing: { alignItems: "center", flexDirection: "row", flexShrink: 1, flexWrap: "wrap", gap: 16 },
});

/** An on and off switch with its words. */
export function ToggleRow({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={toggleStyles.row}>
      <Toggle onValueChange={onChange} value={value} />
      <Text style={[styles.body, toggleStyles.label]}>{label}</Text>
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  label: { flexShrink: 1 },
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
});
