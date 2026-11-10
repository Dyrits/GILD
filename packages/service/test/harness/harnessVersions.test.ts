import { describe, expect, it } from "@effect/vitest";
import { isNewerVersion, updateOf, versionOf } from "../../src/harness/harnessVersions.ts";

describe("reading harness versions", () => {
  it("finds the number in each harness's own version text", () => {
    expect(versionOf("2.1.311 (Claude Code)")).toBe("2.1.311");
    expect(versionOf("codex-cli 0.160.1")).toBe("0.160.1");
    expect(versionOf("opencode v2.2.0")).toBe("2.2.0");
    expect(versionOf("fake")).toBeNull();
    expect(versionOf(null)).toBeNull();
  });

  it("compares versions by number, not as text", () => {
    expect(isNewerVersion("0.167.0", "0.160.1")).toBe(true);
    expect(isNewerVersion("2.1.322", "2.1.311")).toBe(true);
    expect(isNewerVersion("1.10.0", "1.9.9")).toBe(true);
    expect(isNewerVersion("2.1.311", "2.1.311")).toBe(false);
    expect(isNewerVersion("1.19.5", "2.2.0")).toBe(false);
  });

  it("offers an update only when both versions are known and the latest is higher", () => {
    expect(updateOf("2.1.311 (Claude Code)", "2.1.322")).toBe("2.1.322");
    expect(updateOf("opencode v2.2.0", "1.19.5")).toBeNull();
    expect(updateOf("2.1.311", null)).toBeNull();
    expect(updateOf(null, "2.1.322")).toBeNull();
  });
});
