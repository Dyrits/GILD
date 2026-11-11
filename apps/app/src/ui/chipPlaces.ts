import {
  type Mentionable,
  type MentionToken,
  mentionLabelOf,
  mentionTokensOf,
  referenceOf,
  type Skill,
  skillTokensOf,
  type WorkspaceEntry,
} from "@iskios/contracts";
import type { ChipKind } from "./chips";

// Where the chips of a sent message sit in its text, kept apart from the drawing so it can be checked without a screen.

/** Where a chip sits in a text, from its `/` or `@` to the end of its token, and what it draws. */
export interface ChipPlace {
  readonly end: number;
  readonly kind: ChipKind;
  readonly label: string;
  readonly start: number;
}

/** The chosen names, paths, and references in a text, in order, each with the icon and label it draws as a chip. */
export const chipsOf = (
  text: string,
  skills: ReadonlyArray<Skill>,
  mentions: ReadonlyMap<string, WorkspaceEntry["kind"]>,
  mentionables: ReadonlyArray<Mentionable> | null,
): ReadonlyArray<ChipPlace> =>
  [
    ...skillTokensOf(text)
      .filter((token) => skills.some((skill) => skill.name === token.name))
      .map((token) => ({ end: token.end, kind: "skill" as const, label: token.name, start: token.start })),
    ...mentionTokensOf(text).flatMap((token: MentionToken): ReadonlyArray<ChipPlace> => {
      const reference = referenceOf(token.path);
      if (reference !== null) {
        const kind: ChipKind = reference.kind === "realm" ? "realm" : "quest";
        // Still loading, the chip says what kind of thing it names; an archived or deleted one says it is gone.
        const found = mentionables?.find((each) => each.kind === reference.kind && each.id === reference.id);
        const label =
          found !== undefined
            ? mentionLabelOf(found)
            : mentionables === null
              ? reference.kind
              : `${reference.kind} no longer open`;
        return [{ end: token.end, kind, label, start: token.start }];
      }
      const kind = mentions.get(token.path);
      return kind === undefined ? [] : [{ end: token.end, kind, label: token.path, start: token.start }];
    }),
  ].sort((first, second) => first.start - second.start);
