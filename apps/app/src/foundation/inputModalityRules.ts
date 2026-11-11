/** How the owner last moved around the window: by keyboard, or by pointer (mouse, pen, or touch). */
export type InputModality = "keyboard" | "pointer";

/** The modality after an event: a key press means the keyboard, a click or touch the pointer, anything else keeps it. */
export const modalityAfter = (current: InputModality, eventType: string): InputModality =>
  eventType === "keydown"
    ? "keyboard"
    : eventType === "pointerdown" || eventType === "mousedown" || eventType === "touchstart"
      ? "pointer"
      : current;
