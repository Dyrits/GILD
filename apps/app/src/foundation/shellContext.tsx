import type { ReactNode } from "react";
import { createContext, useContext, useEffect } from "react";
import type { CompanionPickerProps } from "../editors/companionPicker";

export const SidebarShown = createContext(false);

/** Whether the sidebar shows, so a screen can leave out the links it already offers. */
export const useHasSidebar = () => useContext(SidebarShown);

export const TopBarShown = createContext(false);

/** Whether the window has a top bar, so a screen can leave out what the bar's icons already offer. */
export const useHasTopBar = () => useContext(TopBarShown);

export const QuestPanelSetter = createContext<(panel: ReactNode, title: string) => void>(() => {});

/**
 * Hands the window's frame the quest's side panel, which it shows beside the top bar's icon, spanning the window's
 * height. The panel leaves with the screen that gave it. The frame redraws without the screen, so this cannot loop.
 */
export const useQuestPanel = (panel: ReactNode, title = "Quest") => {
  const set = useContext(QuestPanelSetter);
  useEffect(() => set(panel, title));
  useEffect(() => () => set(null, "Quest"), [set]);
};

/**
 * What a Companion button asks of the window: the Companion tab of the right-hand column (beside the quest's own tab)
 * shows the picker for the button that opened it. A button registers while it is mounted, hands over its latest
 * picker state after every render, and asks to open the tab. Null where the window has no such column (a narrow one).
 */
export interface CompanionDock {
  /** Opens the column on the Companion tab for this button. */
  open: (id: string) => void;
  /** The button's latest picker state; the tab draws it. Lower ranks are chosen first when no button asked. */
  publish: (id: string, picker: CompanionPickerProps, rank: number) => void;
  register: (id: string) => void;
  unregister: (id: string) => void;
}
export const CompanionDockActions = createContext<CompanionDock | null>(null);

/** The button whose picker the open Companion tab shows, or null while the tab is not showing. */
export const CompanionTabOf = createContext<string | null>(null);
