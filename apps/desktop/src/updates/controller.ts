import type { UpdateState, UpdateStatus } from "../../../app/src/foundation/updateState.ts";
import { releasesPageUrl } from "./network.ts";
import { readUpdateSettings, writeUpdateSettings } from "./store.ts";
import { UpdateFailure, type Updater } from "./updater.ts";

/** How often a running app looks for a new release. */
export const checkIntervalMilliseconds = 6 * 60 * 60 * 1000;

/** What the controller needs from the app and the clock; tests supply their own. */
export type UpdateControllerOptions = {
  readonly currentVersion: string;
  /** What an earlier swap left behind when it could not finish; shown, and no check runs at start. */
  readonly earlierFailure: string | null;
  readonly now: () => number;
  /** Runs `run` every `milliseconds` until the returned function is called. */
  readonly repeat: (run: () => void, milliseconds: number) => () => void;
  readonly settingsFile: string;
  /** Null when this run cannot update, with the reason in `unsupportedReason`. */
  readonly unsupportedReason: string | null;
  readonly updater: Updater | null;
};

/**
 * Owns what the app knows about updates: whether checking is on, when it last checked, and where an update stands.
 * It checks at start and every six hours, never installs until asked, and reports every change to its listeners.
 */
export class UpdateController {
  private readonly listeners = new Set<(state: UpdateState) => void>();
  private settings;
  private status: UpdateStatus;
  private stopRepeating: (() => void) | null = null;
  private running: Promise<void> | null = null;

  constructor(private readonly options: UpdateControllerOptions) {
    this.settings = readUpdateSettings(options.settingsFile);
    this.status =
      options.updater === null
        ? { _tag: "Unsupported", reason: options.unsupportedReason ?? "Updates are not available here." }
        : options.earlierFailure !== null
          ? { _tag: "Failed", message: options.earlierFailure, pageUrl: releasesPageUrl }
          : { _tag: "Idle", note: null };
  }

  /** The current state, as the screens show it. */
  state(): UpdateState {
    return {
      currentVersion: this.options.currentVersion,
      isEnabled: this.settings.isEnabled,
      lastCheckedAt: this.settings.lastCheckedAt,
      status: this.status,
    };
  }

  /** Calls the listener with every new state; returns what stops it. */
  subscribe(listener: (state: UpdateState) => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** Starts the schedule: a check now, unless an earlier swap failed and the owner has yet to see it, then every six hours. */
  start() {
    if (this.options.updater === null || !this.settings.isEnabled) return;
    this.stopRepeating ??= this.options.repeat(() => void this.check(), checkIntervalMilliseconds);
    if (this.options.earlierFailure === null) void this.check();
  }

  /** Looks for a newer release now. Does nothing, and asks no one, while checking is off or an update waits. */
  check(): Promise<UpdateState> {
    const { updater } = this.options;
    const isIdle = this.status._tag === "Idle" || this.status._tag === "Failed";
    if (updater === null || !this.settings.isEnabled || !isIdle) return Promise.resolve(this.state());
    this.running ??= this.run(updater).finally(() => {
      this.running = null;
    });
    return this.running.then(() => this.state());
  }

  /** Turns checking on or off, and keeps it for the next start. Turning it on checks at once. */
  async setEnabled(isEnabled: boolean): Promise<UpdateState> {
    this.settings = { ...this.settings, isEnabled };
    writeUpdateSettings(this.options.settingsFile, this.settings);
    if (!isEnabled) {
      this.stopRepeating?.();
      this.stopRepeating = null;
      this.publish();
      return this.state();
    }
    this.stopRepeating ??=
      this.options.updater === null ? null : this.options.repeat(() => void this.check(), checkIntervalMilliseconds);
    this.publish();
    return this.check();
  }

  /** Quits the app and starts the downloaded version. Refused unless an update is ready. */
  async install(): Promise<void> {
    const { updater } = this.options;
    if (updater === null || this.status._tag !== "Ready") throw new Error("There is no update ready to install.");
    const ready = this.status;
    await updater.install().catch((reason: unknown) => {
      this.status = failureOf(reason, ready.pageUrl);
      this.publish();
      throw reason;
    });
  }

  private async run(updater: Updater) {
    this.status = { _tag: "Checking" };
    this.publish();
    try {
      const result = await updater.check((percent, version) => {
        this.status = { _tag: "Downloading", percent, version };
        this.publish();
      });
      this.status = result._tag === "Ready" ? { _tag: "Ready", ...result.update } : { _tag: "Idle", note: result.note };
    } catch (reason) {
      this.status = failureOf(reason, null);
    }
    this.settings = { ...this.settings, lastCheckedAt: this.options.now() };
    writeUpdateSettings(this.options.settingsFile, this.settings);
    this.publish();
  }

  private publish() {
    const state = this.state();
    for (const listener of this.listeners) listener(state);
  }
}

/** A failure as the Updates section shows it: the message, and the page to download by hand when there is one. */
const failureOf = (reason: unknown, fallbackPage: string | null): UpdateStatus => ({
  _tag: "Failed",
  message: reason instanceof Error ? reason.message : String(reason),
  pageUrl: reason instanceof UpdateFailure ? (reason.pageUrl ?? fallbackPage) : fallbackPage,
});
