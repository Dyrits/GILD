import { describe, expect, it } from "vitest";
import type { UpdateState, UpdateStatus } from "../../src/foundation/updateState";
import { canCheckNow, lastCheckedTextOf, restartWarningOf, statusTextOf } from "../../src/foundation/updateText";

const stateOf = (status: UpdateStatus, options: Partial<UpdateState> = {}): UpdateState => ({
  currentVersion: "0.1.1-Prototype",
  isEnabled: true,
  lastCheckedAt: null,
  status,
  ...options,
});

describe("saying when the last check ended", () => {
  const now = 10_000_000_000;
  it("says none happened yet", () => {
    expect(lastCheckedTextOf(null, now)).toBe("Not checked yet.");
  });

  it("names the coarsest unit that is not zero", () => {
    expect(lastCheckedTextOf(now - 30_000, now)).toBe("Last checked just now.");
    expect(lastCheckedTextOf(now - 60_000, now)).toBe("Last checked 1 minute ago.");
    expect(lastCheckedTextOf(now - 5 * 60_000, now)).toBe("Last checked 5 minutes ago.");
    expect(lastCheckedTextOf(now - 3 * 3_600_000, now)).toBe("Last checked 3 hours ago.");
    expect(lastCheckedTextOf(now - 49 * 3_600_000, now)).toBe("Last checked 2 days ago.");
  });
});

describe("saying where an update stands", () => {
  it("reports each status in a line", () => {
    expect(statusTextOf(stateOf({ _tag: "Idle", note: null }))).toBe("Iskios is up to date.");
    expect(statusTextOf(stateOf({ _tag: "Idle", note: "Release 0.1.2 has no installer." }))).toBe(
      "Release 0.1.2 has no installer.",
    );
    expect(statusTextOf(stateOf({ _tag: "Checking" }))).toBe("Looking for a newer release…");
    expect(statusTextOf(stateOf({ _tag: "Downloading", percent: 40, version: "0.1.2" }))).toBe(
      "Downloading 0.1.2: 40%.",
    );
    expect(statusTextOf(stateOf({ _tag: "Ready", notes: "", pageUrl: "", version: "0.1.2" }))).toBe(
      "Iskios 0.1.2 is downloaded and ready to install.",
    );
    expect(statusTextOf(stateOf({ _tag: "Failed", message: "Could not reach github.com.", pageUrl: null }))).toBe(
      "Could not reach github.com.",
    );
  });

  it("says that checking is off before anything else", () => {
    expect(statusTextOf(stateOf({ _tag: "Idle", note: null }, { isEnabled: false }))).toContain("is off");
  });

  it("keeps saying a downloaded update is ready after looking is switched off", () => {
    const ready = stateOf({ _tag: "Ready", notes: "", pageUrl: "", version: "0.1.2" }, { isEnabled: false });
    expect(statusTextOf(ready)).toBe("Iskios 0.1.2 is downloaded and ready to install.");
  });

  it("gives the reason an installed-app-only feature is unavailable", () => {
    expect(statusTextOf(stateOf({ _tag: "Unsupported", reason: "Updates apply to the installed app." }))).toBe(
      "Updates apply to the installed app.",
    );
  });
});

describe("offering Check now", () => {
  it("is available when checking is on and nothing is under way", () => {
    expect(canCheckNow(stateOf({ _tag: "Idle", note: null }))).toBe(true);
    expect(canCheckNow(stateOf({ _tag: "Failed", message: "x", pageUrl: null }))).toBe(true);
  });

  it("is not available while checking is off, working, waiting, or unsupported", () => {
    expect(canCheckNow(stateOf({ _tag: "Idle", note: null }, { isEnabled: false }))).toBe(false);
    expect(canCheckNow(stateOf({ _tag: "Checking" }))).toBe(false);
    expect(canCheckNow(stateOf({ _tag: "Downloading", percent: 1, version: "1" }))).toBe(false);
    expect(canCheckNow(stateOf({ _tag: "Ready", notes: "", pageUrl: "", version: "1" }))).toBe(false);
    expect(canCheckNow(stateOf({ _tag: "Unsupported", reason: "x" }))).toBe(false);
  });
});

describe("warning before a restart", () => {
  it("names the version and what a restart costs", () => {
    expect(restartWarningOf("0.1.2-Prototype")).toContain("0.1.2-Prototype");
    expect(restartWarningOf("0.1.2-Prototype")).toContain("Turns still running stop");
  });
});
