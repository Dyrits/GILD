import { describe, expect, it } from "vitest";
import { moveTargetOf } from "../../src/ui/sortableTypes";

describe("where a dragged row lands", () => {
  it("moves a row down past the one it is dropped after", () => {
    expect(moveTargetOf(0, 2, false)).toBe(2);
  });
  it("moves a row down to just before the one it is dropped before", () => {
    expect(moveTargetOf(0, 2, true)).toBe(1);
  });
  it("moves a row up before the one it is dropped before", () => {
    expect(moveTargetOf(3, 1, true)).toBe(1);
  });
  it("moves a row up to just after the one it is dropped after", () => {
    expect(moveTargetOf(3, 1, false)).toBe(2);
  });
  it("leaves a row where it is when dropped beside itself", () => {
    expect(moveTargetOf(2, 2, true)).toBeNull();
    expect(moveTargetOf(2, 2, false)).toBeNull();
    expect(moveTargetOf(2, 3, true)).toBeNull();
    expect(moveTargetOf(2, 1, false)).toBeNull();
  });
});
