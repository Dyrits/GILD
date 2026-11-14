import { describe, expect, it } from "vitest";
import { themeOf, themes } from "../../src/foundation/themeRules";

describe("themeOf", () => {
  it("reads a stored theme", () => {
    expect(themeOf("iskios")).toBe("iskios");
    expect(themeOf("gild")).toBe("gild");
    expect(themeOf("one")).toBe("one");
  });

  it("is Iskios when nothing or something unknown is stored", () => {
    expect(themeOf(null)).toBe("iskios");
    expect(themeOf("sepia")).toBe("iskios");
  });

  it("offers Iskios, Gild, and One", () => {
    expect(themes).toEqual(["iskios", "gild", "one"]);
  });
});
