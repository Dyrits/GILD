import type { AccountId, EffortChoice, HarnessList, HarnessName, ModelChoice } from "@iskios/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, round } from "../foundation/theme";
import { modelsMatching } from "../ui/modelSearch";
import { Steps } from "../ui/pickers";
import { ProviderMark } from "../ui/providerMarks";
import { type PickerTab, tabsOf } from "./accountModels";

/** What the by-hand picker shows and can change; `RunnerPickers` owns the rules for each change. */
export type CompanionBodyProps = {
  accountId: AccountId | null;
  effort: EffortChoice;
  effortOptions: ReadonlyArray<EffortChoice>;
  harness: HarnessName;
  harnesses: HarnessList | null;
  /** Whether each harness has a tab for every account; without it, for its own sign-in on this computer only. */
  isAccountShown: boolean;
  model: ModelChoice;
  onEffort: (effort: EffortChoice) => void;
  /** Choosing a model also chooses the harness and the account whose tab it was chosen in. */
  onModel: (harness: HarnessName, accountId: AccountId | null, model: ModelChoice) => void;
};

/**
 * The by-hand picker, drawn in the Companions tab's folds: a tab for each harness and each of its accounts, a search
 * field, the models of the chosen tab, and the effort as a line of stops. Two Claude subscriptions are two tabs.
 */
export function CompanionBody(props: CompanionBodyProps) {
  const { accountId, harness, harnesses, model } = props;
  const tabs = tabsOf(harnesses, props.isAccountShown, { accountId, harness });
  const [browsed, setBrowsed] = useState<{ accountId: AccountId | null; harness: HarnessName }>({ accountId, harness });
  const [query, setQuery] = useState("");
  const isCurrentTab = (tab: { accountId: AccountId | null; harness: HarnessName }) =>
    tab.harness === harness && tab.accountId === accountId;
  const isBrowsedTab = (tab: PickerTab) => tab.harness === browsed.harness && tab.accountId === browsed.accountId;
  // A browsed tab that no longer exists (an account removed meanwhile) gives way to the runner's own.
  const tab = tabs.find(isBrowsedTab) ?? tabs.find(isCurrentTab) ?? tabs[0];
  if (tab === undefined) return null;
  const hasSeveral = (name: HarnessName) => tabs.filter((candidate) => candidate.harness === name).length > 1;
  const isCurrent = isCurrentTab(tab);
  // The chosen model stays listed when its harness no longer lists it.
  const listed =
    isCurrent && !tab.models.some((option) => option.id === model)
      ? [...tab.models, { id: model, label: modelLabelOf(model, tab.models) }]
      : tab.models;
  const isEffortChosen = isCurrent && props.effortOptions.length > 1;
  const shown = modelsMatching(listed, query);
  const caption = [harnessLabels[tab.harness], hasSeveral(tab.harness) ? tab.label : null, tab.problem]
    .filter((part) => part !== null && part !== "")
    .join(" · ");
  return (
    <View style={local.inner}>
      <View accessibilityLabel="Harness and account" accessibilityRole="radiogroup" style={local.tabs}>
        {tabs.map((candidate) => {
          const isBrowsed = candidate === tab;
          const hasLabel = hasSeveral(candidate.harness);
          return (
            <Pressable
              accessibilityLabel={`${harnessLabels[candidate.harness]}${hasLabel ? `, ${candidate.label}` : ""}${candidate.problem === null ? "" : ` (${candidate.problem})`}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isBrowsed }}
              key={`${candidate.harness}:${candidate.accountId ?? ""}`}
              onPress={() => {
                setBrowsed({ accountId: candidate.accountId, harness: candidate.harness });
                setQuery("");
              }}
              style={({ pressed }) => [
                local.tab,
                hasLabel && local.tabLabelled,
                (pressed || isBrowsed) && local.tabActive,
                candidate.problem !== null && local.dimmed,
              ]}
            >
              <ProviderMark harness={candidate.harness} size={16} />
              {hasLabel && (
                <Text numberOfLines={1} style={local.tabLabel}>
                  {candidate.label}
                </Text>
              )}
              {isCurrentTab(candidate) && <View style={local.tabDot} />}
            </Pressable>
          );
        })}
      </View>
      <Text numberOfLines={1} style={local.tabsName}>
        {caption}
      </Text>
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
          <Text style={local.empty}>
            {tab.problem === "signed out"
              ? "Signed out: sign in from the Workshop's Accounts"
              : tab.models.length === 0
                ? "No models listed"
                : "No model matches"}
          </Text>
        )}
        {shown.map((option) => {
          const isChosen = isCurrent && option.id === model;
          return (
            <Pressable
              accessibilityRole="menuitem"
              key={option.id}
              onPress={() => props.onModel(tab.harness, tab.accountId, option.id)}
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
  // A harness with several accounts names each beside its mark.
  tabLabel: {
    color: colors.textSecondary,
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.xs,
    fontWeight: "600",
  },
  tabLabelled: { flexDirection: "row", gap: 5, maxWidth: 130, paddingHorizontal: 7, width: "auto" },
  tabs: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tabsName: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
});
