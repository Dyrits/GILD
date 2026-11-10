/** A button's frame in window coordinates, as `measureInWindow` reports it. */
export type Frame = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** Where a menu's open list stands in the window: below its button, or above it, never past an edge. */
export type MenuPlacement = {
  readonly left: number;
  readonly minWidth: number;
  readonly maxHeight: number;
  readonly top?: number;
  readonly bottom?: number;
};

/** The tallest an open list grows before it scrolls, such as for OpenCode's many models. */
const listHeight = 320;
/** The gap between the button and its list, and between the list and the window's edge. */
const gap = 4;
const margin = 8;

/**
 * Where to draw a menu's list for a button: below it when the list fits there or there is more room below,
 * above it otherwise; at least as wide as the button and kept inside the window.
 */
export const menuPlacementOf = (
  button: Frame,
  window: { readonly width: number; readonly height: number },
  listWidth: number,
): MenuPlacement => {
  const minWidth = Math.max(listWidth, button.width);
  const left = Math.max(margin, Math.min(button.x, window.width - minWidth - margin));
  const top = button.y + button.height + gap;
  const roomBelow = window.height - top - margin;
  const roomAbove = button.y - gap - margin;
  if (roomBelow >= listHeight || roomBelow >= roomAbove) {
    return { left, maxHeight: Math.min(listHeight, roomBelow), minWidth, top };
  }
  return { bottom: window.height - button.y + gap, left, maxHeight: Math.min(listHeight, roomAbove), minWidth };
};
