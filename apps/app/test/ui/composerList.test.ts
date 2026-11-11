import type { Mentionable, Skill, WorkspaceEntry } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import {
  composerListOf,
  initialListState,
  type ListSource,
  type ListState,
  listAfterKey,
  listAfterTyping,
} from "../../src/ui/composerList";

const skills: ReadonlyArray<Skill> = [
  { description: "Design a module", name: "architect" } as Skill,
  { description: "Review a change", name: "review" } as Skill,
  { description: "Architecture audit", name: "architecture" } as Skill,
];
const mentionables: ReadonlyArray<Mentionable> = [
  { detail: "Iskios", id: "q1", kind: "quest", trail: ["Fix login"] },
  { detail: "/code/iskios", id: "r1", kind: "realm", trail: ["Iskios"] },
];
const entries: ReadonlyArray<WorkspaceEntry> = [{ kind: "folder", path: "src/" }];

const source = (trigger: ListSource["trigger"], hasMentions = true): ListSource => ({
  entries,
  mentionables,
  mentions: hasMentions ? { hasFolder: true } : null,
  skills,
  trigger,
});
const typed = (character: "/" | "@", query = ""): ListSource["trigger"] => ({ character, query });
const labelsOf = (rows: ReturnType<typeof composerListOf>["rows"]) =>
  rows.map((row) => (row.type === "option" ? row.chip.label : `${row.type}:${row.category}`));
const press = (state: ListState, list: ReturnType<typeof composerListOf>, key: string, shiftKey = false) =>
  listAfterKey(state, list, { key, shiftKey });

describe("the / list", () => {
  it("offers the skills a typed word can be completed to, at most six", () => {
    expect(labelsOf(composerListOf(source(typed("/", "arch")), initialListState).rows)).toEqual([
      "architect",
      "architecture",
    ]);
    expect(composerListOf(source(typed("/")), initialListState).rows).toHaveLength(3);
  });

  it("offers nothing more for a name already complete, and works without @ mentions", () => {
    expect(composerListOf(source(typed("/", "review"), false), initialListState).rows).toEqual([]);
    expect(composerListOf(source(typed("/", "rev"), false), initialListState).rows).toHaveLength(1);
  });

  it("offers nothing for an @ where @ names nothing, or with no trigger", () => {
    expect(composerListOf(source(typed("@"), false), initialListState).rows).toEqual([]);
    expect(composerListOf(source(null), initialListState).rows).toEqual([]);
  });
});

describe("the @ list across keystrokes", () => {
  it("opens a category with Enter, shows its items, and returns on Backspace", () => {
    const bare = source(typed("@"));
    const categories = composerListOf(bare, initialListState);
    expect(labelsOf(categories.rows)).toEqual(["category:quests", "category:realms", "category:files"]);
    const opened = press(initialListState, categories, "Enter");
    expect(opened.handled).toBe(true);
    expect(opened.chip).toBeNull();
    expect(opened.state).toEqual({ category: "quests", chosen: 0 });
    const inside = composerListOf(bare, opened.state);
    expect(inside.isInCategory).toBe(true);
    expect(labelsOf(inside.rows)).toEqual(["Fix login"]);
    const back = press(opened.state, inside, "Backspace");
    expect(back).toMatchObject({ chip: null, handled: true, state: { category: null, chosen: 0 } });
  });

  it("chooses an item with Tab and hands back its chip", () => {
    const state: ListState = { category: "realms", chosen: 0 };
    const chosen = press(state, composerListOf(source(typed("@")), state), "Tab");
    expect(chosen.chip).toEqual({ kind: "realm", label: "Iskios", token: "@realm:r1" });
    expect(chosen.handled).toBe(true);
  });

  it("moves with the arrows, wrapping at both ends", () => {
    const list = composerListOf(source(typed("@")), initialListState);
    const down = press(initialListState, list, "ArrowDown").state;
    expect(down.chosen).toBe(1);
    expect(press({ ...down, chosen: 2 }, list, "ArrowDown").state.chosen).toBe(0);
    expect(press(initialListState, list, "ArrowUp").state.chosen).toBe(2);
  });

  it("keeps the category only under a bare @, and goes back to the first line on any typing", () => {
    const inside: ListState = { category: "files", chosen: 2 };
    expect(listAfterTyping(inside, typed("@"))).toEqual({ category: "files", chosen: 0 });
    expect(listAfterTyping(inside, typed("@", "s"))).toEqual({ category: null, chosen: 0 });
    expect(listAfterTyping(inside, typed("/"))).toEqual({ category: null, chosen: 0 });
    expect(listAfterTyping(inside, null)).toEqual({ category: null, chosen: 0 });
  });

  it("leaves Enter to the field when there is no list, and Shift+Enter always", () => {
    const none = composerListOf(source(null), initialListState);
    expect(press(initialListState, none, "Enter")).toMatchObject({ chip: null, handled: false });
    const list = composerListOf(source(typed("@")), initialListState);
    expect(press(initialListState, list, "Enter", true).handled).toBe(false);
  });
});
