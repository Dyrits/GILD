// What the rail remembers between launches in the browser's storage: whether it is hidden, how wide it is. A platform without storage, or one that refuses it, only loses the memory.

/** The rail's width as it opens, before the owner drags it. */
export const expandedWidth = 288;
/**
 * The widths the owner can drag the open rail between. The least keeps the longest heading, "Borderlands", whole on one
 * line beside its icon, its chevron, and its two hover buttons (measured at 274 px in the web build, CHG-0163), with
 * room to spare for wider system fonts.
 */
export const minRailWidth = 284;
/** The most the open rail can have: a quarter of the window, so the conversation and the right panel stay usable. */
const maxRailShare = 0.25;

/** The key under which the browser remembers whether the sidebar is hidden. */
const hiddenKey = "iskios:sidebar-hidden";

/** Reads whether the sidebar is hidden; a platform without browser storage starts with it shown. */
export const readHidden = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(hiddenKey) === "1";
  } catch {
    return false;
  }
};

/** Remembers whether the sidebar is hidden where the platform allows; a refusal only loses the memory. */
export const rememberHidden = (isHidden: boolean) => {
  try {
    globalThis.localStorage?.setItem(hiddenKey, isHidden ? "1" : "0");
  } catch {}
};

/** The key under which the browser remembers how wide the open rail is. */
const widthKey = "iskios:sidebar-width";

/**
 * A width held between a pane's least and the most it can have in a window this wide: at most a quarter of the window,
 * never less than the least width, which wins on a window too narrow for its quarter to reach it. The sidebar, the quest
 * panel, and Iskios's column each have their own least; none goes past a quarter, so four panes can stand together.
 */
export const clampPaneWidth = (width: number, windowWidth: number, leastWidth: number) =>
  Math.max(leastWidth, Math.min(Math.floor(windowWidth * maxRailShare), Math.round(width)));

/** The rail's own bounds: the least width that keeps its longest heading whole, and a quarter of the window. */
export const clampRailWidth = (width: number, windowWidth: number) => clampPaneWidth(width, windowWidth, minRailWidth);

/** The keys under which the browser remembers how wide the quest panel and Iskios's column are. */
export const questPanelWidthKey = "iskios:quest-panel-width";
export const iskiosWidthKey = "iskios:assistant-width";

/** Reads a remembered pane width, or `fallback` (the pane's default, and its least) with none stored or no storage. */
export const readPaneWidth = (key: string, fallback: number): number => {
  try {
    const stored = Number(globalThis.localStorage?.getItem(key));
    // The window's quarter is applied where the width is used, since the window can change size after this.
    return Number.isFinite(stored) && stored > 0 ? Math.max(fallback, Math.round(stored)) : fallback;
  } catch {
    return fallback;
  }
};

/** Remembers a pane's width where the platform allows; a refusal only loses the memory. */
export const rememberPaneWidth = (key: string, width: number) => {
  try {
    globalThis.localStorage?.setItem(key, String(width));
  } catch {}
};

/** Reads the remembered rail width; a platform without browser storage starts at the default. */
export const readRailWidth = (): number => {
  try {
    const stored = Number(globalThis.localStorage?.getItem(widthKey));
    // The window's quarter is applied where the width is used, since the window can change size after this.
    return Number.isFinite(stored) && stored > 0 ? Math.max(minRailWidth, Math.round(stored)) : expandedWidth;
  } catch {
    return expandedWidth;
  }
};

/** Remembers the rail width where the platform allows; a refusal only loses the memory. */
export const rememberRailWidth = (width: number) => {
  try {
    globalThis.localStorage?.setItem(widthKey, String(width));
  } catch {}
};

/** The key under which the browser remembers whether Iskios's panel is open. */
const iskiosKey = "iskios:assistant-open";

/** Reads whether Iskios's panel is open; a platform without browser storage starts with it folded. */
export const readIskiosOpen = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(iskiosKey) === "1";
  } catch {
    return false;
  }
};

/** Remembers whether Iskios's panel is open where the platform allows; a refusal only loses the memory. */
export const rememberIskiosOpen = (isOpen: boolean) => {
  try {
    globalThis.localStorage?.setItem(iskiosKey, isOpen ? "1" : "0");
  } catch {}
};
