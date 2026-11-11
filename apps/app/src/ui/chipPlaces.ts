import {
  type Mentionable,
  type MentionKind,
  type MentionReference,
  type MentionToken,
  mentionLabelOf,
  mentionTokenOf,
  mentionTokensOf,
  referenceOf,
  type Skill,
  skillTokensOf,
  type WorkspaceEntry,
} from "@iskios/contracts";
import type { Chip } from "./chipEditorTypes";
import type { ChipKind } from "./chips";

// Where the chips of a sent message sit in its text, kept apart from the drawing so it can be checked without a screen.

/** The icon each kind of mention draws; a side-quest wears its quest's. */
export const chipKinds = { quest: "quest", realm: "realm", "side-quest": "quest" } as const satisfies Record<
  MentionKind,
  ChipKind
>;

/** The chip a quest, side-quest, or realm is as a choice in the list and in the message: its icon, label, and token. */
export const chipOfMentionable = (mentionable: Mentionable): Chip => ({
  kind: chipKinds[mentionable.kind],
  label: mentionLabelOf(mentionable),
  token: mentionTokenOf(mentionable),
});

/** Where a chip sits in a text, from its `/` or `@` to the end of its token, and what it draws. */
export interface ChipPlace {
  readonly end: number;
  readonly kind: ChipKind;
  readonly label: string;
  readonly start: number;
}

/** What a text's chips are drawn from; `mentionables` is null while the quests and realms load. */
export interface ChipSource {
  /** What each `@`-path names in the workspace; a path missing here is plain text. */
  readonly entries: ReadonlyMap<string, WorkspaceEntry["kind"]>;
  readonly mentionables: ReadonlyArray<Mentionable> | null;
  readonly skills: ReadonlyArray<Skill>;
}

/** The label of a reference: its name, or what is known of it while loading, or that it is gone. */
const labelOfReference = (reference: MentionReference, mentionables: ReadonlyArray<Mentionable> | null) => {
  // Still loading, the chip says what kind of thing it names; an archived or deleted one says it is gone.
  if (mentionables === null) return reference.kind;
  const found = mentionables.find((each) => each.kind === reference.kind && each.id === reference.id);
  return found === undefined ? `${reference.kind} no longer open` : chipOfMentionable(found).label;
};

/** The chosen names, paths, and references in a text, in order, each with the icon and label it draws as a chip. */
export const chipsOf = (text: string, source: ChipSource): ReadonlyArray<ChipPlace> =>
  [
    ...skillTokensOf(text)
      .filter((token) => source.skills.some((skill) => skill.name === token.name))
      .map((token) => ({ end: token.end, kind: "skill" as const, label: token.name, start: token.start })),
    ...mentionTokensOf(text).flatMap((token: MentionToken): ReadonlyArray<ChipPlace> => {
      const reference = referenceOf(token.path);
      if (reference !== null)
        return [
          {
            end: token.end,
            kind: chipKinds[reference.kind],
            label: labelOfReference(reference, source.mentionables),
            start: token.start,
          },
        ];
      const kind = source.entries.get(token.path);
      return kind === undefined ? [] : [{ end: token.end, kind, label: token.path, start: token.start }];
    }),
  ].sort((first, second) => first.start - second.start);
