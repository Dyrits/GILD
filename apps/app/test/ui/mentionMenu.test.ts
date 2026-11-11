import type { Mentionable, WorkspaceEntry } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { chipsOf } from "../../src/ui/chipPlaces";
import { type MenuRow, mentionMenuOf, menuKeyActionOf, selectableRowsOf } from "../../src/ui/mentionMenu";

const mentionables: ReadonlyArray<Mentionable> = [
  { detail: "Iskios", id: "q1", kind: "quest", trail: ["Fix login"] },
  { detail: "Iskios", id: "t1", kind: "side-quest", trail: ["Fix login", "Write tests"] },
  { detail: null, id: "q2", kind: "quest", trail: ["Read my emails"] },
  { detail: "/code/iskios", id: "r1", kind: "realm", trail: ["Iskios"] },
];
const entries: ReadonlyArray<WorkspaceEntry> = [
  { kind: "folder", path: "src/" },
  { kind: "file", path: "login.ts" },
];

const labelsOf = (rows: ReadonlyArray<MenuRow>) =>
  rows.map((row) => (row.type === "option" ? row.chip.label : `${row.type}:${row.category}`));

describe("offering what an @ names", () => {
  it("shows the three categories for a bare @ when a folder is linked", () => {
    expect(labelsOf(mentionMenuOf({ category: null, entries, hasFolder: true, mentionables, query: "" }))).toEqual([
      "category:quests",
      "category:realms",
      "category:files",
    ]);
  });

  it("leaves out Files & Directories when no folder is linked", () => {
    expect(labelsOf(mentionMenuOf({ category: null, entries, hasFolder: false, mentionables, query: "" }))).toEqual([
      "category:quests",
      "category:realms",
    ]);
  });

  it("lists a chosen category's items, side-quests as Quest › Side-quest", () => {
    expect(labelsOf(mentionMenuOf({ category: "quests", entries, hasFolder: true, mentionables, query: "" }))).toEqual([
      "Fix login",
      "Fix login › Write tests",
      "Read my emails",
    ]);
    expect(labelsOf(mentionMenuOf({ category: "files", entries, hasFolder: true, mentionables, query: "" }))).toEqual([
      "src/",
      "login.ts",
    ]);
  });

  it("mixes every category's matches under its heading once text follows the @", () => {
    const rows = mentionMenuOf({ category: "realms", entries, hasFolder: true, mentionables, query: "log" });
    expect(labelsOf(rows)).toEqual([
      "heading:quests",
      "Fix login",
      "Fix login › Write tests",
      "heading:files",
      "src/",
      "login.ts",
    ]);
    expect(selectableRowsOf(rows).every((row) => row.type === "option")).toBe(true);
  });

  it("writes a quest, side-quest, or realm as a one-word token with its id and shows its name", () => {
    const rows = mentionMenuOf({ category: null, entries: [], hasFolder: false, mentionables, query: "is" });
    const chips = rows.flatMap((row) => (row.type === "option" ? [row.chip] : []));
    expect(chips).toContainEqual({ kind: "realm", label: "Iskios", token: "@realm:r1" });
    const side = mentionMenuOf({ category: "quests", entries: [], hasFolder: false, mentionables, query: "" })[1];
    expect(side?.type === "option" ? side.chip : null).toEqual({
      kind: "quest",
      label: "Fix login › Write tests",
      token: "@side-quest:t1",
    });
  });
});

describe("moving through the @ list with the keys", () => {
  it("returns to the categories on Backspace right after a bare @ in a category", () => {
    expect(menuKeyActionOf({ key: "Backspace", shiftKey: false }, { hasRows: true, isInCategory: true })).toEqual({
      type: "back",
    });
    expect(menuKeyActionOf({ key: "Backspace", shiftKey: false }, { hasRows: true, isInCategory: false })).toBeNull();
  });

  it("moves with the arrows and chooses with Enter or Tab, leaving Shift+Enter to the field", () => {
    const state = { hasRows: true, isInCategory: false };
    expect(menuKeyActionOf({ key: "ArrowDown", shiftKey: false }, state)).toEqual({ by: 1, type: "move" });
    expect(menuKeyActionOf({ key: "ArrowUp", shiftKey: false }, state)).toEqual({ by: -1, type: "move" });
    expect(menuKeyActionOf({ key: "Enter", shiftKey: false }, state)).toEqual({ type: "choose" });
    expect(menuKeyActionOf({ key: "Tab", shiftKey: false }, state)).toEqual({ type: "choose" });
    expect(menuKeyActionOf({ key: "Enter", shiftKey: true }, state)).toBeNull();
    expect(menuKeyActionOf({ key: "Enter", shiftKey: false }, { hasRows: false, isInCategory: false })).toBeNull();
  });
});

describe("drawing the references of a sent message as chips", () => {
  it("shows a quest, side-quest, and realm by name and keeps file paths as before", () => {
    const text = "See @quest:q1, @side-quest:t1 in @realm:r1 and @src/";
    const chips = chipsOf(text, [], new Map([["src/", "folder"]]), mentionables);
    expect(chips.map((chip) => [chip.kind, chip.label])).toEqual([
      ["quest", "Fix login"],
      ["quest", "Fix login › Write tests"],
      ["realm", "Iskios"],
      ["folder", "src/"],
    ]);
    expect(text.slice(chips[0]?.start, chips[0]?.end)).toBe("@quest:q1");
  });

  it("says a quest no longer open is gone, and only its kind while the list loads", () => {
    expect(chipsOf("@quest:gone", [], new Map(), mentionables).map((chip) => chip.label)).toEqual([
      "quest no longer open",
    ]);
    expect(chipsOf("@quest:q1", [], new Map(), null).map((chip) => chip.label)).toEqual(["quest"]);
  });
});
