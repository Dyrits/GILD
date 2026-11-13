import { readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { app, type BrowserWindow, ipcMain, shell } from "electron";
import type { UpdateState } from "../../../app/src/foundation/updateState.ts";
import { UpdateController } from "./controller.ts";
import { createLibraryUpdater } from "./libraryUpdater.ts";
import { createMacUpdater } from "./macUpdater.ts";
import { defaultReleasesUrl, releasesPageUrl } from "./network.ts";
import type { Updater } from "./updater.ts";

/** Only this repository's pages open from an update notice. */
const isReleasePage = (url: unknown): url is string =>
  typeof url === "string" && url.startsWith("https://github.com/Dyrits/ISKIOS/");

/**
 * The version of Iskios. A development run starts Electron on `dist/main.js`, where it finds no `package.json` and
 * reports its own version (45.x), so that run reads the desktop app's file instead.
 */
const appVersionOf = (): string => {
  if (app.isPackaged) return app.getVersion();
  try {
    const file = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const version: unknown = JSON.parse(readFileSync(file, "utf8")).version;
    return typeof version === "string" ? version : app.getVersion();
  } catch {
    return app.getVersion();
  }
};

/** The updater of this platform, or why there is none. */
const updaterOf = async (): Promise<{ reason: string | null; updater: Updater | null }> => {
  if (!app.isPackaged)
    return { reason: "Updates apply to the installed app, not to a development run.", updater: null };
  if (process.platform === "darwin") {
    // The executable sits in `<name>.app/Contents/MacOS`.
    const bundle = resolve(dirname(app.getPath("exe")), "..", "..");
    if (!bundle.endsWith(".app")) return { reason: "Iskios is not running from an app bundle.", updater: null };
    // A throwaway run (checks, tests) may name its own release list and opener; the installed app always asks GitHub.
    const isThrowaway = process.env.ISKIOS_DATA_DIR !== undefined;
    const releasesUrl = (isThrowaway ? process.env.ISKIOS_UPDATE_URL : undefined) ?? defaultReleasesUrl;
    const opener = isThrowaway ? process.env.ISKIOS_UPDATE_OPENER : undefined;
    return {
      reason: null,
      updater: createMacUpdater({
        appVersion: appVersionOf(),
        arch: process.arch,
        bundle,
        fetchFn: fetch,
        folder: join(app.getPath("userData"), "updates"),
        ...(opener === undefined ? {} : { opener }),
        pid: process.pid,
        quit: () => app.quit(),
        releasesUrl,
      }),
    };
  }
  if (process.platform === "linux" && process.env.APPIMAGE === undefined)
    return {
      reason: "Updating needs Iskios's AppImage; download the new version from the release page.",
      updater: null,
    };
  return { reason: null, updater: await createLibraryUpdater() };
};

/**
 * Starts the updates of the installed app and answers the window's requests about them. `isOwnWindow` says whether an
 * IPC call came from Iskios's own screens, so an embedded frame cannot install anything.
 */
export const setUpUpdates = async (
  window: BrowserWindow,
  isOwnWindow: (event: Electron.IpcMainInvokeEvent) => boolean,
): Promise<UpdateController> => {
  // Whatever goes wrong while choosing an updater must not stop Iskios from starting: updates are then unavailable.
  const { reason, updater } = await updaterOf().catch((error: unknown) => ({
    reason: `Updates could not start: ${error instanceof Error ? error.message : String(error)}`,
    updater: null,
  }));
  const failureFile = join(app.getPath("userData"), "updates", "swap-failure.txt");
  let earlierFailure: string | null = null;
  try {
    earlierFailure = readFileSync(failureFile, "utf8").trim() || null;
    rmSync(failureFile, { force: true });
  } catch {
    earlierFailure = null;
  }
  const controller = new UpdateController({
    currentVersion: appVersionOf(),
    earlierFailure,
    now: () => Date.now(),
    repeat: (run, milliseconds) => {
      const timer = setInterval(run, milliseconds);
      timer.unref();
      return () => clearInterval(timer);
    },
    settingsFile: join(app.getPath("userData"), "updates.json"),
    unsupportedReason: reason,
    updater,
  });
  const guard = (event: Electron.IpcMainInvokeEvent) => {
    if (!isOwnWindow(event)) throw new Error("Updates are only available in Iskios's desktop window.");
  };
  ipcMain.handle("iskios:updateState", (event) => {
    guard(event);
    return controller.state();
  });
  ipcMain.handle("iskios:updateCheck", (event) => {
    guard(event);
    return controller.check();
  });
  ipcMain.handle("iskios:updateSetEnabled", (event, isEnabled: unknown) => {
    guard(event);
    if (typeof isEnabled !== "boolean") throw new Error("The switch is on or off.");
    return controller.setEnabled(isEnabled);
  });
  ipcMain.handle("iskios:updateInstall", (event) => {
    guard(event);
    return controller.install();
  });
  ipcMain.handle("iskios:updateOpenReleasePage", (event, url: unknown) => {
    guard(event);
    return shell.openExternal(isReleasePage(url) ? url : releasesPageUrl);
  });
  controller.subscribe((state: UpdateState) => {
    if (!window.isDestroyed()) window.webContents.send("iskios:updateChanged", state);
  });
  return controller;
};
