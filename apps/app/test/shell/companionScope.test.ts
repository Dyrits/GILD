import { describe, expect, it } from "vitest";
import { isCompanionInScope } from "../../src/shell/companionScope";

describe("scoping the Companions tab", () => {
  it("offers only Iskios's picker when Iskios fills the panel", () => {
    expect(isCompanionInScope(true, true)).toBe(true);
    expect(isCompanionInScope(false, true)).toBe(false);
  });

  it("offers both pickers when Iskios is docked", () => {
    expect(isCompanionInScope(true, false)).toBe(true);
    expect(isCompanionInScope(false, false)).toBe(true);
  });
});
