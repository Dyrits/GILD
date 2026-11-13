import type { TierName } from "@iskios/contracts";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

/** What the Workshop's Companions tab shows: the default Companion, or one of the presets. */
export type WorkshopFocus = "Default" | TierName;

interface WorkshopTabs {
  /** Closes the Companions tab, from whichever of the page's tables it was opened by. */
  closeTab: () => void;
  focus: WorkshopFocus;
  /** Whether the Companions tab shows one of the page's Companions. */
  isOpen: boolean;
  /** The preset last shown, which the Presets tab returns to. */
  lastTier: TierName;
  /** Each table's chevron tells whether the tab shows it, and how it is pressed. */
  report: (focus: WorkshopFocus, isOpen: boolean, press: () => void) => void;
  setFocus: (focus: WorkshopFocus) => void;
}

const WorkshopTabsContext = createContext<WorkshopTabs>({
  closeTab: () => {},
  focus: "Default",
  isOpen: false,
  lastTier: "Light",
  report: () => {},
  setFocus: () => {},
});

export const useWorkshopTabs = () => useContext(WorkshopTabsContext);

/**
 * Which Companion the Workshop's Companions tab shows, shared by the page's tables and the tab: the tab's own Default,
 * Light, Balanced, and Heavy tabs and the tables' chevrons all mark and move the same one.
 */
export function WorkshopTabsProvider({ children }: { children: ReactNode }) {
  const [focus, setFocusState] = useState<WorkshopFocus>("Default");
  const [lastTier, setLastTier] = useState<TierName>("Light");
  const [isOpen, setIsOpen] = useState(false);
  const presses = useRef(new Map<WorkshopFocus, { isOpen: boolean; press: () => void }>());
  const setFocus = useCallback((next: WorkshopFocus) => {
    setFocusState(next);
    if (next !== "Default") setLastTier(next);
  }, []);
  const report = useCallback((at: WorkshopFocus, isShown: boolean, press: () => void) => {
    presses.current.set(at, { isOpen: isShown, press });
    const isAnyShown = [...presses.current.values()].some((entry) => entry.isOpen);
    setIsOpen((before) => (before === isAnyShown ? before : isAnyShown));
  }, []);
  const closeTab = useCallback(() => {
    [...presses.current.values()].find((entry) => entry.isOpen)?.press();
  }, []);
  const value = useMemo(
    () => ({ closeTab, focus, isOpen, lastTier, report, setFocus }),
    [closeTab, focus, isOpen, lastTier, report, setFocus],
  );
  return <WorkshopTabsContext.Provider value={value}>{children}</WorkshopTabsContext.Provider>;
}
