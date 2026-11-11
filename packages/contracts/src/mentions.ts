import { Schema } from "effect";
import { mentionTokensOf } from "./workspaceEntries.ts";

// What a typed `@` in a message can name besides a workspace's files and folders: a quest, a side-quest, or a realm
// (thread-messaging, Who can message whom; CHG-0181). A mention is context only: the receiving thread decides from the
// owner's words whether to read the item or message it.

/** The kinds of thing a reference names; a side-quest is a thread beneath a quest's top thread. */
export const MentionKind = Schema.Literals(["quest", "side-quest", "realm"]);
export type MentionKind = typeof MentionKind.Type;

/** One quest, side-quest, or realm the `@` menu offers; archived quests and their side-quests are never offered. */
export const Mentionable = Schema.Struct({
  /** What the chip and the menu add after the name: a quest's realm, or a realm's folder; null for neither. */
  detail: Schema.NullOr(Schema.String),
  /** The quest's id, the side-quest's thread id, or the realm's id. */
  id: Schema.String,
  kind: MentionKind,
  /** The titles from the quest down to the side-quest itself, or the realm's name alone; the chip joins them with ›. */
  trail: Schema.Array(Schema.String),
});
export type Mentionable = typeof Mentionable.Type;

/** A reference to a quest, side-quest, or realm as the message holds it, without its leading `@`. */
export interface MentionReference {
  readonly id: string;
  readonly kind: MentionKind;
}

/**
 * The token a reference is written as in the message: `@quest:<id>`, `@side-quest:<thread id>`, or `@realm:<id>`. It is
 * one word, so it survives the `@`-word reading of file paths, and it carries the id, since titles have spaces and change.
 */
export const mentionTokenOf = (reference: MentionReference) => `@${reference.kind}:${reference.id}`;

const mentionKinds: ReadonlyArray<MentionKind> = ["quest", "side-quest", "realm"];
const referencePattern = /^(quest|side-quest|realm):([A-Za-z0-9-]+)$/;

/** The reference an `@`-word stands for, or null for a workspace path or any other word. */
export const referenceOf = (path: string): MentionReference | null => {
  const match = referencePattern.exec(path);
  const kind = mentionKinds.find((each) => each === match?.[1]);
  if (match === null || kind === undefined) return null;
  return { id: match[2] ?? "", kind };
};

/** The quest, side-quest, and realm references in a message, in order, each once. */
export const mentionReferencesOf = (text: string): ReadonlyArray<MentionReference> => {
  const seen = new Set<string>();
  return mentionTokensOf(text).flatMap((token) => {
    const reference = referenceOf(token.path);
    if (reference === null || seen.has(token.path)) return [];
    seen.add(token.path);
    return [reference];
  });
};

/** The label a chip shows: the realm's name, the quest's title, or `Quest › Side-quest`. */
export const mentionLabelOf = (mentionable: Pick<Mentionable, "trail">) => mentionable.trail.join(" › ");
