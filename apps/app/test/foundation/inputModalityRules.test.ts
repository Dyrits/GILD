import { describe, expect, it } from "vitest";
import { modalityAfter } from "../../src/foundation/inputModalityRules";

describe("how the owner last moved the focus", () => {
  it("is the keyboard after a key press, so a focus that follows shows the row's actions", () => {
    expect(modalityAfter("pointer", "keydown")).toBe("keyboard");
  });

  it("is the pointer after a click or a touch, so the focus a click leaves shows nothing", () => {
    expect(modalityAfter("keyboard", "pointerdown")).toBe("pointer");
    expect(modalityAfter("keyboard", "mousedown")).toBe("pointer");
  });

  it("keeps the last one for any other event", () => {
    expect(modalityAfter("keyboard", "scroll")).toBe("keyboard");
  });
});
