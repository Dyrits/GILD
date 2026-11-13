import { describe, expect, it } from "vitest";
import { compareVersions, isPrerelease, parseVersion } from "../../src/updates/versions.ts";

const version = (text: string) => {
  const parsed = parseVersion(text);
  if (parsed === null) throw new Error(`Not a version: ${text}`);
  return parsed;
};

describe("reading versions", () => {
  it("reads a release tag with or without a leading v", () => {
    expect(version("v0.1.1-Prototype")).toEqual(version("0.1.1-Prototype"));
    expect(version("0.1.1-Prototype").prerelease).toEqual(["Prototype"]);
  });

  it("refuses text that is not a version", () => {
    expect(parseVersion("latest")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
  });
});

describe("comparing versions", () => {
  it("orders by major, minor, then patch", () => {
    expect(compareVersions(version("0.1.1"), version("0.1.2"))).toBe(-1);
    expect(compareVersions(version("0.2.0"), version("0.1.9"))).toBe(1);
    expect(compareVersions(version("1.0.0"), version("1.0.0"))).toBe(0);
  });

  it("ranks a prerelease below its release", () => {
    expect(compareVersions(version("1.0.0-Prototype"), version("1.0.0"))).toBe(-1);
    expect(compareVersions(version("1.0.0"), version("1.0.0-Prototype"))).toBe(1);
  });

  it("orders prerelease identifiers numbers first, then as text", () => {
    expect(compareVersions(version("1.0.0-beta.2"), version("1.0.0-beta.10"))).toBe(-1);
    expect(compareVersions(version("1.0.0-1"), version("1.0.0-alpha"))).toBe(-1);
    expect(compareVersions(version("1.0.0-beta"), version("1.0.0-beta.1"))).toBe(-1);
  });

  it("finds a later patch of the same prerelease name newer", () => {
    expect(compareVersions(version("0.1.1-Prototype"), version("0.1.2-Prototype"))).toBe(-1);
  });
});

describe("naming a channel", () => {
  it("tells a prerelease from a stable version", () => {
    expect(isPrerelease(version("0.1.1-Prototype"))).toBe(true);
    expect(isPrerelease(version("1.0.0"))).toBe(false);
  });
});
