# Proof: renamed to Canopy, with the former data carried over (CHG-0061)

- **Verdict:** not proven overall: four claims proven, the window after the rename unproven.
- **Work:** working tree on `d597f91` (branch `harnesses-and-accounts`), committed after this proof.
- **Agreement:** the owner's instructions of 2026-11-07: "Operate the rebranding overall in Canopy.", Intel kept ("Let's keep Intel for now."), former data migrated, dated records left as written; `documentation/changelog/0.1.0-Prototype.md` (CHG-0061).
- **Environment:** macOS 26 (Darwin 25.6), Bun 1.4.3, Electron 45.2.3 run as Node; the built service (`apps/desktop/dist/service.js`) on the fake harness (`CANOPY_HARNESS=fake`); a copy of the owner's data taken with `sqlite3 .backup`.
- **Date:** 2026-11-07

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | Living files carry the name Canopy; no brand use of the former name remains outside dated records | request; diff | proven |
| C2 | An install laid out as before the rename is moved: folder, database with its write-ahead files, and Claude Code session folders of scratch folders | request ("Migrate it"); `apps/desktop/src/formerData.ts` | proven |
| C3 | The built service starts on the moved data and lists every mission it holds | request ("runs on the migrated data") | proven |
| C4 | Nothing moves when the new folder already exists | `formerData.ts`; diff | proven |
| C5 | The desktop window shows Canopy and the existing missions | request | unproven |

## Evidence

### C1: no brand use of the former name in living files

- **Check:** `sh documentation/verification/2026-11-07-canopy-rename/leftovers.sh <repository>`: `git grep` for `open.?mission`, ignoring dated records, the migration's own references to the former name, and the words meaning "open a mission" (`open_mission`, `reopenMission`, `onOpenMission`, the `openMission` UI state); it refuses to pass when the search matches nothing at all.
- **Shown able to fail:** before and after: on a worktree at `d597f91` it reports 311 brand uses (`AGENTS.md:1:# OpenMission`, `README.md:1:# OpenMission`, …), exit 1.
- **Result:** end state: `brand uses of the former name: 0`, exit 0.
- **Reproduced:** rerun from a clean shell by the verifying agent; matched.

### C2 and C3: the former install is moved and the service lists its missions

- **Check:** `bun documentation/verification/2026-11-07-canopy-rename/probe.ts <repository> "$HOME/Library/Application Support/Canopy"`. It copies the owner's database into a temporary `OpenMission/openmission.sqlite`, adds a Claude Code session folder named after its scratch folder, calls `moveFormerData`, starts the built service on the result, and sends `ListMissions` (dashboard and archived) over its loopback socket. It passes only when the former folder is gone, the session folder is renamed, and the service lists as many missions as the source holds.
- **Shown able to fail:** mutation, in a separate worktree with the end state's `formerData.ts`:
  - `renameDatabase` call dropped: `canopy.sqlite present: false`, `listed by the service: 0`, FAIL, exit 1;
  - `renameClaudeSessions` call dropped: `Claude session renamed: false`, FAIL, exit 1;
  - the move skipped (`return;`): the former folder stays, the service fails with `unable to open database file`, exit 1.
- **Result:** `former folder gone: true`, `canopy.sqlite present: true`, `Claude session renamed: true`, `missions in the source: 5; listed by the service: 5`, PASS, exit 0.
- **Also observed:** the owner's own data was moved the same way: `~/Library/Application Support/Canopy/canopy.sqlite` holds 5 threads and passes `PRAGMA integrity_check`; four `~/.claude/projects/…-Canopy-missions-…` folders replaced the `…-OpenMission-missions-…` ones.
- **Reproduced:** rerun from a clean shell by the verifying agent; matched.

### C4: nothing moves once the new folder exists

- **Check:** `apps/desktop/test/formerData.test.ts`, "leaves both folders alone once the new folder exists", in `bun run test`.
- **Shown able to fail:** mutation, in a separate worktree: the guard changed to `if (!existsSync(formerFolder)) return;` makes the test fail (`expected false to be true`, 1 failed, 2 passed).
- **Result:** passed in `bun run test` (335 passed, 8 skipped).
- **Reproduced:** rerun by the verifying agent; matched.

### C5: the desktop window after the rename

- **Check:** none run. Driving the Electron window needs Metro and a browser automation attach, which this session was asked not to use.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bun run test` | pass (332, 8 skipped) | pass (335, 8 skipped) |
| Typecheck | `bun run typecheck` | pass | pass (4 workspaces) |
| Lint | `bun run check` | pass | pass |
| Desktop build | `cd apps/desktop && bun run build` | not run | pass |
| Lockfile | `bun install --frozen-lockfile` | not run | pass |
| Whitespace | `git diff --check` | not run | pass |

## Not proven

- C5: run `bun run dev`, check the window title and sidebar read Canopy and the five threads appear, then send one message in a thread with no workspace to see its Claude Code session resume.

## Reproduce

```sh
bun install --frozen-lockfile
(cd apps/desktop && bun run build)
sh documentation/verification/2026-11-07-canopy-rename/leftovers.sh "$PWD"
bun documentation/verification/2026-11-07-canopy-rename/probe.ts "$PWD" "$HOME/Library/Application Support/Canopy"
bun run typecheck && bun run check && bun run test
```

## New files

- `documentation/verification/2026-11-07-canopy-rename/probe.ts`
- `documentation/verification/2026-11-07-canopy-rename/leftovers.sh`
