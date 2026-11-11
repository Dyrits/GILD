import { describe, expect, it } from "vitest";
import { iconFileOf } from "../src/appIcon.ts";

describe("iconFileOf", () => {
  it("gives Gild's hooded figure for the Gild theme", () => {
    expect(iconFileOf("gild")).toBe("icon-gild.png");
  });

  it("gives Iskios's icon for Iskios and for anything unknown", () => {
    expect(iconFileOf("iskios")).toBe("icon.png");
    expect(iconFileOf("sepia")).toBe("icon.png");
    expect(iconFileOf(undefined)).toBe("icon.png");
  });
});
