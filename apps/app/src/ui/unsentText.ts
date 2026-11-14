// What the owner has typed in a message box and not yet sent. A box lives only while its screen is open, so leaving for
// the Workshop or another page would drop the text; this keeps it, under the box's own name, until it is sent or emptied.
// It is held in memory only: closing the window, or reloading it, forgets it.

const unsent = new Map<string, string>();

/** The text left in the box with this name, or an empty string. */
export const unsentTextOf = (key: string): string => unsent.get(key) ?? "";

/** Keeps the box's text under its name; a box left blank keeps nothing. */
export const rememberUnsentText = (key: string, text: string) => {
  if (text.trim() === "") unsent.delete(key);
  else unsent.set(key, text);
};
