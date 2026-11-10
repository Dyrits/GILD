import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, cut, fontSizes, fonts, ink, lift } from "../foundation/theme";
import { ParchmentFrame } from "../ui/parchment";
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
          <SettingsIcon name={icon} size={20} tint={colors.goldHi} />
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
      <Text style={local.menuTitle}>Settings</Text>
      <View style={local.rule} />
      {entries}
    </View>
  );
}

const notes = [
  "Permissions limit sensitive actions.",
  "Defaults set your starting harness, model, and effort.",
  "Harnesses and accounts manage sign-ins for each tool.",
  "Messaging decides how quests and side-quests talk to you and to each other.",
  "Limits keep briefings and lore within the model's context.",
] as const;

/** The side panel of the Charter: what its sections do, in a few words each. */
export function SettingsGuide() {
  return (
    <View style={local.guide}>
      <ParchmentFrame hasBookmark={false} />
      <ScrollView contentContainerStyle={local.guideContent}>
        <Text style={local.guideText}>
          Control how agents quest, which models and harnesses to use, how accounts connect, and the limits that keep
          your realm running well.
        </Text>
        <View style={local.notes}>
          <Text style={local.notesTitle}>Quick notes</Text>
          {notes.map((note) => (
            <View key={note} style={local.note}>
              <Text style={local.noteBullet}>◆</Text>
              <Text style={local.noteText}>{note}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** The page's heading on the wood: a red tab with the gear, the title, and what the page is for. */
export function SettingsHeading() {
  return (
    <View style={local.heading}>
      <View style={local.tab}>
        <SettingsIcon name="gear" size={30} tint={colors.goldHi} />
      </View>
      <View style={local.headingText}>
        <Text accessibilityRole="header" style={local.headingTitle}>
          Charter
        </Text>
        <Text style={local.headingLine}>Configure your guild's accounts, budgets, and word limits.</Text>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  body: { gap: 12, paddingBottom: 16, paddingHorizontal: 18 },
  card: { ...ink, ...cut, ...lift, backgroundColor: colors.canvas },
  chevron: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 22 },
  chip: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderColor: colors.gold,
    borderRadius: 4,
    borderWidth: 1.5,
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
  entryActive: { backgroundColor: colors.controlActive, borderColor: colors.gold },
  entryPressed: { backgroundColor: colors.controlHover },
  entryText: { color: colors.textSecondary, fontFamily: fonts.hand, fontSize: fontSizes.base, fontWeight: "600" },
  entryTextActive: { color: colors.text, fontWeight: "700" },
  guide: { backgroundColor: colors.paper, flex: 1 },
  guideContent: { gap: 18, padding: 30 },
  guideText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.base, lineHeight: 21 },
  head: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 14 },
  heading: { alignItems: "center", flexDirection: "row", gap: 16 },
  headingLine: { color: colors.onWood, fontFamily: fonts.sans, fontSize: fontSizes.base, fontStyle: "italic" },
  headingText: { flex: 1, gap: 2 },
  headingTitle: {
    color: colors.onWood,
    fontFamily: fonts.hand,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  headLeft: { alignItems: "center", flexDirection: "row", flexGrow: 1, flexShrink: 1, gap: 12 },
  menu: { ...ink, ...cut, ...lift, backgroundColor: colors.canvas, gap: 4, padding: 12, width: 210 },
  menuRow: { gap: 6 },
  menuRowScroll: { flexGrow: 0 },
  menuTitle: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: fontSizes.lg,
    fontWeight: "700",
    letterSpacing: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  note: { flexDirection: "row", gap: 8 },
  noteBullet: { color: colors.gold, fontSize: 8, lineHeight: 21 },
  notes: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.border,
    borderRadius: 4,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  notesTitle: {
    color: colors.accentText,
    fontFamily: fonts.hand,
    fontSize: fontSizes.base,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  noteText: { color: colors.textSecondary, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md, lineHeight: 19 },
  rule: { backgroundColor: colors.gold, height: 1, opacity: 0.6 },
  summary: {
    color: colors.textSecondary,
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    fontStyle: "italic",
  },
  tab: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderColor: colors.gold,
    borderWidth: 2,
    height: 64,
    justifyContent: "center",
    width: 54,
  },
  title: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: fonts.hand,
    fontSize: fontSizes.base,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  trailing: { alignItems: "center", flexDirection: "row", flexShrink: 1, flexWrap: "wrap", gap: 16 },
});
