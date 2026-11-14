import { WorkspaceId } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { shuffledCrest } from "../../src/crest/crestShapes";
import { realmLabelOf } from "../../src/realms/realmLabels";
import { comparisonOf, proposedRealmOf, recoveryAppearanceOf } from "../../src/realms/realmRecovery";

const crest = shuffledCrest(() => 0.25);
const archived = { crest, id: WorkspaceId.make("old"), name: "Old garden", path: "/work/garden" };
const proposed = { crest: shuffledCrest(() => 0.75), name: "New garden" };

describe("recovering a realm's appearance", () => {
  it("compares the folder-name fallback and the starting crest as actual proposed values", () => {
    expect(proposedRealmOf({ crest, name: "  ", path: "/work/garden/" })).toEqual({
      crest,
      name: "garden",
      path: "/work/garden/",
    });
  });
  it("lets the owner choose each column independently", () => {
    expect(recoveryAppearanceOf(archived, proposed, { crest: "old", name: "proposed" })).toEqual({
      crest,
      name: "New garden",
    });
    expect(recoveryAppearanceOf(archived, proposed, { crest: "proposed", name: "old" })).toEqual({
      crest: proposed.crest,
      name: "Old garden",
    });
  });
  it("skips equal rows even when the crest objects have a different key order", () => {
    expect(comparisonOf(archived, { crest: { ...crest, colors: { ...crest.colors } }, name: archived.name })).toEqual({
      crest: false,
      name: false,
    });
    expect(comparisonOf(archived, { crest, name: "Other" })).toEqual({ crest: false, name: true });
  });
});

describe("naming duplicate realms", () => {
  it("adds a folder hint only when active names collide", () => {
    const current = { ...archived, name: "app", path: "/client-a/app" };
    const other = { ...current, id: WorkspaceId.make("other"), path: "/client-b/app" };
    expect(realmLabelOf(current, [current])).toBe("app");
    expect(realmLabelOf(current, [current, other])).toBe("app · client-a");
    expect(realmLabelOf({ ...current, path: null }, [current, other])).toBe("app");
  });
});
