import type { SortableItemProps } from "./sortableTypes";

/** Dragging needs the web build: elsewhere a row is drawn without a grip, and the list's move buttons stay. */
export function SortableItem({ children }: SortableItemProps) {
  return <>{children(null)}</>;
}
