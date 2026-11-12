import type { ReactNode } from "react";

/** The place a dragged row is dropped at, among its siblings: before row `to`, counted before the dragged one leaves. */
export type SortableItemProps = {
  /** Draws the row, given its grip: the handle to pick the row up by, or null where dragging is not offered. */
  children: (grip: ReactNode) => ReactNode;
  /** This row's place in its list. */
  index: number;
  /** Moves the row at `from` to the place `to` has once it leaves its own. */
  onMove: (from: number, to: number) => void;
};

/** The data type a row being dragged carries, so only these rows are dropped on these rows. */
export const sortableDragType = "application/x-iskios-sortable";

/** Where a row moved from `from` lands when dropped before (`isBefore`) or after the row at `over`, or null when it stays. */
export const moveTargetOf = (from: number, over: number, isBefore: boolean): number | null => {
  const slot = isBefore ? over : over + 1;
  const to = from < slot ? slot - 1 : slot;
  return to === from ? null : to;
};
