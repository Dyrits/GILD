import { describe, expect, it } from "vitest";
import { preferenceOf, schemeOf } from "../../src/foundation/colorSchemeRules";

describe("preferenceOf", () => {
  it("reads a stored choice of look", () => {
    expect(preferenceOf("light")).toBe("light");
    expect(preferenceOf("dark")).toBe("dark");
    expect(preferenceOf("system")).toBe("system");
  });

  it("follows the system when nothing or something unknown is stored", () => {
    expect(preferenceOf(null)).toBe("system");
    expect(preferenceOf("sepia")).toBe("system");
  });
});

describe("schemeOf", () => {
  it("gives the look the system asks for when the owner follows the system", () => {
    expect(schemeOf("system", "light")).toBe("light");
    expect(schemeOf("system", "dark")).toBe("dark");
  });

  it("keeps the owner's look whatever the system asks for", () => {
    expect(schemeOf("light", "dark")).toBe("light");
    expect(schemeOf("dark", "light")).toBe("dark");
  });
});
