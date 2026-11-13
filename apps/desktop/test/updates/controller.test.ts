import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { UpdateState } from "../../../app/src/foundation/updateState.ts";
import { checkIntervalMilliseconds, UpdateController } from "../../src/updates/controller.ts";
import { type CheckResult, UpdateFailure, type Updater } from "../../src/updates/updater.ts";

const ready: CheckResult = {
  _tag: "Ready",
  update: { notes: "Breaking: reset", pageUrl: "https://example.test/r", version: "0.1.2-Prototype" },
};

/** A stand-in updater that answers from a script and counts what it was asked. */
const standIn = (answers: (() => Promise<CheckResult>)[]) => {
  const calls = { checks: 0, installs: 0 };
  const updater: Updater = {
    async check(report) {
      calls.checks++;
      report(40, "0.1.2-Prototype");
      const answer = answers.shift();
      if (answer === undefined) throw new Error("No answer left.");
      return answer();
    },
    async install() {
      calls.installs++;
    },
  };
  return { calls, updater };
};

const controllerOf = (updater: Updater | null, options: { earlierFailure?: string; settings?: object } = {}) => {
  const folder = mkdtempSync(join(tmpdir(), "iskios-updates-"));
  const settingsFile = join(folder, "updates.json");
  if (options.settings !== undefined) writeFileSync(settingsFile, JSON.stringify(options.settings));
  const timers: { run: () => void; milliseconds: number; stopped: boolean }[] = [];
  const controller = new UpdateController({
    currentVersion: "0.1.1-Prototype",
    earlierFailure: options.earlierFailure ?? null,
    now: () => 1_000,
    repeat: (run, milliseconds) => {
      const timer = { milliseconds, run, stopped: false };
      timers.push(timer);
      return () => {
        timer.stopped = true;
      };
    },
    settingsFile,
    unsupportedReason: updater === null ? "Updates apply to the installed app." : null,
    updater,
  });
  const seen: UpdateState[] = [];
  controller.subscribe((state) => seen.push(state));
  return { controller, seen, settingsFile, timers };
};

describe("checking for updates", () => {
  it("checks at start and every six hours while the app is open", async () => {
    const { calls, updater } = standIn([async () => ({ _tag: "Nothing", note: null })]);
    const { controller, timers } = controllerOf(updater);
    controller.start();
    await controller.check();
    expect(calls.checks).toBe(1);
    expect(timers.map((timer) => timer.milliseconds)).toEqual([checkIntervalMilliseconds]);
    expect(checkIntervalMilliseconds).toBe(21_600_000);
  });

  it("goes through checking and downloading to ready, keeping the notes and the time of the check", async () => {
    const { updater } = standIn([async () => ready]);
    const { controller, seen } = controllerOf(updater);
    const state = await controller.check();
    expect(seen.map((entry) => entry.status._tag)).toEqual(["Checking", "Downloading", "Ready"]);
    expect(state.status).toEqual({ _tag: "Ready", ...(ready._tag === "Ready" ? ready.update : {}) });
    expect(state.lastCheckedAt).toBe(1_000);
  });

  it("says there is nothing newer, with the reason when a newer release was unusable", async () => {
    const { updater } = standIn([async () => ({ _tag: "Nothing", note: "Release 0.1.2 has no installer." })]);
    const { controller } = controllerOf(updater);
    expect((await controller.check()).status).toEqual({ _tag: "Idle", note: "Release 0.1.2 has no installer." });
  });

  it("shows a failure with its page and tries again at the next check", async () => {
    const { updater } = standIn([
      async () => {
        throw new UpdateFailure("The download did not match.", "https://example.test/r");
      },
      async () => ({ _tag: "Nothing", note: null }),
    ]);
    const { controller } = controllerOf(updater);
    expect((await controller.check()).status).toEqual({
      _tag: "Failed",
      message: "The download did not match.",
      pageUrl: "https://example.test/r",
    });
    expect((await controller.check()).status._tag).toBe("Idle");
  });

  it("runs one check at a time", async () => {
    const { calls, updater } = standIn([async () => ready]);
    const { controller } = controllerOf(updater);
    await Promise.all([controller.check(), controller.check()]);
    expect(calls.checks).toBe(1);
  });

  it("does not check again while an update waits", async () => {
    const { calls, updater } = standIn([async () => ready]);
    const { controller } = controllerOf(updater);
    await controller.check();
    await controller.check();
    expect(calls.checks).toBe(1);
  });
});

describe("the switch", () => {
  it("asks no one while checking is off, at start or on demand", async () => {
    const { calls, updater } = standIn([]);
    const { controller, timers } = controllerOf(updater, { settings: { isEnabled: false } });
    controller.start();
    await controller.check();
    expect(calls.checks).toBe(0);
    expect(timers).toEqual([]);
    expect(controller.state().isEnabled).toBe(false);
  });

  it("is on when nothing was saved", () => {
    expect(controllerOf(standIn([]).updater).controller.state().isEnabled).toBe(true);
  });

  it("keeps the choice for the next start and stops the schedule when turned off", async () => {
    const { updater } = standIn([async () => ({ _tag: "Nothing", note: null })]);
    const { controller, settingsFile, timers } = controllerOf(updater);
    controller.start();
    await controller.check();
    await controller.setEnabled(false);
    expect(timers.every((timer) => timer.stopped)).toBe(true);
    expect(JSON.parse(readFileSync(settingsFile, "utf8"))).toMatchObject({ isEnabled: false });
  });

  it("checks at once when turned back on", async () => {
    const { calls, updater } = standIn([async () => ({ _tag: "Nothing", note: null })]);
    const { controller } = controllerOf(updater, { settings: { isEnabled: false } });
    await controller.setEnabled(true);
    expect(calls.checks).toBe(1);
  });
});

describe("installing", () => {
  it("installs only when an update is ready", async () => {
    const { calls, updater } = standIn([async () => ready]);
    const { controller } = controllerOf(updater);
    await expect(controller.install()).rejects.toThrow("no update ready");
    await controller.check();
    await controller.install();
    expect(calls.installs).toBe(1);
  });

  it("shows why an install failed and keeps running", async () => {
    const failing: Updater = {
      check: async () => ready,
      install: async () => {
        throw new UpdateFailure("The update could not be prepared.", "https://example.test/r");
      },
    };
    const { controller } = controllerOf(failing);
    await controller.check();
    await expect(controller.install()).rejects.toThrow("could not be prepared");
    expect(controller.state().status).toEqual({
      _tag: "Failed",
      message: "The update could not be prepared.",
      pageUrl: "https://example.test/r",
    });
  });
});

describe("when updating is unavailable", () => {
  it("reports why and never checks", async () => {
    const { controller, timers } = controllerOf(null);
    controller.start();
    expect((await controller.check()).status).toEqual({
      _tag: "Unsupported",
      reason: "Updates apply to the installed app.",
    });
    expect(timers).toEqual([]);
  });
});

describe("after a swap that failed", () => {
  it("shows the failure and waits for the owner instead of checking at start", () => {
    const { calls, updater } = standIn([]);
    const { controller } = controllerOf(updater, { earlierFailure: "The installed version was kept." });
    controller.start();
    expect(calls.checks).toBe(0);
    expect(controller.state().status).toMatchObject({ _tag: "Failed", message: "The installed version was kept." });
  });
});
