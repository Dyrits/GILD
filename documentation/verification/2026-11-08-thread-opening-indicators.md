# Proof: thread-opening indicators

- **Verdict:** proven for C1 to C3. C4 (how the lines look) awaits the owner's judgment.
- **Work:** working tree on `3e242b6`, not committed (CHG-0067).
- **Agreement:** the owner's request of 2026-11-08 for an indicator when a thread is opened beneath another, like delta's "Fork: …" and "Forked from: …".
- **Environment:** macOS 26, Bun, Electron's Node for Vitest. Metro `CI=1 BROWSER=none bunx expo start --port 8097` in `apps/app`; Electron `env -i HOME PATH USER TMPDIR LANG CANOPY_HARNESS=fake CANOPY_DATA_DIR=/tmp/canopy-ui/data CANOPY_APP_URL=http://localhost:8097 bunx electron dist/main.js --remote-debugging-port=9361` in `apps/desktop`, after `bun run build`; `playwright-cli attach --cdp=http://localhost:9361`.
- **Date:** 2026-11-08

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | Each thread summary carries `openedAt`, the time of the thread's first message | diff (`records.ts`, `missionDetail.ts`) | proven |
| C2 | A thread's conversation shows each thread opened directly beneath it at the moment it was opened, leaving out asides and deeper threads | request; diff (`entries.ts`) | proven |
| C3 | In the app, the parent shows "Opened beneath: <title>", and the child shows "Opened from: <parent title>". Each line selects the other thread | request | proven |
| C4 | The lines read well next to the conversation | request | awaiting human judgment |

## Evidence

### C1

- **Check:** `packages/service/test/threads.test.ts` › "opens a thread beneath the caller…": `child.openedAt` equals the child's first message `sentAt`.
- **Shown able to fail:** mutation in a separate worktree: `openedAt` replaced by `0` in `missionDetail.ts`. The test failed with `expected +0 to be 1794133429205`.
- **Result:** passes on the end state.
- **Reproduced:** by the author, rerunning `bun run test`. It matched.

### C2

- **Check:** `apps/app/test/entries.test.ts`, 2 tests. The parent's entries are `first`, `opened:child`, `second`. The aside and the grandchild are left out. A thread with nothing beneath it shows no opening.
- **Shown able to fail:** three mutations in a separate worktree. Each one made the tests fail:
  - asides kept: 1 test failed;
  - `openedAt` replaced by 0: 1 test failed;
  - any thread with a parent counted: 2 tests failed.
- **Result:** passes on the end state.
- **Reproduced:** by the author, rerunning `bun run test`. It matched.

### C3

- **Check:** in the app, start the mission "Hola." and choose Open thread beneath. Send "What is my name?", then click each line.
- **Shown able to fail:** before the change, neither line existed: `3e242b6` renders no such text (`rg "Opened beneath|Opened from" apps/app/src` at that commit finds nothing).
- **Result:**
  - The child pane showed `"Opened from: Hola."` ([child-opened-from.png](2026-11-08-thread-opening-indicators/child-opened-from.png)). Clicking it selected "Hola.".
  - The parent showed `"Opened beneath: What is my name?"` after the agent's reply ([parent-opened-beneath.png](2026-11-08-thread-opening-indicators/parent-opened-beneath.png)). Clicking it selected the child.
- **Reproduced:** not rerun by a second session.

### C4

Screenshots above. The line uses the existing centered link style of suggestion lines.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bun run test` | pass (CHG-0066) | 399 passed, 10 skipped |
| Typecheck | `bun run typecheck` | pass | pass |
| Lint | `bun run check`, `git diff --check` | pass | pass |
| Web build | `CI=1 bunx expo export --platform web` in `apps/app` | not run | pass |

## Not proven

C4: the look needs the owner's eye. The app drive (C3) was not reproduced by a second session.

## Reproduce

```sh
bun run test
bun run typecheck && bun run check
# C3: start Metro and Electron as under Environment, then repeat the steps.
```

## New files

- `apps/app/test/entries.test.ts`
- `apps/app/src/entries.ts`: `entriesOf` moved out of `conversationEntries.tsx`, so it can be tested without React Native.
