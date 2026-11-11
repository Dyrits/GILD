// What the rail remembers between launches in the browser's storage: whether it is hidden, how wide it is. A platform without storage, or one that refuses it, only loses the memory.

/** The rail's width as it opens, before the owner drags it. */
export const expandedWidth = 288;
/**
 * The widths the owner can drag the open rail between. The least keeps the longest heading, "Borderlands", whole on one
 * line beside its icon, its chevron, and its two hover buttons (measured at 274 px in the web build, CHG-0163), with
 * room to spare for wider system fonts.
 */
const minRailWidth = 284;
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
 * A width held between the least and the most the open rail can have in a window this wide: at most a quarter of the
 * window, never less than the least width, which wins on a window too narrow for its quarter to reach it.
 */
export const clampRailWidth = (width: number, windowWidth: number) =>
  Math.max(minRailWidth, Math.min(Math.floor(windowWidth * maxRailShare), Math.round(width)));

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
