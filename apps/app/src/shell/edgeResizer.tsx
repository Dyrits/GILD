import { useRef } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { clampPaneWidth } from "./railStorage";

// The pointer shows it can be dragged sideways.
const resizeCursor = { cursor: "col-resize" } as object;

/**
 * A thin strip on a pane's edge that the owner drags to widen or narrow it, between its least width and a quarter of the
 * window (the sidebar, the quest panel, and Iskios's column all work this way); the width is remembered on release.
 * `side` is the edge the strip is on: the sidebar's right edge ("end", dragging right widens it), or the left edge of
 * a pane at the window's right ("start", dragging left widens it).
 */
export function EdgeResizer({
  label,
  leastWidth,
  onChange,
  onRelease,
  side,
  width,
  windowWidth,
}: {
  label: string;
  leastWidth: number;
  onChange: (width: number) => void;
  /** Called with the width the drag ended on, to remember it. */
  onRelease: (width: number) => void;
  side: "end" | "start";
  width: number;
  windowWidth: number;
}) {
  const start = useRef(width);
  const latest = useRef(width);
  latest.current = width;
  const windowNow = useRef(windowWidth);
  windowNow.current = windowWidth;
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = latest.current;
        // No text is picked up by the pointer while the pane is dragged.
        if (typeof document !== "undefined") document.body.style.userSelect = "none";
      },
      onPanResponderMove: (_, gesture) =>
        onChange(
          clampPaneWidth(start.current + (side === "end" ? gesture.dx : -gesture.dx), windowNow.current, leastWidth),
        ),
      onPanResponderRelease: () => {
        if (typeof document !== "undefined") document.body.style.userSelect = "";
        onRelease(latest.current);
      },
      onPanResponderTerminate: () => {
        if (typeof document !== "undefined") document.body.style.userSelect = "";
      },
      onStartShouldSetPanResponder: () => true,
    }),
  ).current;
  return (
    <View
      accessibilityLabel={label}
      {...responder.panHandlers}
      style={[local.resizer, side === "end" ? { left: width - 4 } : { left: -4 }, resizeCursor]}
    />
  );
}

const local = StyleSheet.create({
  resizer: { bottom: 0, position: "absolute", top: 0, width: 8, zIndex: 3 },
});
