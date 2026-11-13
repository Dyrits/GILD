import { access, constants, mkdir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { downloadFile, type Fetch, fetchListings, fetchText, releasesPageUrl } from "./network.ts";
import { checksumsOf, chooseRelease, plainNotesOf } from "./releases.ts";
import { stageApp } from "./stage.ts";
import { startSwap } from "./swap.ts";
import { type CheckResult, UpdateFailure, type Updater } from "./updater.ts";

/** What the macOS updater needs from the running app and the machine; tests replace the parts that touch the system. */
export type MacUpdaterOptions = {
  readonly appVersion: string;
  readonly arch: string;
  /** The installed app, such as `/Applications/Iskios.app`. */
  readonly bundle: string;
  readonly fetchFn: Fetch;
  /** A folder of the app's own for downloads. */
  readonly folder: string;
  /** What starts the new app after the swap; a check may name its own so no real profile opens. */
  readonly opener?: string;
  readonly pid: number;
  readonly quit: () => void;
  readonly releasesUrl: string;
  readonly stage?: typeof stageApp;
  readonly swap?: typeof startSwap;
};

/**
 * Updates the installed app without a Developer ID, which Squirrel.Mac needs: downloads the release's disk image,
 * checks its SHA-512 against the release's checksums, copies the new app beside the installed one, and has a script
 * swap the two once the app has quit (app-updates, macOS).
 */
export const createMacUpdater = (options: MacUpdaterOptions): Updater => {
  const stage = options.stage ?? stageApp;
  const swap = options.swap ?? startSwap;
  let image: string | null = null;

  const requireWritableFolder = async () => {
    const folder = dirname(options.bundle);
    await access(folder, constants.W_OK).catch(() => {
      throw new UpdateFailure(
        `Iskios cannot replace itself in ${folder}: that folder is not writable.`,
        releasesPageUrl,
      );
    });
  };

  return {
    async check(report): Promise<CheckResult> {
      const listings = await fetchListings(options.fetchFn, options.releasesUrl, options.appVersion);
      const choice = chooseRelease(listings, { arch: options.arch, version: options.appVersion });
      if (choice._tag === "None") return { _tag: "Nothing", note: choice.reason };
      const { release } = choice;
      await requireWritableFolder();
      const sums = checksumsOf(await fetchText(options.fetchFn, release.sumsUrl, options.appVersion));
      const expected = sums.get(release.installer.name);
      if (expected === undefined)
        throw new UpdateFailure(`The release's checksums do not list ${release.installer.name}.`, release.pageUrl);
      // Older downloads are of no use once a newer release is found.
      await rm(options.folder, { force: true, recursive: true });
      await mkdir(options.folder, { recursive: true });
      const file = join(options.folder, release.installer.name);
      const actual = await downloadFile(options.fetchFn, release.installer.url, file, {
        appVersion: options.appVersion,
        onProgress: (percent) => report(percent, release.version),
      });
      if (actual !== expected) {
        await rm(file, { force: true });
        throw new UpdateFailure(
          `The download of ${release.installer.name} did not match its checksum and was discarded.`,
          release.pageUrl,
        );
      }
      image = file;
      return {
        _tag: "Ready",
        update: { notes: plainNotesOf(release.notes), pageUrl: release.pageUrl, version: release.version },
      };
    },

    async install() {
      if (image === null) throw new UpdateFailure("There is no downloaded update to install.");
      const installFolder = dirname(options.bundle);
      const staged = join(installFolder, `.${basename(options.bundle, ".app")}-update.app`);
      await stage(image, staged).catch((reason: unknown) => {
        throw new UpdateFailure(
          `The downloaded update could not be prepared: ${reason instanceof Error ? reason.message : String(reason)}`,
          releasesPageUrl,
        );
      });
      await swap({
        backup: join(installFolder, `.${basename(options.bundle, ".app")}-previous.app`),
        bundle: options.bundle,
        logFile: join(options.folder, "swap-failure.txt"),
        opener: options.opener ?? "/usr/bin/open",
        pid: options.pid,
        scriptFile: join(options.folder, "swap.sh"),
        staged,
      });
      options.quit();
    },
  };
};
