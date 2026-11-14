// What the owner has typed in a message box and not yet sent. A box lives only while its screen is open, so leaving for
// the Workshop or another page would drop the text; this keeps it, under the box's own name, until it is sent or emptied.
// It is held in memory only: closing the window, or reloading it, forgets it.

const unsent = new Map<string, string>();
const sentListeners = new Map<string, Set<(sent: string) => void>>();

/** The text left in the box with this name, or an empty string. */
export const unsentTextOf = (key: string): string => unsent.get(key) ?? "";

/** Keeps the box's text under its name; a box left blank keeps nothing. */
export const rememberUnsentText = (key: string, text: string) => {
  if (text.trim() === "") unsent.delete(key);
  else unsent.set(key, text);
};

/** Whether a box's text is the text that was sent, ignoring surrounding space: other text was typed since. */
export const isSentText = (text: string, sent: string) => text.trim() === sent.trim();

/**
 * Forgets the box's text once it was sent, whether or not the box is still open (CHG-0269), and tells the boxes open
 * under its name (`listenForSentText`). Text that differs from what was sent was typed after the send started, so it stays.
 */
export const forgetSentText = (key: string, sent: string) => {
  if (isSentText(unsent.get(key) ?? "", sent)) unsent.delete(key);
  for (const listener of sentListeners.get(key) ?? []) listener(sent);
};

/**
 * Hears each text sent from a box with this name, so a box reopened while its send was pending can empty itself once
 * the send succeeds. Returns the function that stops listening.
 */
export const listenForSentText = (key: string, listener: (sent: string) => void) => {
  const listeners = sentListeners.get(key) ?? new Set();
  sentListeners.set(key, listeners.add(listener));
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) sentListeners.delete(key);
  };
};
