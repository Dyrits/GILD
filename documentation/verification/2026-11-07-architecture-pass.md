# Verification: architecture pass (2026-11-07)

This proof covers the refactors from the review of the whole project and the six candidates of the [architecture audit](../architecture-audit/architecture-audit-2026-11-07-1830.html), recorded in CHG-0062. It starts from `26bbb1d`, and the work is uncommitted on `main`.

## Claims and checks

- **Behavior is otherwise unchanged.**
  - Check: the 339 tests that passed at `26bbb1d` still pass.
  - Tests were moved, renamed, or adjusted only where the change below says so, and no assertion was weakened.
- **Harness processes** (`harnessProcesses.ts`):
  - Claim: one module owns each thread's process for all three adapters.
  - Check: `harnessProcesses.test.ts`, 7 tests with an in-process fake protocol: restart on key change, idle close, close at scope end, an interrupt the harness never confirms, an end reported while interrupting, an untaken steered message, and a failure in work run beside the turn.
- **Restart key:**
  - Claim: a Claude Code thread restarts its process, resuming its session, when its model, effort, folder, account, or access changes.
  - Check: `claude.test.ts`, "restarts the process, resuming its session, when the thread's model changes". It failed with the former key.
- **Prompts in-process:**
  - Claim: Codex and OpenCode ask the owner through the turn's `askOwner`, and a failure to ask ends the turn.
  - Check: `harnesses.test.ts`, "fails the turn, rather than leave Codex waiting, when the owner cannot be asked".
  - Claim: `answer_prompt` is listed only to Claude Code threads.
  - Check: `harnesses.test.ts`, "lists the thread tools without Claude Code's permission prompt tool".
  - Claim: Claude Code's format stays covered.
  - Check: `approvals.test.ts`, "answers Claude Code's permission prompt tool in its own format".
- **Intel store** (`intelStore.ts`):
  - Claim: every change is in the history, and undo restores the state before it.
  - Check: `intelStore.test.ts`, 6 tests on a temporary SQLite. They cover save, correct, edit, narrow, widen, replace, pin, unpin, restore, delete by the owner and by a thread, and merge. They also cover fading steps stored before a use and a pin, declines by actor, and erasing a thread's intel.
  - Removing the decline condition or the fading-step recording turns 2 of them red.
- **Starting context** (`startingContext.ts`):
  - Claim: the preview measures what the opened thread receives, within one token per part.
  - Check: `startingContext.test.ts`, "measures the starting context the new thread then receives", "counts the workspace's own instructions", and "counts the instructions every thread receives, its title line, and the budget line".
  - Three more tests read the assembled context without running a turn.
  - The rename test in `claude.test.ts` still passes.
- **Commands** (`commands.ts`):
  - Claim: follow-ups run after commit, in a fixed order, and none run when the transaction fails.
  - Check: `commands.test.ts`, 9 tests. They cover the order with each follow-up seeing the committed row, no announcement for an unchanged operation, operation and storage failures, `apply`, and the follow-ups returned by `reportResult`, `openThreadByAgent`, `stopThread`, and `setMissionBudget`.

## Commands run (2026-11-07)

```
bun run typecheck        # 4 packages, exit 0
bun run check            # Biome, no fixes
bun run test             # 371 passed, 8 skipped (twice in a row)
git diff --check
cd apps/desktop && bun run build
D=$(mktemp -d); CANOPY_DATA_DIR=$D CANOPY_HARNESS=fake CANOPY_TOKEN=smoke ELECTRON_RUN_AS_NODE=1 ../../node_modules/.bin/electron dist/service.js
```

The bundled service started on the fake harness, created its database, and logged no error.

## Every check shown able to fail

Each mutation below was made in a separate worktree of the end state; the user's checkout was never mutated. Each mutated module was restored after its run. The script is `/tmp/canopy-scripts/mutate.py`, written outside the repository: it applies one edit, runs the named test file, and puts the source back.

| Mutation | Caught by |
| --- | --- |
| Commands wake threads before cancelling turns | `commands.test.ts`: 2 failed |
| Commands apply follow-ups inside the transaction | `commands.test.ts`: 6 failed |
| Starting context leaves the workspace's instructions uncounted | `startingContext.test.ts`: 2 failed |
| Harness processes ignore the restart key | `claude.test.ts`: 3 failed (model and approval-level restarts) |
| `answer_prompt` listed to every harness | `harnesses.test.ts`, "lists the thread tools without Claude Code's permission prompt tool" |
| A Codex prompt failure becomes a denial | `harnesses.test.ts`, "fails the turn, rather than leave Codex waiting, when the owner cannot be asked" |
| Intel store without the decline condition, or without fading steps | `intelStore.test.ts`: 2 failed (run by the implementer) |
| Claude Code restart key without the model | `claude.test.ts`, "restarts the process … when the thread's model changes", failed with the former key (run by the implementer) |

## Reproduction

The checks were rerun from a clean shell (`env -i HOME=$HOME PATH=$PATH`) in a fresh worktree of the end state:
- `bun run check`: clean.
- `bun run test`: 371 passed, 8 skipped.
- The desktop build: produced its 3 bundles.
- `bun run typecheck`: in the main tree, all 4 packages exited 0.

## Verdicts

- **Proven**, observed by tests at each module's interface, each shown able to fail, and reproduced: harness processes, the restart key, prompts in-process, the listing of `answer_prompt`, the intel store, the starting-context measurement, and the commands runner.
- **Proven by the suite, without a mutation of their own**: the review refactors, which preserve behavior. They rest on the 339 baseline tests passing unchanged.
- **Unproven**: the app driven in the window, and the live harnesses. Neither was run.

Overall: not proven, until the window and the live harnesses are checked.

## Not verified

- The app was not driven in the window after the pass.
- No live harness was run: Claude Code, Codex, and OpenCode ran only as stand-ins.
- The review refactors had no mutation run of their own; they rest on the unchanged baseline tests.
