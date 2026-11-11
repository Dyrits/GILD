import { useState } from "react";
import { colors, radii } from "../foundation/theme";
import { type DragSourceProps, type DropTargetProps, questDragType } from "./questDragTypes";

// The same column a React Native view is on the web, so wrapping rows in a plain element changes no layout.
const column = {
  alignItems: "stretch",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  position: "relative",
} as const;

/** A quest row the owner can pick up and drop on a realm or the Borderlands. */
export function DragSource({ children, missionId }: DragSourceProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drag has no semantic element; the row inside stays a button.
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(questDragType, missionId);
        event.dataTransfer.effectAllowed = "move";
      }}
      style={column}
    >
      {children}
    </div>
  );
}

/** A realm or the Borderlands, ringed while a quest is dragged over it and calling `onDropQuest` when one is dropped. */
export function DropTarget({ children, onDropQuest }: DropTargetProps) {
  const [isOver, setIsOver] = useState(false);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop place has no semantic element; its rows stay buttons.
    <div
      onDragLeave={(event) => {
        // Moving between this place's own rows is not leaving it.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOver(false);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(questDragType)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }}
      onDrop={(event) => {
        setIsOver(false);
        const missionId = event.dataTransfer.getData(questDragType);
        if (missionId === "") return;
        event.preventDefault();
        onDropQuest(missionId);
      }}
      style={{
        ...column,
        borderRadius: radii.md,
        boxShadow: isOver ? `inset 0 0 0 1px ${colors.accent}` : "none",
      }}
    >
      {children}
    </div>
  );
}
