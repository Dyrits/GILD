import { Schema } from "effect";

// What a typed `@` in a message can name inside a workspace.

/** A file or folder of a workspace; the path is relative to the workspace and a folder's ends with a slash. */
export const WorkspaceEntry = Schema.Struct({
  kind: Schema.Literals(["file", "folder"]),
  path: Schema.String,
});
export type WorkspaceEntry = typeof WorkspaceEntry.Type;

/** An `@`-path in a message: its position in the text, starting at the `@`, and the path without it. */
export interface MentionToken {
  readonly end: number;
  readonly path: string;
  readonly start: number;
}

/** The `@`-paths in a message: an `@` starting a word, then a path up to a space; punctuation closing a sentence is not part of it. */
export const mentionTokensOf = (text: string): ReadonlyArray<MentionToken> =>
  Array.from(text.matchAll(/(^|\s)@(\S*[^\s.,;:!?)\]'"])/g), (match) => {
    const path = match[2] ?? "";
    const start = (match.index ?? 0) + (match[1] ?? "").length;
    return { end: start + 1 + path.length, path, start };
  });
