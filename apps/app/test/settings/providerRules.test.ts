import { describe, expect, it } from "vitest";
import { versionOf } from "../../src/settings/providerRules";

describe("reading a harness version label", () => {
  it("extracts a version while retaining its prefix and release suffixes", () => {
    expect(versionOf({ version: "Claude Code 2.1.325" })).toBe("2.1.325");
    expect(versionOf({ version: "OpenCode v2.2.0-beta.1+local" })).toBe("v2.2.0-beta.1+local");
  });

  it("retains an unrecognized report or a missing version", () => {
    expect(versionOf({ version: "development" })).toBe("development");
    expect(versionOf({ version: null })).toBeNull();
  });
});
