import { describe, expect, it } from "vitest";
import { foldedOf } from "../../src/shell/railStorage";

describe("the rail's remembered folds", () => {
  it("remembers every category the rail can fold", () => {
    expect([...foldedOf('["Realms","Quests","Rituals","Keep"]')].sort()).toEqual([
      "Keep",
      "Quests",
      "Realms",
      "Rituals",
    ]);
  });

  it("remembers a folded Rituals category", () => {
    expect(foldedOf('["Rituals"]').has("Rituals")).toBe(true);
  });

  it("folds nothing when nothing was stored", () => {
    expect(foldedOf(null).size).toBe(0);
  });

  it("folds nothing for a stored text that is not a list", () => {
    expect(foldedOf("not json").size).toBe(0);
    expect(foldedOf('{"Realms":true}').size).toBe(0);
  });

  it("leaves out a name the rail does not have", () => {
    expect([...foldedOf('["Quests","Lore","constructor"]')]).toEqual(["Quests"]);
  });
});
