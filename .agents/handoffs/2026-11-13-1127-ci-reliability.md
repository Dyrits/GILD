# Handoff: Reliability of the hosted check (CHG-0256)

Supersedes: none
Workspace: ISKIOS repository, branch `main`, Delta worktree `/Users/dgerrits/Library/Application Support/delta/worktrees/frnp207ejn6p/ISKIOS`; one commit on top of `origin/main` `0f5aae9`, to be pushed with `--no-verify`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Stop the GitHub Actions `check` job on `main` from failing at random. Done means the hosted job passes on the pushed commit and keeps passing, with no retry that hides races.

## State

- Verified now: `git log` shows the work as one commit, "Make the hosted check reliable: honour an interrupt during startup, fix stale and racy tests (CHG-0256)", rebased onto `origin/main` `0f5aae9`; the working tree is clean. The push has not happened yet at the time of writing; check `git status -sb` and `git fetch`.
- Verified by running them on this commit after the rebase: `bunx biome check .` clean, `bun run typecheck` passes, `bun run test --maxWorkers=4` gives 1366 passed and 14 skipped (120 files passed, 1 skipped), on a machine with load average about 6.
- Built, recorded in CHG-0256 and in the proof `documentation/verification/2026-11-13-ci-reliability.md`: an interrupt received while a harness process still starts ends the turn as interrupted before its prompt is sent (`packages/service/src/harness/harnessProcesses.ts`, with a unit test red before and green after); the same for Codex between `turn/start` and its answer (`packages/service/src/harness/codex.ts`, stand-in variable `STAND_IN_CODEX_START_DELAY`); tests that interrupted or steered after a fixed wait now wait for the turn (`untilRequested` in `harnesses.test.ts`, `untilTurnWritten` in `claude.test.ts`); `.githooks/pre-commit` runs `vitest related` on staged TypeScript files, without the Git variables a hook inherits, with a 20 s test timeout.
- Verified earlier in the session (not rerun after the rebase): the harness tests repeated 25 times with 20 busy `yes` processes on 10 cores passed 25 of 25, where the same load failed 4 of 25 before; the pre-commit hook fails on a stale `hostOnlyRequests.test.ts` (82 s for a `contracts` change).
- Assumed: the hosted `check` job passes on this commit; it has not run. The macOS-only Seatbelt tests in `harnesses.test.ts` (skipped on the Ubuntu runner) time out when the machine's load is far above its core count; they failed the same way on the earlier commit under that load, so this is not a result about the code.
- The repository's Git config in this Delta worktree (`../ISKIOS.git/config`) had `core.bare = true` together with `core.worktree`, which made `git status` fail; it was set to `false`. `origin` was set to `git@github.com:Dyrits/ISKIOS.git` at the owner's request.

## Decisions

- No retry of failed tests in the test runner: it would have hidden the startup race, which also existed in the product. The owner agreed with this.
- The tests that need to run before a commit are enforced in the pre-commit hook, not the pre-push hook, because a push to `main` is made with `--no-verify` and skips the pre-push hook.
- A message steered before Codex answers `turn/start` waits for the next turn, as designed; the Codex steer test waits 150 ms after the stand-in logs `turn/start` and does not remove that window entirely.
- The owner approved pushing to `main` with `--no-verify` for this work.

## Next

1. Run `git fetch` and `git status -sb`; if `origin/main` moved, rebase and rerun `bun run test --maxWorkers=4`. Then push to `main` with `--no-verify` if it is not pushed yet.
2. Watch the hosted run (`gh run list --repo Dyrits/ISKIOS --limit 3`); if it fails, read `gh run view <id> --log-failed` before changing anything.
3. Audit the other fixed `Effect.sleep` waits in the tests (about 50 in `packages/service/test/harness/`, more elsewhere) for tests that act after a fixed delay, and replace them with waits on an observable event; stress each changed group under CPU load as in the proof.
4. Optionally make the macOS-only Seatbelt tests tolerant of load (longer timeouts), and enable branch protection with the `check` job required so that `main` is reached through pull requests.

## Open questions

- Owner: whether to protect `main` and require the `check` job, which the workflow already runs on pull requests.
- Owner: whether the pre-commit cost (about 40 to 80 s when shared packages change) is acceptable.

## Sources

- `documentation/changelog.md`, CHG-0256; `documentation/verification/2026-11-13-ci-reliability.md`
- Failed runs: https://github.com/Dyrits/ISKIOS/actions/runs/43388719333 (stale test) and https://github.com/Dyrits/ISKIOS/actions/runs/43327852535 (cancel race)
- `packages/service/src/harness/harnessProcesses.ts`, `packages/service/src/harness/codex.ts`, `packages/service/test/harness/harnesses.test.ts`, `packages/service/test/harness/claude.test.ts`, `.githooks/pre-commit`
