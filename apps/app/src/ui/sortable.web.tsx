import { useState } from "react";
import { colors } from "../foundation/theme";
import { moveTargetOf, type SortableItemProps, sortableDragType } from "./sortableTypes";

/** The grip's mark: two columns of dots. */
const gripGlyph = "⋮⋮";

// The same column a React Native view is on the web, so wrapping a row in a plain element changes no layout.
const column = {
  alignItems: "stretch",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  position: "relative",
} as const;

/**
 * A row of a list the owner reorders by dragging its grip: a line shows above or below the row it would land beside
 * while another is dragged over it. The row is draggable only while its grip is held, so the text fields inside it keep
 * their own selection.
 */
export function SortableItem({ children, index, onMove }: SortableItemProps) {
  const [isArmed, setIsArmed] = useState(false);
  const [edge, setEdge] = useState<"before" | "after" | null>(null);
  const grip = (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drag has no semantic element; the move buttons stay for the keyboard.
    <span
      onMouseDown={() => setIsArmed(true)}
      onMouseUp={() => setIsArmed(false)}
      style={{
        color: colors.textDim,
        cursor: "grab",
        fontSize: 13,
        lineHeight: 1,
        padding: "0 2px",
        userSelect: "none",
      }}
      title="Drag to reorder"
    >
      {gripGlyph}
    </span>
  );
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drag has no semantic element; the row inside keeps its buttons.
    <div
      draggable={isArmed}
      onDragEnd={() => setIsArmed(false)}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEdge(null);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(sortableDragType)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const box = event.currentTarget.getBoundingClientRect();
        setEdge(event.clientY < box.top + box.height / 2 ? "before" : "after");
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData(sortableDragType, String(index));
        event.dataTransfer.effectAllowed = "move";
      }}
      onDrop={(event) => {
        const from = event.dataTransfer.getData(sortableDragType);
        // From where the drop is, not from the last `dragover`'s state, which may not be drawn yet.
        const box = event.currentTarget.getBoundingClientRect();
        const isBefore = event.clientY < box.top + box.height / 2;
        setEdge(null);
        if (from === "") return;
        event.preventDefault();
        const to = moveTargetOf(Number(from), index, isBefore);
        if (to !== null) onMove(Number(from), to);
      }}
      style={{
        ...column,
        boxShadow:
          edge === "before"
            ? `0 -3px 0 -1px ${colors.accent}`
            : edge === "after"
              ? `0 3px 0 -1px ${colors.accent}`
              : "none",
      }}
    >
      {children(grip)}
    </div>
  );
}
