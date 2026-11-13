import { releasesPageUrl } from "./network.ts";
import { plainNotesOf } from "./releases.ts";
import { type CheckResult, UpdateFailure, type Updater } from "./updater.ts";

/** The notes electron-updater hands over: HTML text, a list of per-version notes, or none. */
type Notes = string | readonly { readonly note: string | null }[] | null | undefined;

const notesTextOf = (notes: Notes) =>
  typeof notes === "string" ? notes : Array.isArray(notes) ? notes.map((entry) => entry.note ?? "").join("\n") : "";

/**
 * Updates the Windows installer and the Linux AppImage through `electron-updater`, which reads the update files the
 * release workflow publishes beside the installers. Cannot be run on a Mac, so it is unverified until it is run
 * on Windows and Linux (app-updates, Windows and Linux).
 */
export const createLibraryUpdater = async (): Promise<Updater> => {
  const loaded = await import("electron-updater");
  const { autoUpdater } = loaded.default ?? loaded;
  // Nothing installs unasked: the owner presses Restart and update.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoRunAppAfterInstall = true;

  return {
    check(report) {
      return new Promise<CheckResult>((resolve, reject) => {
        let version = "";
        const finish = (settle: () => void) => {
          autoUpdater.removeAllListeners("update-available");
          autoUpdater.removeAllListeners("update-not-available");
          autoUpdater.removeAllListeners("download-progress");
          autoUpdater.removeAllListeners("update-downloaded");
          autoUpdater.removeAllListeners("error");
          settle();
        };
        autoUpdater.on("update-available", (info) => {
          version = info.version;
        });
        autoUpdater.on("update-not-available", () => finish(() => resolve({ _tag: "Nothing", note: null })));
        autoUpdater.on("download-progress", (progress) => report(Math.floor(progress.percent), version));
        autoUpdater.on("update-downloaded", (info) =>
          finish(() =>
            resolve({
              _tag: "Ready",
              update: {
                notes: plainNotesOf(notesTextOf(info.releaseNotes)),
                pageUrl: `${releasesPageUrl}/tag/${info.version}`,
                version: info.version,
              },
            }),
          ),
        );
        autoUpdater.on("error", (error) => finish(() => reject(new UpdateFailure(error.message, releasesPageUrl))));
        autoUpdater
          .checkForUpdates()
          .catch((reason: unknown) =>
            finish(() =>
              reject(new UpdateFailure(reason instanceof Error ? reason.message : String(reason), releasesPageUrl)),
            ),
          );
      });
    },

    async install() {
      autoUpdater.quitAndInstall(true, true);
    },
  };
};
