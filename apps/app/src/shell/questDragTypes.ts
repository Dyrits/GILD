import type { ReactNode } from "react";

// Dragging a quest onto a realm or the Borderlands. Only the web build (the desktop window and the phone's browser) can
// drag; other builds draw the children as they are.

/** What a dragged quest carries: its mission id, under this type. */
export const questDragType = "application/x-iskios-quest";

/** A quest row that can be picked up. */
export interface DragSourceProps {
  readonly children: ReactNode;
  /** The quest's mission id. */
  readonly missionId: string;
}

/** A place a quest can be dropped on. */
export interface DropTargetProps {
  readonly children: ReactNode;
  /** Hears the mission id of the quest dropped here. */
  readonly onDropQuest: (missionId: string) => void;
}
