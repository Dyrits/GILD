# Proof: batch 4 after CHG-0034 and CHG-0035 (Retry, workspace sandbox, autonomous threads, plain questions, native folder dialog)

- **Verdict:** not proven overall. C1 to C9 were observed and shown able to fail by mutation, but were not independently reproduced (see Reproduction). C10 and C11, the native dialog and how the new card, notice, and lines look, await the owner.
- **Work:** working tree on b3b6303, committed afterwards with the handoff `2026-11-06-0712-autonomous-threads.md`
- **Agreement:** `documentation/changelog/0.1.0-Prototype.md` (CHG-0034, CHG-0035); `documentation/capabilities/action-approval/specifications.md`; `documentation/capabilities/workspace-attachment/specifications.md`; `documentation/work-in-progress.md` (Batch 4)
- **Environment:** macOS 26.6.2, Bun 1.4.3, Electron 45.2.3 as Node for tests, Claude Code 2.1.302 for the live checks. The mutations ran in a disposable worktree at `/tmp/om-verify-wt` (`git worktree add --detach` at HEAD, the working-tree diff and new files applied, and `node_modules` folders symlinked from the checkout).
- **Date:** 2026-11-06

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | A thread about to start a turn in a missing workspace folder goes to Attention with the MissingWorkspace blocker. Its messages wait, Retry runs them once the folder is back, and a thread whose folder is still missing returns to Attention | CHG-0034; spec, Missing folder | proven |
| C2 | A restart keeps a waiting thread in Attention, Stop clears the wait, and Retry is refused for a thread that is not waiting | CHG-0034 | proven |
| C3 | A sandboxed workspace thread's Claude Code settings add the download hosts, the cache write paths, loopback binding, and `NODE_USE_ENV_PROXY=1`, and a scratch thread's settings do not | CHG-0034 | proven |
| C4 | At the default level, a harness prompt the sensitive list does not recognize runs without a question and leaves an `AllowedAutomatically` line, including the read-only `for … cat` loop from the owner's screenshot and local git. At the stricter level, every prompt asks | CHG-0035 | proven |
| C5 | The sensitive list recognizes push, publish, deploy, GitHub posts, messages, data sent to websites, remote connections, deletions outside the workspace, discarded work, system changes, secrets, and file writes outside the workspace, and lets ordinary work run | CHG-0035 | proven |
| C6 | A sensitive prompt becomes a question that leads with the action and states what it affects, falling back to the kind of action when Claude Code gives no reason | CHG-0035; spec, The question | proven |
| C7 | Answers are Allow, Always allow, and Deny with an optional message; Discard is gone | CHG-0035 | proven (contract and checks) |
| C8 | Any existing folder can be chosen as a workspace, and a path that is not a folder is refused with nothing saved | CHG-0035; spec, Choosing | proven |
| C9 | The kept folder browser still limits browsing to the roots and lists hidden folders only on Show hidden | CHG-0034, CHG-0035 | proven |
| C10 | Choose folder… opens Finder or Explorer and fills in the chosen path | CHG-0035 | awaiting human judgment |
| C11 | The three-button card, the Retry notice, and the "Ran · …" lines read right for a casual user | CHG-0035 | awaiting human judgment |

## Evidence

### C1 to C9

- **Check:** `bun run test`. The checks are in `packages/service/test/workspaces.test.ts` (C1, C2, C8, C9), `packages/service/test/claude.test.ts` ("lets a sandboxed workspace thread reach the package registry and release downloads unasked", C3), and `packages/service/test/approvals.test.ts` ("harness permission prompts" and "recognizing sensitive actions", C4 to C7). C7 is also enforced by the contract: `Answer` no longer has `Discard`, so `bun run typecheck` fails on any use of it.
- **Shown able to fail:** by mutation in the disposable worktree, using `documentation/verification/2026-11-06-autonomous-threads/mutations.sh`. Failed checks per mutation:

  | Mutation | Claim | Checks failed |
  | --- | --- | --- |
  | M1: missing folder not held | C1 | 5 |
  | M2: restart releases the thread | C2 | 1 |
  | M3: Stop keeps the blocker | C2 | 1 |
  | M4: sandbox not widened | C3 | 1 |
  | M5: every prompt asks | C4 | 2 |
  | M6: nothing is sensitive | C5, C6 | 6 |
  | M7: push not recognized | C5 | 5 |
  | M8: secrets not recognized | C5 | 1 |
  | M9: consequence dropped | C6 | 2 |
  | M10: hidden folders never listed | C9 | 1 |
  | M11: folders outside home refused | C8 | 3 |
  | M12: Retry accepted for any thread | C2 | 1 |

  After restoring, 71 passed and 2 were skipped. The full output is in `documentation/verification/2026-11-06-autonomous-threads/mutations.txt`.
- **Result:** `Tests 71 passed | 2 skipped (73)`. With `OPENMISSION_LIVE_CLAUDE=1`: `Tests 73 passed (73)`.
- **Reproduced:** see Reproduction below.

### C10 and C11

- **Check:** none run. The window was not driven, and Playwright cannot reach the native dialog. What exists: the IPC handler `openmission:chooseFolder` (`apps/desktop/src/main.ts`), the preload bridge, and `WorkspacePicker`, `QuestionCard`, `MissingFolderNotice`, and `QuestionLine` in `apps/app/src`. All typecheck, and the desktop shell builds.
- **Result:** awaiting the owner's run-through (work-in-progress, Batch 4, Checks).

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bun run test` | pass (61, 2 skipped; earlier proof) | pass (71, 2 skipped) |
| Live tests | `OPENMISSION_LIVE_CLAUDE=1 bun run test` | not run | pass (73) |
| Typecheck | `bun run typecheck` | pass | pass |
| Lint | `bun run check` | pass | pass |
| Desktop build | `bun run build` in `apps/desktop` | not run | pass |

## Not proven

- C10: needs a person to click Choose folder… in the desktop app and pick a folder in Finder or Explorer.
- C11: needs the owner's judgment of the wording and layout in the window.

## Reproduce

```sh
bun run test && bun run typecheck && bun run check
OPENMISSION_LIVE_CLAUDE=1 bun run test   # needs a signed-in Claude Code
W=/tmp/om-verify-wt; git worktree add --detach "$W" HEAD
for d in node_modules apps/app/node_modules apps/desktop/node_modules packages/service/node_modules packages/contracts/node_modules; do [ -e "$d" ] && ln -s "$PWD/$d" "$W/$d"; done
documentation/verification/2026-11-06-autonomous-threads/mutations.sh "$W"
git worktree remove --force "$W"
```

When this proof is reproduced before the commit, apply the working-tree diff and the new files to the worktree after `git worktree add`.

## Reproduction

The commit followed at once, on the owner's request ("commit and push"). Nobody reran the proof from a clean shell, and no fresh-context agent reproduced it. C1 to C9 rest on one run of the suite and of the mutations, so they are not independently reproduced.

## New files

- `documentation/verification/2026-11-06-autonomous-threads/mutations.sh`
- `documentation/verification/2026-11-06-autonomous-threads/mutations.txt`
