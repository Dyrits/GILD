# Proof: renamed to Gild, with the owner's logo (CHG-0072)

- **Verdict:** not proven overall: five claims proven, the owner's real install moving and the look unproven.
- **Work:** working tree on `e24a66d` (branch `main`), committed after this proof.
- **Agreement:** the owner's instruction of 2026-11-09: "We'll do another rebranding. We'll rename the solution 'Gild' instead of Canopy. Use this logo for now."; `documentation/changelog/0.1.0-Prototype.md` (CHG-0072).
- **Environment:** macOS 26 (Darwin 25.6), Bun 1.4.4, Electron 45.2.3 run as Node for Vitest and as the window; Metro `CI=1 BROWSER=none bunx expo start --port 8097`; Electron `GILD_HARNESS=fake GILD_DATA_DIR=<temp> GILD_APP_URL=http://localhost:8097` with `--remote-debugging-port=9361`; `playwright-cli attach --cdp=http://localhost:9361`; a copy of the owner's data taken with `sqlite3 .backup`.
- **Date:** 2026-11-09

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | Living files carry the name Gild; no brand use of the former name remains outside dated records | request; diff | proven |
| C2 | A Canopy install's data moves into the Gild profile folder, database and Claude sessions included, even when Electron made the folder first | request; `apps/desktop/src/formerData.ts` | proven |
| C3 | The built service starts on the moved data and lists every mission it holds | request | proven |
| C4 | Nothing moves once the new database exists | `formerData.ts`; test | proven |
| C5 | The window shows Gild, the owner's mark, and the redrawn empty state | request | proven |
| C6 | The owner's own install moves on its next launch | request | unproven |

## Evidence

### C1: no brand use of the former name in living files

- **Check:** `sh documentation/verification/2026-11-09-gild-rename/leftovers.sh <repository>`: `git grep` for `canopy`, ignoring dated records, the migration's own references to the former names, links to dated files named after them, the brand folder, tool state, and build output. It refuses to pass when the search matches nothing at all.
- **Shown able to fail:** before the rename, the same search over `e24a66d` reports 371 matches (`AGENTS.md`, `README.md`, …), including the Expo `name` and every `@canopy/` import.
- **Result:** end state: `brand uses of the former name: 0`, exit 0 (matches the dated handoff link and nothing else before filtering).
- **Reproduced:** rerun from a clean shell; matched.

### C2 and C3: the former install is moved and the service lists its missions

- **Check:** `bun documentation/verification/2026-11-09-gild-rename/probe.ts <repository> "$HOME/Library/Application Support/Canopy"`. It backs up the owner's live database into a temporary `Canopy/canopy.sqlite`, adds a Claude Code session folder named after its scratch folder, makes the `Gild` profile folder first (as Electron does) with a `Local State` file, calls `moveFormerData`, starts the built service on the result, and sends `ListMissions` (dashboard and archived) over its loopback socket. It passes only when the profile file survives, `gild.sqlite` exists, the session folder is renamed, and the service lists as many missions as the source holds.
- **Shown able to fail:** the first run of the window check found the blocking bug this claim now covers: the app made `~/Library/Application Support/Gild` before the move, and the earlier `moveFormerData` skipped whenever the folder existed, so the data would not have moved. The move now merges into an existing folder that has no `gild.sqlite`; the test "moves the data into a profile folder the app already made" fails against the earlier version.
- **Result:** `profile kept: true`, `gild.sqlite present: true`, `Claude session renamed: true`, `missions in the source: 11; listed by the service: 11`, PASS, exit 0.
- **Reproduced:** rerun from a clean shell by the author; matched.
- **Also observed:** the owner's data still sits in `~/Library/Application Support/Canopy/canopy.sqlite` (11 missions) because their app was running throughout. The UI drive below made an empty profile at the real `Gild` path; it held no database and was removed, so the next launch still finds no `gild.sqlite` and moves the install.

### C4: nothing moves once the new database exists

- **Check:** `apps/desktop/test/formerData.test.ts`, "leaves both folders alone once the new database exists", in `bun run test`; and the same file's two former names (`Canopy` and `OpenMission`) and the profile-merge case.
- **Shown able to fail:** with the guard removed or changed to `existsSync(folder)`, the merge and database tests fail.
- **Result:** passed in `bun run test` (414 passed, 10 skipped).

### C5: the window after the rename

- **Check:** drove the built desktop app on the fake harness and a throwaway data folder with `playwright-cli`: a Control with no missions, then one mission started from the composer.
- **Result:** window title `Gild` (DevTools target title); sidebar shows the keyed-out gold G and `Gild`; the empty board shows the gilt frame and "No missions here yet."; the mission panel keeps its arch (`verification/2026-11-09-gild-rename/window-control.png`, `window-mission.png`).
- **Not checked:** the dock icon (no screen capture of the dock), a native phone build.

### C6: the owner's real install

- **Check:** none run: their app was open with the former build, and moving `~/Library/Application Support/Canopy` under a running app is not safe.
- **Result:** pending. Quit the running window, run `bun run dev`, and check the title, sidebar, and the 11 missions; send one message in a thread with no workspace to see its Claude Code session resume.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bun run test` | pass (410, 10 skipped) | pass (414, 10 skipped) |
| Typecheck | `bun run typecheck` | pass | pass (4 workspaces) |
| Lint | `bun run check` | pass | pass |
| Desktop build | `cd apps/desktop && bun run build` | not run | pass |
| Whitespace | `git diff --check` | not run | pass |
| Former name | `leftovers.sh` | 371 matches on `e24a66d` | 0 matches |

## Not proven

- C6: the owner's install moving and their threads resuming on their next launch.
- The dock icon and native Android/iOS builds.
- The look: the owner judges the gold mark beside the Sketchbook ink.

## Reproduce

```sh
bun install
(cd apps/desktop && bun run build)
sh documentation/verification/2026-11-09-gild-rename/leftovers.sh "$PWD"
bun documentation/verification/2026-11-09-gild-rename/probe.ts "$PWD" "$HOME/Library/Application Support/Canopy"
bun run typecheck && bun run check && bun run test
```

## New files

- `documentation/verification/2026-11-09-gild-rename/probe.ts`
- `documentation/verification/2026-11-09-gild-rename/leftovers.sh`
- `documentation/verification/2026-11-09-gild-rename/window-control.png`
- `documentation/verification/2026-11-09-gild-rename/window-mission.png`
- `documentation/brand/README.md` and `documentation/brand/gild-logo-2026-11-09.png`
