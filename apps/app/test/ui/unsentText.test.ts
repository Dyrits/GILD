import { describe, expect, it } from "vitest";
import { rememberUnsentText, unsentTextOf } from "../../src/ui/unsentText";

describe("unsent text", () => {
  it("returns what a box left, by the box's own name", () => {
    rememberUnsentText("thread:a", "half a thought");
    rememberUnsentText("thread:b", "another");
    expect(unsentTextOf("thread:a")).toBe("half a thought");
    expect(unsentTextOf("thread:b")).toBe("another");
  });

  it("forgets a box that was sent or emptied", () => {
    rememberUnsentText("thread:c", "typed");
    rememberUnsentText("thread:c", "");
    expect(unsentTextOf("thread:c")).toBe("");
    rememberUnsentText("thread:c", "   \n");
    expect(unsentTextOf("thread:c")).toBe("");
  });

  it("knows nothing of a box that never held text", () => {
    expect(unsentTextOf("thread:never")).toBe("");
  });
});
