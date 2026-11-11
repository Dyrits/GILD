import type { DragSourceProps, DropTargetProps } from "./questDragTypes";

/** Dragging needs the web build: elsewhere a quest row is drawn as it is. */
export function DragSource({ children }: DragSourceProps) {
  return <>{children}</>;
}

/** Dropping needs the web build: elsewhere the place is drawn as it is. */
export function DropTarget({ children }: DropTargetProps) {
  return <>{children}</>;
}
