import { type Mentionable, mentionLabelOf, mentionTokenOf, type WorkspaceEntry } from "@iskios/contracts";
import type { Chip } from "./chipEditorTypes";
import type { ChipKind } from "./chips";

// What the list above the message box offers after a typed `@` (CHG-0181): a bare `@` shows the categories, a chosen
// category its items, and any text after the `@` the matches of every category under its heading.

/** The groups an `@` names things from. */
export type MentionCategory = "quests" | "realms" | "files";

/** Each category's heading and the icon it shows. */
export const mentionCategories = {
  files: { kind: "folder", label: "Files & Directories" },
  quests: { kind: "quest", label: "Quests" },
  realms: { kind: "realm", label: "Realms" },
} as const satisfies Record<MentionCategory, { readonly kind: ChipKind; readonly label: string }>;

/** One line of the list: a category to open, a heading over a category's matches, or an item to put in the message. */
export type MenuRow =
  | { readonly type: "category"; readonly key: string; readonly category: MentionCategory }
  | { readonly type: "heading"; readonly key: string; readonly category: MentionCategory }
  | { readonly type: "option"; readonly key: string; readonly chip: Chip; readonly description: string };

/** Lines the owner can move to and choose; headings are skipped. */
export const selectableRowsOf = (rows: ReadonlyArray<MenuRow>) => rows.filter((row) => row.type !== "heading");

/** How many items a chosen category shows, and how many each category shows among mixed matches. */
const CATEGORY_LIMIT = 12;
const MIXED_LIMIT = 5;

const questOptionOf = (mentionable: Mentionable): MenuRow => ({
  chip: {
    kind: mentionable.kind === "realm" ? "realm" : "quest",
    label: mentionLabelOf(mentionable),
    token: mentionTokenOf(mentionable),
  },
  description: mentionable.detail ?? (mentionable.kind === "realm" ? "Tied to no folder" : "Borderlands"),
  key: `${mentionable.kind}:${mentionable.id}`,
  type: "option",
});

const entryOptionOf = (entry: WorkspaceEntry): MenuRow => ({
  chip: { kind: entry.kind, label: entry.path, token: `@${entry.path}` },
  description: "",
  key: `path:${entry.path}`,
  type: "option",
});

/**
 * The list for what follows a typed `@`. With nothing typed after it: the categories, Files & Directories only when a
 * folder is linked, or the chosen category's items. With text: each category's matches under its heading, a quest
 * matching on its title or a side-quest on its path (`Quest › Side-quest`), a realm on its name, and the workspace's
 * entries as the service found them.
 */
export const mentionMenuOf = (given: {
  readonly query: string;
  readonly category: MentionCategory | null;
  readonly hasFolder: boolean;
  readonly mentionables: ReadonlyArray<Mentionable>;
  readonly entries: ReadonlyArray<WorkspaceEntry>;
}): ReadonlyArray<MenuRow> => {
  const categories: ReadonlyArray<MentionCategory> = given.hasFolder
    ? ["quests", "realms", "files"]
    : ["quests", "realms"];
  const needle = given.query.toLowerCase();
  const itemsOf = (category: MentionCategory, limit: number): ReadonlyArray<MenuRow> =>
    category === "files"
      ? given.entries
          .filter((entry) => entry.path !== given.query)
          .slice(0, limit)
          .map(entryOptionOf)
      : given.mentionables
          .filter((each) => (category === "realms") === (each.kind === "realm"))
          .filter((each) => mentionLabelOf(each).toLowerCase().includes(needle))
          .slice(0, limit)
          .map(questOptionOf);
  if (given.query === "") {
    if (given.category === null || !categories.includes(given.category))
      return categories.map((category) => ({ category, key: `category:${category}`, type: "category" }));
    return itemsOf(given.category, CATEGORY_LIMIT);
  }
  return categories.flatMap((category) => {
    const items = itemsOf(category, MIXED_LIMIT);
    return items.length === 0 ? [] : [{ category, key: `heading:${category}`, type: "heading" } as const, ...items];
  });
};

/** What a key does to the open list, or null when the key is the field's own. */
export type MenuKeyAction =
  | { readonly type: "move"; readonly by: 1 | -1 }
  | { readonly type: "choose" }
  | { readonly type: "back" };

/**
 * The list's keys: arrows move, Enter or Tab chooses (opening a category, or putting an item in the message), and
 * Backspace right after a bare `@` in a category returns to the categories instead of erasing the `@`.
 */
export const menuKeyActionOf = (
  key: { readonly key: string; readonly shiftKey: boolean },
  state: { readonly hasRows: boolean; readonly isInCategory: boolean },
): MenuKeyAction | null => {
  if (key.key === "Backspace" && state.isInCategory) return { type: "back" };
  if (!state.hasRows) return null;
  if (key.key === "ArrowDown") return { by: 1, type: "move" };
  if (key.key === "ArrowUp") return { by: -1, type: "move" };
  if (key.key === "Tab" || (key.key === "Enter" && !key.shiftKey)) return { type: "choose" };
  return null;
};
