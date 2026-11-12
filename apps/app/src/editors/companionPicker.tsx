import type { AccountId, EffortChoice, HarnessList, HarnessName, ModelChoice } from "@iskios/contracts";
import { type ReactElement, useContext, useEffect, useId, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { CompanionDockActions, CompanionTabOf } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, radii, round } from "../foundation/theme";
import { Fold, FoldGroup } from "../ui/fold";
import { modelsMatching } from "../ui/modelSearch";
import { Menu, Steps } from "../ui/pickers";
import { ProviderMark } from "../ui/providerMarks";

const harnessNames: ReadonlyArray<HarnessName> = ["claude", "codex", "opencode"];

/** The width of the picker's panel in a window with no right-hand column to hold it: a mini sidebar. */
const miniWidth = 288;

/** What the picker shows and can change; `RunnerPickers` owns the rules for each change. */
export interface CompanionPickerProps {
  accountId: AccountId | null;
  accountLabel: (id: AccountId | null) => string;
  accountOptions: ReadonlyArray<AccountId | null>;
  effort: EffortChoice;
  effortOptions: ReadonlyArray<EffortChoice>;
  /** A fold at the foot of the panel for what belongs to the thread alone: its backup Companions. Keyed by the thread. */
  extra?: ReactElement;
  harness: HarnessName;
  harnesses: HarnessList | null;
  isAccountChosen: boolean;
  /** Whether this is Iskios's own Companion, which the Companions tab marks with Iskios's ✦. */
  isIskios?: boolean;
  model: ModelChoice;
  onAccount: (accountId: AccountId | null) => void;
  onEffort: (effort: EffortChoice) => void;
  onModel: (harness: HarnessName, model: ModelChoice) => void;
}

/** A runner in few words: its Companion, then its effort when not the model's own. */
export const runnerSummaryOf = (
  harnesses: HarnessList | null,
  runner: { effort: EffortChoice; harness: HarnessName; model: ModelChoice },
) => {
  const models = harnesses?.harnesses.find((candidate) => candidate.name === runner.harness)?.models;
  return `${modelLabelOf(runner.model, models)}${runner.effort === "default" ? "" : ` · ${runner.effort}`}`;
};

/**
 * The picker itself: the harnesses as tabs, a search field, the chosen harness's models, and the effort as a line of
 * stops at the foot. Choosing a model keeps it open so the effort can be set next. It sizes itself to what it holds,
 * and is drawn in the Companions tab's folds, one for the thread's Companion and one for each backup.
 */
export function CompanionBody(props: Omit<CompanionPickerProps, "extra">) {
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

/**
 * The Companions tab: a fold for the thread's own Companion, unfolded first, and under it what belongs to the thread
 * alone (`extra`: its backup Companions, one fold each). One fold is unfolded at a time.
 */
export function CompanionPanel({ onClose, ...props }: CompanionPickerProps & { onClose?: () => void }) {
  const { extra, ...picker } = props;
  return (
    <FoldGroup initial="main">
      <View style={local.body}>
        {onClose !== undefined && (
          <View style={local.title}>
            <Text style={local.titleText}>Companions</Text>
            <Pressable accessibilityLabel="Close the menu" accessibilityRole="button" onPress={onClose}>
              <Text style={local.titleClose}>✕</Text>
            </Pressable>
          </View>
        )}
        <ScrollView contentContainerStyle={local.stack} style={local.scroll}>
          <Fold harness={props.harness} id="main" summary={runnerSummaryOf(props.harnesses, props)} title="Companion">
            <CompanionBody {...picker} />
          </Fold>
          {extra}
        </ScrollView>
      </View>
    </FoldGroup>
  );
}

/**
 * One button for a whole runner, as in a composer: the harness's logo, the Companion, and the effort. In a window with
 * a right-hand column it opens that column on its Companion tab, beside the quest's tab, and hands it the picker's
 * state; in a narrow window, with no such column, it opens the picker as a panel over the window's right edge.
 */
export function CompanionPicker({ rank = 0, ...props }: CompanionPickerProps & { rank?: number }) {
  const { harness, harnesses, model } = props;
  const id = useId();
  const dock = useContext(CompanionDockActions);
  const shownFor = useContext(CompanionTabOf);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const { publish, register, unregister } = dock ?? {};
  useEffect(() => {
    register?.(id);
    return () => unregister?.(id);
  }, [id, register, unregister]);
  // After every render, so the tab shows the runner as it is now.
  useEffect(() => publish?.(id, props, rank));
  const isOpen = dock === null ? isOverlayOpen : shownFor === id;
  const currentLabel = modelLabelOf(
    model,
    harnesses?.harnesses.find((candidate) => candidate.name === harness)?.models,
  );
  return (
    <View style={styles.menu}>
      <Pressable
        accessibilityLabel="Companion (model)"
        accessibilityRole="button"
        onPress={() => (dock === null ? setIsOverlayOpen(!isOverlayOpen) : dock.open(id))}
        style={[styles.menuButton, local.trigger, isOpen && styles.menuButtonOpen]}
      >
        <ProviderMark harness={harness} size={14} />
        <Text numberOfLines={1} style={local.triggerText}>
          {currentLabel}
        </Text>
        {props.effort !== "default" && <Text style={local.triggerEffort}>{props.effort}</Text>}
        <Text style={styles.menuCaret}>⌄</Text>
      </Pressable>
      {dock === null && (
        <Modal animationType="none" onRequestClose={() => setIsOverlayOpen(false)} transparent visible={isOverlayOpen}>
          <Pressable
            accessibilityLabel="Close the menu"
            onPress={() => setIsOverlayOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={local.overlay}>
            <CompanionPanel {...props} onClose={() => setIsOverlayOpen(false)} />
          </View>
        </Modal>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  body: { backgroundColor: colors.page, flex: 1, gap: 8, padding: 12 },
  dimmed: { opacity: 0.45 },
  empty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md, padding: 10 },
  footer: { borderColor: colors.border, borderTopWidth: 1, gap: 4, paddingTop: 8 },
  footerName: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
  inner: { gap: 8 },
  itemHovered: { backgroundColor: colors.controlHover },
  // The whole list shows, and a long one (OpenCode's) scrolls inside its own height.
  list: { flexGrow: 0, maxHeight: 320 },
  // A narrow window's stand-in for the column: a panel over the right edge, below the top bar.
  overlay: {
    borderColor: colors.border,
    borderLeftWidth: 1,
    bottom: 0,
    position: "absolute",
    right: 0,
    top: 40,
    width: miniWidth,
  },
  scroll: { flex: 1 },
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
  stack: { gap: 8 },
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
  title: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  titleClose: { color: colors.textMuted, fontSize: fontSizes.md, paddingHorizontal: 4 },
  titleText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
  trigger: { gap: 6 },
  triggerEffort: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  triggerText: {
    color: colors.textSecondary,
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "500",
  },
});
