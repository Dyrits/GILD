import type { Mentionable, Skill, WorkspaceEntry } from "@iskios/contracts";
import type { Chip, Trigger } from "./chipEditorTypes";
import {
  type MentionCategory,
  type MenuKeyAction,
  type MenuRow,
  mentionMenuOf,
  menuKeyActionOf,
  selectableRowsOf,
} from "./mentionMenu";

// The list above the message box and the state it keeps between keystrokes (CHG-0181): a `/` offers skills, an `@`
// offers categories, a category's items, or the matches of every category. Kept apart from the screen so a sequence of
// typing and keys can be checked without one.

/** What the list remembers: the category opened from a bare `@`, and the line the owner moved to. */
export interface ListState {
  readonly category: MentionCategory | null;
  readonly chosen: number;
}

export const initialListState: ListState = { category: null, chosen: 0 };

/** What the list is built from. `mentions` is null where an `@` offers nothing. */
export interface ListSource {
  readonly entries: ReadonlyArray<WorkspaceEntry>;
  readonly mentionables: ReadonlyArray<Mentionable>;
  readonly mentions: { readonly hasFolder: boolean } | null;
  readonly skills: ReadonlyArray<Skill>;
  readonly trigger: Trigger | null;
}

/** The lines shown, the one the owner is on, and whether the list is a category's items under a bare `@`. */
export interface ComposerList {
  readonly highlighted: MenuRow | undefined;
  readonly isInCategory: boolean;
  readonly rows: ReadonlyArray<MenuRow>;
}

const SKILL_LIMIT = 6;

/** The skills a typed `/word` can be completed to; a name already complete offers nothing more. */
const skillRowsOf = (skills: ReadonlyArray<Skill>, partial: string): ReadonlyArray<MenuRow> =>
  skills
    .filter((skill) => skill.name !== partial && skill.name.toLowerCase().startsWith(partial.toLowerCase()))
    .slice(0, SKILL_LIMIT)
    .map(
      (skill): MenuRow => ({
        chip: { kind: "skill", label: skill.name, token: `/${skill.name}` },
        description: skill.description,
        key: skill.name,
        type: "option",
      }),
    );

/** The list for the trigger at the caret, in the state it is in. */
export const composerListOf = (source: ListSource, state: ListState): ComposerList => {
  const { trigger } = source;
  const mentioned = source.mentions === null || trigger?.character !== "@" ? null : trigger.query;
  const rows: ReadonlyArray<MenuRow> =
    trigger?.character === "/"
      ? skillRowsOf(source.skills, trigger.query)
      : mentioned === null
        ? []
        : mentionMenuOf({
            category: state.category,
            entries: source.entries,
            hasFolder: source.mentions?.hasFolder ?? false,
            mentionables: source.mentionables,
            query: mentioned,
          });
  const selectable = selectableRowsOf(rows);
  return {
    highlighted: selectable[Math.min(state.chosen, selectable.length - 1)],
    isInCategory: state.category !== null && mentioned === "",
    rows,
  };
};

/** The state after the field reports a new text: the first line is on, and a category stays only under a bare `@`. */
export const listAfterTyping = (state: ListState, trigger: Trigger | null): ListState => ({
  category: trigger?.character !== "@" || trigger.query !== "" ? null : state.category,
  chosen: 0,
});

/** What choosing a line does: a category opens, an item becomes a chip in the message. */
export const listAfterChoosing = (
  state: ListState,
  row: MenuRow,
): { readonly state: ListState; readonly chip: Chip | null } => {
  if (row.type === "option") return { chip: row.chip, state };
  if (row.type === "category") return { chip: null, state: { category: row.category, chosen: 0 } };
  return { chip: null, state };
};

/** What a key does to the list; `handled` says the field must not see it, `chip` is an item to put in the message. */
export const listAfterKey = (
  state: ListState,
  list: ComposerList,
  key: { readonly key: string; readonly shiftKey: boolean },
): { readonly state: ListState; readonly handled: boolean; readonly chip: Chip | null } => {
  const action: MenuKeyAction | null = menuKeyActionOf(key, {
    hasRows: list.highlighted !== undefined,
    isInCategory: list.isInCategory,
  });
  if (action === null) return { chip: null, handled: false, state };
  if (action.type === "back") return { chip: null, handled: true, state: { category: null, chosen: 0 } };
  if (action.type === "choose") {
    const choice = list.highlighted === undefined ? null : listAfterChoosing(state, list.highlighted);
    return { chip: choice?.chip ?? null, handled: true, state: choice?.state ?? state };
  }
  const count = selectableRowsOf(list.rows).length;
  const at = Math.min(state.chosen, count - 1);
  return {
    chip: null,
    handled: true,
    state: { ...state, chosen: (at + action.by + count) % count },
  };
};
