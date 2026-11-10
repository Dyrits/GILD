import type { ReactNode } from "react";
import { createContext, useContext, useEffect } from "react";

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
