# App updates, 2026-11-13

Starting commit: `170a43c`. Agreement: CHG-0266. Behavior: [specification](../capabilities/app-updates/specifications.md).

## Reproduce

Setup: `bun install`; the worktree's Electron binary comes from `node apps/desktop/node_modules/electron/install.js` and the same in `node_modules/electron`.

- `bun run check` and `bun run typecheck` pass.
- `bun run test` (full suite, `CI=1`): see Results.
- `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/Electron.app/Contents/MacOS/Electron node_modules/vitest/vitest.mjs run apps/desktop/test/updates apps/app/test/foundation/updateText.test.ts`: the new tests, run alone.
- `python3 documentation/verification/2026-11-10-release-workflow.py`: the release workflow's Bash steps against fake CLIs, now with the update files and `SHA512SUMS.txt` (8 scenarios pass).
- The packaged app updating itself, on throwaway data and a local stand-in for GitHub:
  1. `bun run package` (builds 0.1.1-Prototype); `ditto apps/desktop/release/mac-arm64/Iskios.app /tmp/iskios-live/Iskios-old.app`.
  2. `bun run package --arm64 --config.extraMetadata.version=0.1.2-Prototype`, as CI does for a tag; copy its `Iskios-0.1.2-Prototype-mac-arm64.dmg` aside.
  3. `bun apps/desktop/scripts/check-update.ts /tmp/iskios-live/Iskios-old.app /tmp/iskios-live/Iskios-0.1.2-Prototype-mac-arm64.dmg`, then again with `ISKIOS_CHECK_LAUNCH_SERVICES=1` so the new app starts through the real `/usr/bin/open`.

## What the new tests show (`apps/desktop/test/updates/`, `apps/app/test/foundation/updateText.test.ts`)

- Versions compare as semantic versions (a prerelease ranks below its release, numbers before words); a build with a prerelease part follows prereleases and stable releases, a stable build only stable ones; drafts are never offered; a newer release without this architecture's installer or without `SHA512SUMS.txt` is skipped for the next one, with the reason when none fits.
- The check's request carries the user agent `Iskios/<version>` and no cookie, authorization, or custom header (against a local server); with the switch off, no request is made at start, on demand, or on a schedule; the switch survives a restart and is on when nothing was saved.
- The controller checks at start and every 6 hours, runs one check at a time, goes Checking, Downloading, Ready, shows a failure with its page and tries again, installs only when an update is ready, and after an earlier failed swap shows it and waits instead of checking.
- The macOS updater against a local fake release: downloads, checks the SHA-512, and reports the notes as plain text; discards a download whose hash differs; refuses checksums that do not list the installer; says so when the app's folder is not writable; stages beside the installed app, starts the swap with this process's id, then quits; does not quit when staging fails.
- The swap script, run for real on temporary folders: replaces the app, removes the old one, opens the new one; with the new app missing it puts the old one back and logs why; waits for the running process to exit; handles paths with spaces and quotes. Staging from a real disk image (macOS only): a sealed app is copied and checked, nothing stays mounted; an unsealed one is refused and leaves no copy.

## What the drive showed (a packaged app, Apple Silicon, this Mac)

`check-update.ts` passes both ways (stand-in opener, and the real `open`): the packaged 0.1.1-Prototype app, with checking on and a throwaway data folder, found 0.1.2-Prototype (Downloading, Ready), sent only `Iskios/0.1.1-Prototype` as user agent, quit on Restart and update, and the app on disk became 0.1.2-Prototype with a valid seal, no leftover `.Iskios-update.app` or `.Iskios-previous.app`, and no quarantine mark; the app that started afterwards reported 0.1.2-Prototype. The script unregisters its temporary app from Launch Services. Screens in [2026-11-13-app-updates/](2026-11-13-app-updates/): the notice in the top bar, the confirmation with the release notes, the Workshop's Updates section ready and with checking off.

## Findings made while checking

- electron-builder writes `latest*.yml` (not a file named after the `-Prototype` channel); electron-updater falls back to `latest.yml` when the channel's file is missing, so the release workflow publishes `latest*.yml`. `builder-debug.yml` is also in the folder, so the workflow names the files exactly.
- On macOS's bash 3.2 a failing `[[ ]]` does not stop a `set -e` script, so the release step's new guard uses `test`.

## Not checked, limits

- **Windows and Linux updating was not run**: `electron-updater` is bundled and loads, the update files and the workflow are checked offline, but no installer or AppImage was updated. The first real run is on a tagged release.
- GitHub itself was not contacted: no release was published; the release list, asset download redirects, and rate limits are untested against the real service. The workflow's new upload and download steps run only on GitHub.
- Intel Macs and a standard (non-admin) user were not tried; an app in a folder the user cannot write is refused with a message (tested), not driven.
- A swap that fails after the app has quit was tested at the script level, not in a full app run; the failure note shown at the next start is covered by the controller test only.
- Dark theme only was seen; light and Gild looks, a narrow window, and the Updates card on a paired host (it says updates are made in the desktop app on this computer) were not looked at.
- Packaged Iskios installed in `/Applications` and updated from a real release was not done, as no second release exists.

## Results

`CI=1 bun run test --maxWorkers=4`: 133 files passed and 1 skipped; 1,466 tests passed and 14 skipped (the suite before this batch had 1,404 passed). The one change after that run (the updater's creation can no longer stop startup, `setup.ts`) was typechecked and linted, and has no test of its own: it runs only inside Electron. `bun run check` and `bun run typecheck` pass after it. `check-update.ts` passed in three runs before the final edits to the app's screen text and `setup.ts`, and was not rerun on a rebuilt package after them.
