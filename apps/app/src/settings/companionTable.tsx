import type { HarnessList } from "@iskios/contracts";
import { type ReactNode, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { type Runner, RunnerPickers } from "../editors/runners";
import type { ServiceClient } from "../foundation/client";
import { colors, radii } from "../foundation/theme";
import { RowChevron } from "../ui/rowIcons";
import { WorkshopCompanions } from "./workshopCompanions";
import { useWorkshopTabs, type WorkshopFocus } from "./workshopTabs";

/** The chevron column's button: marked while the tab shows this table's Companion, and it closes the tab then. */
function Chevron({ focus, isOpen, onPress }: { focus: WorkshopFocus; isOpen: boolean; onPress: () => void }) {
  const tabs = useWorkshopTabs();
  const { report } = tabs;
  // After every render, so the tabs know which chevron shows and how to press it.
  useEffect(() => report(focus, isOpen, onPress));
  const isActive = tabs.isOpen && tabs.focus === focus;
  return (
    <Pressable
      accessibilityLabel="Change this Companion in the Companions tab"
      accessibilityRole="button"
      accessibilityState={{ expanded: isActive }}
      onPress={() => {
        if (isActive) return tabs.closeTab();
        tabs.setFocus(focus);
        onPress();
      }}
      style={({ pressed }) => [local.change, (pressed || isActive) && local.changeActive]}
    >
      <View style={isActive && local.turned}>
        <RowChevron tint={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

/**
 * A Companion read as a table, its rows (harness, model, and what else) beside one merged column holding a chevron.
 * The chevron opens the Companions tab beside the page on this Companion (`focus`) and is marked while the tab shows
 * it; the control is the tab's own Companion button, so the tab follows what the page holds.
 */
export function CompanionTable({
  client,
  focus,
  harnesses,
  onChange,
  rank,
  rows,
  runner,
}: {
  client: ServiceClient;
  /** Which of the page's Companions this is: the default, or a preset. */
  focus: WorkshopFocus;
  harnesses: HarnessList | null;
  /** What choosing in the tab does to the Companion held here. */
  onChange: (runner: Runner) => void;
  /** Which table's panel the tab shows when none was pressed: the lowest rank. */
  rank: number;
  rows: ReactNode;
  /** The Companion the tab's button stands for. */
  runner: Runner;
}) {
  const tabs = useWorkshopTabs();
  return (
    <View style={local.table}>
      <View style={local.rows}>{rows}</View>
      <View style={local.column}>
        <RunnerPickers
          client={client}
          dockRank={rank}
          harnesses={harnesses}
          isAccountShown={false}
          isCompact={true}
          onChange={onChange}
          // The tab's own content, the same from every table: it follows the shared focus.
          panel={
            <WorkshopCompanions
              client={client}
              focus={tabs.focus}
              key={`workshop:${tabs.focus}`}
              lastTier={tabs.lastTier}
              onFocus={tabs.setFocus}
            />
          }
          trigger={({ isOpen, onPress }) => <Chevron focus={focus} isOpen={isOpen} onPress={onPress} />}
          value={runner}
        />
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  change: { alignItems: "center", flexGrow: 1, justifyContent: "center" },
  changeActive: { backgroundColor: colors.controlActive },
  // The button is a second column of the table, as tall as its rows.
  column: { borderLeftColor: colors.border, borderLeftWidth: 1, flexDirection: "row", width: 52 },
  rows: { flex: 1 },
  table: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  // The chevron points back at the page while the tab is open.
  turned: { transform: [{ rotate: "180deg" }] },
});
