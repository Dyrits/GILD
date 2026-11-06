# Proof: batch 5, thread tree core

- **Verdict:** proven for C1 to C9; C10 (how the side tree looks and reads) awaits the owner.
- **Work:** working tree on `0a930cd` with batch 4's run-through fixes and batch 5 (CHG-0037)
- **Agreement:** CHG-0037; `documentation/work-in-progress.md` (Batch 5); thread-tree and thread-messaging specifications
- **Environment:** macOS 26.6.2, Bun 1.4.3, Electron 45.2.3, Claude Code 2.1.302 with Haiku. The window was driven as in [the batch 4 drive](2026-11-06-batch-4-drive.md), on the same clone with its local remote; the data folder from that drive was kept, so migration `0007_thread_tree` ran on existing data.
- **Date:** 2026-11-06

## Claims

| # | Claim | Check | Verdict |
| --- | --- | --- | --- |
| C1 | `open_thread` opens a thread beneath the caller with the caller's model, effort, and workspace unless chosen, titled by its short title or else the request's first line | `threads.test.ts`, opening threads | proven |
| C2 | The owner opens a thread beneath any thread, starting with the owner's message, down to 4 levels beneath the top thread | `threads.test.ts`, opening threads and limits | proven |
| C3 | `report_result` sends the result to the parent as a thread message, the reporter ends its turn Done, and the parent wakes with it | `threads.test.ts`, results | proven |
| C4 | A thread whose turn ends while threads beneath it run is Waiting, and Idle once they end | `threads.test.ts` | proven |
| C5 | `send_thread_message` reaches the parent and threads directly beneath, and refuses others with the reason | `threads.test.ts` | proven |
| C6 | Stop does not cascade; a Stopped thread keeps and counts its messages, and Resume delivers them | `threads.test.ts`, stopping and resuming | proven |
| C7 | At most 8 threads run in a mission: `open_thread` is refused past it, and a held message is delivered once a slot frees | `threads.test.ts`, limits | proven |
| C8 | A real Claude Code thread opens a thread that reports its result back | live check "opens a thread beneath that reports its result back to the opener" | proven |
| C9 | In the window: the side tree with states, results labelled by sender, Open thread beneath, Stop with "1 message waiting", and Resume | drive | proven |
| C10 | The side tree's layout and wording suit the owner | screenshots | awaiting the owner |

## Evidence

- **C1 to C7:** `bun run test` passes 86 with 3 skipped (the opt-in live checks). Shown able to fail with [mutations.sh](2026-11-06-thread-tree/mutations.sh), run in a disposable worktree built from the working tree: every mutation failed between 1 and 4 checks, and the restored tree passed 86 ([mutations.txt](2026-11-06-thread-tree/mutations.txt)).
- **C8:** `OPENMISSION_LIVE_CLAUDE=1 bun run test` passes 89 of 89. In the new check, Haiku opened one thread that computed 6 × 7, reported 42, and the top thread replied 42.
- **C9:** a Haiku mission on the clone opened two threads, each reported (35 Markdown files, 28 TypeScript files), and the top thread combined them: [two-threads-report.png](2026-11-06-thread-tree/two-threads-report.png). Open thread beneath opened an owner thread with the parent's model; Stop mid-turn made it Stopped, a message sent then showed "1 message waiting" in the tree ([stopped-with-waiting-message.png](2026-11-06-thread-tree/stopped-with-waiting-message.png)), and Resume delivered it. The first drive showed request-length titles; `open_thread` now takes a short title, and a second mission showed "README section headings" and "AGENTS.md document count" ([short-titles.png](2026-11-06-thread-tree/short-titles.png)).

## Notes from the drive

- Playwright's clicks stalled while the Electron window was behind other windows. Focusing it from the main process before each click (`app.focus({ steal: true })` through [main-eval.ts](2026-11-06-batch-4-drive/main-eval.ts)) made them land.

## Regressions

| Check | Command | Before | After |
| --- | --- | --- | --- |
| Tests | `bun run test` | 72 passed, 2 skipped | 86 passed, 3 skipped |
| Live tests | `OPENMISSION_LIVE_CLAUDE=1 bun run test` | 74 passed | 89 passed |
| Typecheck, lint | `bun run typecheck`, `bun run check` | pass | pass |
| Desktop build | `bun run build` in `apps/desktop` | pass | pass |

## Reproduction

Rerun at 08:40 from a clean shell (`env -i` with only `HOME`, `PATH`, `USER`, `TMPDIR`, `LANG`) on the staged tree before commit, by the same agent (no fresh-context reviewer was used):

- `bun run typecheck`, `bun run check`, and the desktop build passed.
- The mutation script, run in a new worktree holding the staged changes, gave the same failures per mutation (4, 1, 1, 1, 1, 1, 1, 2) and 86 passed once restored.
- `OPENMISSION_LIVE_CLAUDE=1 bun run test` failed once in its first run: the batch 3 live check "runs an action outside the working folder only after an approval, recording each one" (88 of 89). That check then passed alone four times and in a full rerun (89 of 89). It depends on Haiku's choices; the failing run's output was not kept, so the cause is unknown. Not caused by a known change, not excluded either: the thread instructions grew in this batch.

## Reproduce

```sh
bun run test && bun run typecheck && bun run check
OPENMISSION_LIVE_CLAUDE=1 bun run test   # needs a signed-in Claude Code
W=/tmp/om-verify-tree; git worktree add --detach "$W" HEAD
for d in node_modules apps/app/node_modules apps/desktop/node_modules packages/service/node_modules packages/contracts/node_modules; do [ -e "$d" ] && ln -s "$PWD/$d" "$W/$d"; done
documentation/verification/2026-11-06-thread-tree/mutations.sh "$W"
git worktree remove --force "$W"
```
