import type { Ref } from "react";
import type { ChipKind } from "./chips";

// What the message box's text field offers the composer, whether it can draw chips inside its text (web) or not.

/** A skill or workspace path chosen from a list: how it reads in the message and how it shows as a chip. */
export interface Chip {
  readonly kind: ChipKind;
  readonly label: string;
  /** What the message holds in its place, such as `/architect` or `@src/`. */
  readonly token: string;
}

/** A `/` or `@` that starts a word just before the caret, with what has been typed after it. */
export interface Trigger {
  readonly character: "/" | "@";
  readonly query: string;
}

export interface ChipEditorHandle {
  clear: () => void;
  /** Puts a chip where the trigger is, in place of it. */
  insertChip: (chip: Chip) => void;
}

export interface ChipEditorProps {
  /** Hears the message as plain text, each chip as its token, and the trigger at the caret. */
  onChange: (text: string, trigger: Trigger | null) => void;
  /** Hears the files pasted or dropped on the field, where files can be; text pasted with files stays text. */
  onFiles?: (files: ReadonlyArray<File>) => void;
  /** Hears a key before the field does; answering true says it was handled. */
  onKeyDown: (key: { readonly key: string; readonly shiftKey: boolean }) => boolean;
  placeholder: string;
  ref?: Ref<ChipEditorHandle>;
}

/** The trigger a text ends with, for a field that has no caret to read. */
export const triggerOfEnd = (text: string): Trigger | null => {
  const match = /(^|\s)([/@])(\S*)$/.exec(text);
  return match === null ? null : { character: match[2] === "@" ? "@" : "/", query: match[3] ?? "" };
};
