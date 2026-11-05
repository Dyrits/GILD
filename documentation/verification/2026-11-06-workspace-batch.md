# Proof: workspace batch (batch 4 draft)

- **Verdict:** not proven overall. C1 to C7 are proven and reproduced; C8 (appearance) awaits the owner.
- **Work:** working tree on d0a0ece (committed afterwards as the batch 4 draft)
- **Agreement:** `documentation/work-in-progress.md` (Batch 4, built as a draft, not yet agreed by the owner); `documentation/capabilities/workspace-attachment/specifications.md`
- **Environment:** macOS 26.6.2, Bun 1.4.3, Electron 45.2.3 as Node for tests, Claude Code 2.1.302 with Haiku for the drive. The window was started with Metro (`bunx expo start --port 8081` in `apps/app`) and `env -i HOME PATH USER TMPDIR LANG CLAUDE_CONFIG_DIR OPENMISSION_DATA_DIR=/tmp/om-drive/data electron dist/main.js --remote-debugging-port=9333`, then driven with Playwright CLI over CDP. The workspace was a `git clone` of this repository at `/tmp/om-drive/home/OpenMission-copy`, under a browsable root.
- **Date:** 2026-11-06

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | Browsing and choosing are limited to the browsable roots, including through a symbolic link; roots start with the home folder; Add root and New folder work | Batch 4 Behavior; spec, Choosing a workspace | proven |
| C2 | A folder becomes a workspace on first choice and is reused for the next mission | spec, Choosing a workspace | proven |
| C3 | The thread runs in the workspace folder; its starting context names the workspace, or the scratch folder when there is none | spec, What a workspace gives its threads | proven |
| C4 | The folder's `AGENTS.md` and `CLAUDE.md` reach Claude Code in its system prompt, cut at 50,000 characters | spec, What a workspace gives its threads; Batch 4 | proven |
| C5 | Always allow in a workspace saves a workspace permission that spares later missions there, but not a nested workspace or the scratch folder | spec, Requirements (Approval per action) | proven |
| C6 | A turn in a workspace whose folder is gone fails with the reason (provisional) | Batch 4 Behavior | proven |
| C7 | A real Claude Code thread follows the workspace's instructions, edits, and commits locally there without a question | Goal: self-hosting | proven (live, one run) |
| C8 | The picker, Settings roots, workspace line, and permission scope label look and read right | Batch 4 Behavior | awaiting human judgment |

## Evidence

### C1 to C6

- **Check:** `bun run test`; the workspace checks are in `packages/service/test/workspaces.test.ts`, and the adapter check is "starts Claude Code in the workspace with its instructions in the system prompt" in `packages/service/test/claude.test.ts`.
- **Shown able to fail:** by mutation in a disposable worktree, with `documentation/verification/2026-11-06-workspace-batch/mutations.sh`. M1 ignored root containment and failed 2 checks (C1). M2 dropped the instructions and failed 3 (C3, C4). M3 always used the scratch folder and failed 2 (C3, C4). M4 saved permissions for the mission and failed 1 (C5). M5 let a nested workspace inherit and failed 1 (C5). M6 ignored a missing folder and failed 1 (C6). After restoring: 61 passed, 2 skipped.
- **Result:** `Tests 61 passed | 2 skipped (63)`. The 2 skipped are the opt-in live checks (`OPENMISSION_LIVE_CLAUDE=1`). C2 is asserted by "makes the folder a workspace on first choice and reuses it for the next mission". No mutation targeted C2 separately.
- **Reproduced:** by a fresh-context agent that did not see the implementation, from this file alone. It got 61 passed and 2 skipped, typecheck and check passed, M1 to M6 failed 2, 3, 2, 1, 1, and 1 checks, and the restored tree passed 61. Everything matched.

### C7

- **Check:** in the window, Haiku was chosen, the workspace was set to the repository copy through Choose folder…, and the mission was sent: "First, without reading any file, quote the first bullet under the Documents heading of your workspace instructions, and say your working folder. Then create NOTE.txt containing hello and commit it locally with git, message 'Add note'. Do not push."
- **Result:** the thread quoted the first `AGENTS.md` bullet (`documentation/outline.md`: what the system is for…) and named `/private/tmp/om-drive/home/OpenMission-copy`. In the copy, `git log --oneline -1` printed `b8a3c91 Add note`, `NOTE.txt` held `hello`, and the `questions` table was empty. Screenshot: [conversation-in-workspace.png](2026-11-06-workspace-batch/conversation-in-workspace.png).
- **Sandbox fit (open question, observed):**
  - `bun run check` and `bun run typecheck` ran sandboxed with no question.
  - `bun install` failed in the sandbox with "bun is unable to write files to tempdir: EPERM". It became a harness question ("Install dependencies outside sandbox after tempdir EPERM"), and after Allow it installed 500 packages.
  - `bun run test` failed in the sandbox because the Electron binary download was blocked ("fetch failed").
- **Shown able to fail:** a negative control is the first attempt. Launched with `HOME` set to a temporary folder, Claude Code could not reach its login ("Not logged in · Please run /login"), and the mission failed visibly.
- **Note:** the replies came in French. The account's own instructions apply even with `--setting-sources ""`; this is not caused by OpenMission.

### C8

- Screenshots: [folder-browser.png](2026-11-06-workspace-batch/folder-browser.png) and [conversation-in-workspace.png](2026-11-06-workspace-batch/conversation-in-workspace.png). The New folder field has no border. The owner's run-through is pending.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bun run test` | pass (45, 2 skipped; previous handoff) | pass (61, 2 skipped) |
| Typecheck | `bun run typecheck` | pass | pass |
| Lint and format | `bun run check` | pass | pass |
| Live Claude Code checks | `OPENMISSION_LIVE_CLAUDE=1 bun run test` | pass (previous session) | not run |

## Not proven

- C8: appearance needs the owner's eye.
- The live checks were not rerun. The live drive (C7) exercised the same adapter path.
- Restart-on-change of instruction files rests on the existing signature mechanism in `claude.ts`; it has no dedicated check.

## Reproduce

```sh
# From the repository root, with the batch committed:
bun run test && bun run typecheck && bun run check
git worktree add --detach /tmp/om-verify HEAD
for d in node_modules apps/app/node_modules apps/desktop/node_modules packages/service/node_modules packages/contracts/node_modules; do [ -e "$d" ] && ln -s "$PWD/$d" "/tmp/om-verify/$d"; done
documentation/verification/2026-11-06-workspace-batch/mutations.sh /tmp/om-verify
git worktree remove --force /tmp/om-verify
```

## New files

- `packages/service/test/workspaces.test.ts`
- `documentation/verification/2026-11-06-workspace-batch/mutations.sh`
- The screenshots listed above.
