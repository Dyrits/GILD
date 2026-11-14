import { describe, expect, it } from "vitest";
import { defaultCrestOf } from "../../src/crest/crestShapes";
import { newRealmCrestIdOf, shownCrestOf } from "../../src/realms/newRealmCrest";

describe("choosing the crest for a new realm", () => {
  it("draws from the folder's path, or from a fixed id while none is chosen", () => {
    expect(newRealmCrestIdOf("")).toBe("new-realm");
    expect(newRealmCrestIdOf("/work/app")).toBe("/work/app");
  });

  it("is the crest the menu shows, so an undesigned one is made as shown", () => {
    expect(shownCrestOf({ crest: null, path: "/work/app" })).toEqual(defaultCrestOf("/work/app"));
    expect(shownCrestOf({ crest: null, path: "" })).toEqual(defaultCrestOf("new-realm"));
  });

  it("keeps a designed crest", () => {
    const designed = { ...defaultCrestOf("other"), finish: "Sheen" as const };
    expect(shownCrestOf({ crest: designed, path: "/work/app" })).toBe(designed);
  });
});
