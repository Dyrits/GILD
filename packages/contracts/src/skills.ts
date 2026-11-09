import { Schema } from "effect";

// Skills the owner can name in a message with a slash (tool-and-skill-loading).

/** A skill found in a skill folder: the name after the slash, what it is for, and where its instructions are. */
export const Skill = Schema.Struct({
  description: Schema.String,
  name: Schema.String,
  /** The skill's SKILL.md file. */
  path: Schema.String,
});
export type Skill = typeof Skill.Type;

/** A slash-name in a message: its position in the text and the name without the slash. */
export interface SkillToken {
  readonly end: number;
  readonly name: string;
  readonly start: number;
}

/** The slash-names in a message: a slash starting a word, then a name that ends the word, so a path such as /Users/me is not one. */
export const skillTokensOf = (text: string): ReadonlyArray<SkillToken> =>
  Array.from(text.matchAll(/(^|\s)\/([A-Za-z0-9][\w:.-]*?)(?=[.,;:!?]*(?:\s|$))/g), (match) => {
    const name = match[2] ?? "";
    const start = (match.index ?? 0) + (match[1] ?? "").length;
    return { end: start + 1 + name.length, name, start };
  });
