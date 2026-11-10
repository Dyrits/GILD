// What the rail remembers between launches in the browser's storage: whether it is collapsed, how wide it is, and which of its
// categories are folded. A platform without storage, or one that refuses it, only loses the memory.

/** The rail's width as it opens, before the owner drags it. */
export const expandedWidth = 220;
/** The widths the owner can drag the open rail between. */
const minRailWidth = 200;
const maxRailWidth = 380;

/** The key under which the browser remembers whether the rail is collapsed. */
const collapsedKey = "gild:sidebar-collapsed";

/** Reads the remembered rail state; a platform without browser storage starts expanded. */
export const readCollapsed = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(collapsedKey) === "1";
  } catch {
    return false;
  }
};

/** Remembers the rail state where the platform allows; a refusal only loses the memory. */
export const rememberCollapsed = (isCollapsed: boolean) => {
  try {
    globalThis.localStorage?.setItem(collapsedKey, isCollapsed ? "1" : "0");
  } catch {}
};

/** The key under which the browser remembers how wide the open rail is. */
const widthKey = "gild:sidebar-width";

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

/** The key under which the browser remembers which rail categories are folded. */
const foldedKey = "gild:sidebar-folded";

/** The rail's categories that can fold their rows away. */
const foldables = ["Realms", "Quests", "Rituals", "Keep"] as const;
/** One category that can fold. */
export type Foldable = (typeof foldables)[number];

const isFoldable = (name: unknown): name is Foldable => foldables.some((each) => each === name);

/** The folded categories a stored text names; a text that is not a list, or names none the rail has, folds nothing. */
export const foldedOf = (stored: string | null): ReadonlySet<Foldable> => {
  try {
    const names: unknown = JSON.parse(stored ?? "[]");
    return new Set(Array.isArray(names) ? names.filter(isFoldable) : []);
  } catch {
    return new Set();
  }
};

/** Reads the remembered folded categories; a platform without browser storage starts with all unfolded. */
export const readFolded = (): ReadonlySet<Foldable> => {
  try {
    return foldedOf(globalThis.localStorage?.getItem(foldedKey) ?? null);
  } catch {
    return new Set();
  }
};

/** Remembers the folded categories where the platform allows; a refusal only loses the memory. */
export const rememberFolded = (folded: ReadonlySet<Foldable>) => {
  try {
    globalThis.localStorage?.setItem(foldedKey, JSON.stringify([...folded]));
  } catch {}
};
