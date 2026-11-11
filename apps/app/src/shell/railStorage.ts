// What the rail remembers between launches in the browser's storage: whether it is hidden, how wide it is. A platform without storage, or one that refuses it, only loses the memory.

/** The rail's width as it opens, before the owner drags it. */
export const expandedWidth = 272;
/**
 * The widths the owner can drag the open rail between. The least keeps the longest heading, "Free Realms", on one line
 * beside its icon and add button, with room to spare for wider system fonts.
 */
const minRailWidth = 236;
const maxRailWidth = 380;

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

/** A width held between the least and the most the open rail can have. */
export const clampRailWidth = (width: number) => Math.min(maxRailWidth, Math.max(minRailWidth, Math.round(width)));

/** Reads the remembered rail width; a platform without browser storage starts at the default. */
export const readRailWidth = (): number => {
  try {
    const stored = Number(globalThis.localStorage?.getItem(widthKey));
    return Number.isFinite(stored) && stored > 0 ? clampRailWidth(stored) : expandedWidth;
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
