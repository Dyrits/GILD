import type { AccountId, EffortChoice, HarnessList, HarnessName, ModelChoice } from "@iskios/contracts";
import { type ReactElement, useContext, useEffect, useId, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { modelLabelOf, runnerSummaryOf } from "../foundation/formatting";
import { CompanionDockActions, CompanionTabOf } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Fold, FoldGroup } from "../ui/fold";
import { ProviderMark } from "../ui/providerMarks";
import { CompanionBody } from "./companionBody";
import { PresetChooser } from "./presetChooser";
import type { PresetChoice } from "./presets";

/** The width of the picker's panel in a window with no right-hand column to hold it: a mini sidebar. */
const miniWidth = 288;

/** What the picker shows and can change; `RunnerPickers` owns the rules for each change. */
export type CompanionPickerProps = {
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
  /** Replaces the tab's own folds altogether, for a page whose Companions are several (the Workshop's). Keyed by what it shows. */
  panel?: ReactElement;
  /** The presets the owner has set, offered in their own card above the thread's Companion; none, and the tab has no such card. */
  presetChoice?: PresetChoice | null;
};

/**
 * The Companions tab: the presets in a card of their own when there are any, then a fold for the thread's own Companion, unfolded first, and under it what belongs to the thread alone (`extra`: its backup Companions, one fold each).
 * One fold is unfolded at a time.
 */
export function CompanionPanel({ onClose, ...props }: CompanionPickerProps & { onClose?: () => void }) {
  const { extra, panel, ...picker } = props;
  const { presetChoice = null } = picker;
  return (
    <FoldGroup initial="main">
      <View style={[local.body, panel !== undefined && local.bodyOfPanel]}>
        {onClose !== undefined && (
          <View style={local.title}>
            <Text style={local.titleText}>Companions</Text>
            <Pressable accessibilityLabel="Close the menu" accessibilityRole="button" onPress={onClose}>
              <Text style={local.titleClose}>✕</Text>
            </Pressable>
          </View>
        )}
        <ScrollView contentContainerStyle={local.stack} style={local.scroll}>
          {panel ?? (
            <>
              {presetChoice !== null && presetChoice.presets.length > 0 && (
                <PresetChooser
                  accountId={props.accountId}
                  choice={presetChoice}
                  effort={props.effort}
                  harness={props.harness}
                  harnesses={props.harnesses}
                  model={props.model}
                />
              )}
              <Fold
                harness={props.harness}
                id="main"
                summary={runnerSummaryOf(props.harnesses, props)}
                title="Companion"
              >
                <CompanionBody {...picker} />
              </Fold>
              {extra}
            </>
          )}
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
export function CompanionPicker({
  rank = 0,
  trigger,
  ...props
}: CompanionPickerProps & {
  rank?: number;
  /** Another control in place of the runner button, such as a card's "Change"; it opens and closes the same tab. */
  trigger?: (control: { isOpen: boolean; onPress: () => void }) => ReactElement;
}) {
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
  const press = () => (dock === null ? setIsOverlayOpen(!isOverlayOpen) : dock.open(id));
  return (
    <View style={[styles.menu, trigger !== undefined && local.triggerFrame]}>
      {trigger === undefined ? (
        <Pressable
          accessibilityLabel="Companion (model)"
          accessibilityRole="button"
          onPress={press}
          style={[styles.menuButton, local.trigger, isOpen && styles.menuButtonOpen]}
        >
          <ProviderMark harness={harness} size={14} />
          <Text numberOfLines={1} style={local.triggerText}>
            {currentLabel}
          </Text>
          {props.effort !== "default" && <Text style={local.triggerEffort}>{props.effort}</Text>}
          <Text style={styles.menuCaret}>⌄</Text>
        </Pressable>
      ) : (
        trigger({ isOpen, onPress: press })
      )}
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
  // A panel of its own starts with tabs, which sit closer to the column's.
  bodyOfPanel: { paddingTop: 6 },
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
  stack: { gap: 8 },
  title: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  titleClose: { color: colors.textMuted, fontSize: fontSizes.md, paddingHorizontal: 4 },
  titleText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
  trigger: { gap: 6 },
  triggerEffort: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  // A control of the caller's own may fill the frame it is placed in.
  triggerFrame: { flexGrow: 1 },
  triggerText: {
    color: colors.textSecondary,
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "500",
  },
});
