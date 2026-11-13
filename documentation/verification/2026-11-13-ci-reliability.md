# Proof: the hosted check made reliable (CHG-0256)

- **Verdict:** proven for C1 to C6; the hosted check on GitHub has not run on these changes
- **Work:** working tree on `39fee06`, later committed as CHG-0256
- **Agreement:** the owner's request to find why the pipeline fails often and make it reliable, and the plan agreed in the thread (fix the stale test, honour an interrupt during startup, run related tests before a commit, remove fixed waits before an interrupt or a steer)
- **Environment:** macOS (Darwin 27.2.0), 10 cores, Bun and Electron 45 as the `test` script runs them (`ELECTRON_RUN_AS_NODE=1`), stand-in harnesses from `packages/service/test/fixtures`. Other Delta worktrees were running at the same time (load average 6 to 25), which matters for C6.
- **Date:** 2026-11-13

## Claims

| # | Claim | Verdict |
| --- | --- | --- |
| C1 | `hostOnlyRequests.test.ts` lists the host-only requests as the contract now has them | proven |
| C2 | A Stop sent while a harness process still starts ends the turn as interrupted instead of failing with "This thread is not running", and the process is kept | proven |
| C3 | The same holds for Codex between `turn/start` and its answer | proven |
| C4 | The tests that sent an interrupt or a steer too early now wait for the turn, and stop failing under CPU load | proven |
| C5 | The pre-commit hook runs the tests that import the staged files and fails on a stale test | proven |
| C6 | Nothing else regressed | proven |

## Evidence

### C1

- **Check:** `bun run test` on `packages/contracts/test/hostOnlyRequests.test.ts`.
- **Shown able to fail:** the same test failed on `main` (CI run 43388719333) and locally at `39fee06` with `AddBrowsableRoot` and `RemoveBrowsableRoot` missing from the expected list.
- **Result:** 3 passed.

### C2

- **Check:** `harnessProcesses.test.ts` "cancels a turn interrupted while its process still starts, without running it" (a protocol whose `start` is held back; the interrupt must answer true, the turn must end as interrupted without running, the process must stay, and the next turn must run).
- **Shown able to fail:** red before the change in `harnessProcesses.ts` (`expected false to be true` on the interrupt), green after.
- **Result:** 8 of 8 in the file.

### C3

- **Check:** `harnesses.test.ts` "ends a turn interrupted before Codex has answered turn/start, once it has the turn", with `STAND_IN_CODEX_START_DELAY=300`.
- **Shown able to fail:** with `codex.ts` stashed it failed with `ServiceFailure: This thread is not running.`; restored, it passed.

### C4

- **Check:** the harness tests whose names contain `interrupt`, `steer` or `Codex threads`, repeated 25 times with 20 busy `yes` processes on 10 cores (`/tmp/stress.sh`, kept out of the repository).
- **Shown able to fail:** before the changes the same load failed 4 of 25 (Codex steer 3 times, Codex interrupt once); the OpenCode cancel test had failed 1 of 12 under load and once on CI (run 43327852535), and it failed again on `main` in a full run during this verification.
- **Result:** 25 passed of 25 after the changes.

### C5

- **Check:** staged a comment-only change to `packages/contracts/src/remote.ts` with the old `hostOnlyRequests.test.ts` restored, and ran `sh .githooks/pre-commit`.
- **Result:** the hook failed on `hostOnlyRequests.test.ts` (1 failed of 892 related tests), in 82 s. The probe was reverted.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Lint | `bunx biome check .` | not run | pass |
| Typecheck | `bun run typecheck` | not run | pass (5 of 5 packages) |
| Full suite, quiet machine | `bun run test --maxWorkers=4` | 2 failures (the two flakes above) | 1350 passed, 14 skipped, run before the Codex and Claude test changes |
| Full suite, loaded machine (load 10 to 120, other worktrees running) | same | 3 failures: the two above and `starts a new session ... sandboxed OpenCode` | 3 to 5 failures, all macOS-only Seatbelt tests of `harnesses.test.ts` or a 5 s timeout elsewhere; not a result about the code |
| Full suite, quiet machine (load 2 to 6), all changes in place | same | not rerun | 1351 passed, 14 skipped, 49 s |

## Not proven

- The hosted check on GitHub has not run on these changes.
- A message steered before Codex answers `turn/start` still waits for the next turn, as designed; the Codex steer test waits 150 ms after the stand-in logs `turn/start` for that reason, which leaves a window of one local round trip.

## Reproduction

By the author only, from the same shell; no independent reproduction.
