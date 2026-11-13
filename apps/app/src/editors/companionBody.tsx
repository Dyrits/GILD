import type { AccountId, EffortChoice, HarnessList, HarnessName, ModelChoice } from "@iskios/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, round } from "../foundation/theme";
import { modelsMatching } from "../ui/modelSearch";
import { Menu, Steps } from "../ui/pickers";
import { ProviderMark } from "../ui/providerMarks";

const harnessNames: ReadonlyArray<HarnessName> = ["claude", "codex", "opencode"];

/** What the by-hand picker shows and can change; `RunnerPickers` owns the rules for each change. */
export type CompanionBodyProps = {
  accountId: AccountId | null;
  accountLabel: (id: AccountId | null) => string;
  accountOptions: ReadonlyArray<AccountId | null>;
  effort: EffortChoice;
  effortOptions: ReadonlyArray<EffortChoice>;
  harness: HarnessName;
  harnesses: HarnessList | null;
  isAccountChosen: boolean;
  model: ModelChoice;
  onAccount: (accountId: AccountId | null) => void;
  onEffort: (effort: EffortChoice) => void;
  onModel: (harness: HarnessName, model: ModelChoice) => void;
};

/** The by-hand picker, drawn in the Companions tab's folds: the harnesses as tabs, a search field, the chosen harness's models, and the effort as a line of stops. */
export function CompanionBody(props: CompanionBodyProps) {
  const { harness, harnesses, model } = props;
  const [browsed, setBrowsed] = useState<HarnessName>(harness);
  const [query, setQuery] = useState("");
  const infoOf = (name: HarnessName) => harnesses?.harnesses.find((candidate) => candidate.name === name);
  const models = infoOf(browsed)?.models ?? [];
  const isCurrent = browsed === harness;
  // The chosen model stays listed when its harness no longer lists it.
  const listed =
    isCurrent && !models.some((option) => option.id === model)
      ? [...models, { id: model, label: modelLabelOf(model, models) }]
      : models;
  const isEffortChosen = isCurrent && props.effortOptions.length > 1;
  const shown = modelsMatching(listed, query);
  return (
    <View style={local.inner}>
      <View accessibilityLabel="Harness" accessibilityRole="radiogroup" style={local.tabs}>
        {harnessNames.map((name) => {
          const isBrowsed = name === browsed;
          const info = infoOf(name);
          return (
            <Pressable
              accessibilityLabel={`${harnessLabels[name]}${info?.problem == null ? "" : " (not installed)"}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isBrowsed }}
              key={name}
              onPress={() => {
                setBrowsed(name);
                setQuery("");
              }}
              style={({ pressed }) => [
                local.tab,
                (pressed || isBrowsed) && local.tabActive,
                info?.problem != null && local.dimmed,
              ]}
            >
              <ProviderMark harness={name} size={16} />
              {name === harness && <View style={local.tabDot} />}
            </Pressable>
          );
        })}
        <Text numberOfLines={1} style={local.tabsName}>
          {harnessLabels[browsed]}
          {infoOf(browsed)?.problem == null ? "" : " · not installed"}
        </Text>
        {isCurrent && props.isAccountChosen && (
          <Menu
            accessibilityLabel="Account"
            label={props.accountLabel}
            onChange={props.onAccount}
            options={props.accountOptions}
            value={props.accountId}
          />
        )}
      </View>
      <TextInput
        accessibilityLabel="Search models"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setQuery}
        placeholder="Search models"
        placeholderTextColor={colors.textDim}
        style={local.search}
        value={query}
      />
      <ScrollView style={local.list}>
        {shown.length === 0 && (
          <Text style={local.empty}>{models.length === 0 ? "No models listed" : "No model matches"}</Text>
        )}
        {shown.map((option) => {
          const isChosen = isCurrent && option.id === model;
          return (
            <Pressable
              accessibilityRole="menuitem"
              key={option.id}
              onPress={() => props.onModel(browsed, option.id)}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && local.itemHovered,
                isChosen && styles.menuItemSelected,
              ]}
            >
              <Text numberOfLines={1} style={[styles.menuItemText, isChosen && styles.chipTextSelected]}>
                {option.label}
              </Text>
              {isChosen && <Text style={styles.chipTextSelected}>✓</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
      {isEffortChosen && (
        <View style={local.footer}>
          <Text style={local.footerName}>Effort</Text>
          <Steps
            accessibilityLabel="Effort"
            label={(effort: EffortChoice) => (effort === "default" ? "default" : effortLabel(effort))}
            onChange={props.onEffort}
            options={props.effortOptions}
            value={props.effort}
          />
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  dimmed: { opacity: 0.45 },
  empty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md, padding: 10 },
  footer: { borderColor: colors.border, borderTopWidth: 1, gap: 4, paddingTop: 8 },
  footerName: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
  inner: { gap: 8 },
  itemHovered: { backgroundColor: colors.controlHover },
  // The whole list shows, and a long one (OpenCode's) scrolls inside its own height.
  list: { flexGrow: 0, maxHeight: 320 },
  search: {
    ...outline,
    ...round,
    backgroundColor: colors.control,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tab: { alignItems: "center", borderRadius: radii.md, height: 30, justifyContent: "center", width: 30 },
  tabActive: { backgroundColor: colors.controlActive },
  tabDot: {
    backgroundColor: colors.accent,
    borderRadius: 3,
    bottom: 3,
    height: 6,
    position: "absolute",
    right: 3,
    width: 6,
  },
  tabs: { alignItems: "center", flexDirection: "row", gap: 4 },
  tabsName: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.xs,
    fontWeight: "600",
    marginLeft: 6,
  },
});
