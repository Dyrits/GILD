# Handoff: Ordinary actions asking permission (workspace worktrees inside the sandbox)

Supersedes: none
Workspace: ISKIOS repository, branch `main` (checked out at `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Threads in the Iskios realm must not ask permission on ordinary work; at the default level "Sensitive actions only" only escapes from the sandbox, changes outside the thread's folder, and unprotected harnesses ask (CHG-0208). Done means the owner has worked in a running window, with a Claude Code thread in a worktree of the repository, and saw no questions for ordinary commands and edits.

## State

- **Cause (recorded in CHG-0273, from the app's own approval history, aggregate counts only):** the default-level logic works (61 harness actions ran unasked on 2026-11-14). The 36 questions that day came from threads working in git worktrees beside the checkout (`../ISKIOS-<branch>`): Claude Code's sandbox writes only the thread's folder, so commands there asked as "Run outside the sandbox" (22) and edits as "Change a file outside the workspace" (14). Always allow saves an exact command only, so it could not help. Not causes: sandbox availability, link or real-path checks on `/Volumes/APFS-G-DRIVE`, the approval level.
- **Built (CHG-0273):** `packages/service/src/harness/worktrees.ts` lists the repository's linked worktrees (`git worktree list --porcelain`), only when the thread folder is the repository's top folder, dropping missing, prunable, bare, linked, real-path-mismatched ones and the one that holds the workspace. Claude Code's sandbox `allowWrite` is the cache folders plus those worktrees, and the list is in the restart key. The edit check (`policy/containment.ts`, `work/approvals.ts`) takes a list of folders (`editFolders`). Thread instructions (`harness/instructions.ts`) say not to escape for work in the folder or its worktrees and to make worktrees as `.worktrees/<name>` or in `$TMPDIR`. `.gitignore` and `biome.json` ignore `.worktrees/`. The action-approval specification and the 0.1.3 changelog are updated.
- **Verified by the side-quest, reported to me, not re-run by me:** test-first red then green for `worktrees.test.ts`, `containment.test.ts`, `approvals.test.ts`, `claude.test.ts`, `instructions.test.ts`; `bun run check` and `bun run typecheck` clean; service suite 854 passed; 24 OpenCode Seatbelt tests fail only inside the agent's own sandbox (nested `sandbox-exec` refused) and pass (109 of 109) outside it. Verified by me now: the changed and new files are those listed under Sources (`git status`).
- **Not verified:** a live Claude Code run in a worktree (only the stand-in process); Codex and OpenCode, whose sandboxes are unchanged (their commands in a worktree still ask; the shared edit check does count worktree files); the owner's window.
- **Landing:** the owner asked for a commit and a push on `main` at the end of this session; read `git log` and `origin/main` for whether it happened.
- **Still asking by design:** another project's folder (such as the security-audit skill folder), killing processes, git fetch and push over SSH (the sandbox's network goes through an HTTP proxy only). A worktree created beside the checkout mid-turn: its commands ask until the next message restarts the process; edits do not.
- Local, not in git: untracked `.expo/` with throwaway data. The earlier `0272` change number is used in the stop-button worktree's changelog, so this change is `0273`.

## Decisions

- Only the repository's own linked worktrees widen the writable area, re-read at each start and each edit; an unrelated sibling folder, another repository's worktree, a thread's own copy, a subfolder and a link still ask. Recorded in CHG-0273 and the action-approval specification; the owner should review it as a widening.
- Git over SSH in the sandbox stays out; no network path is widened now.
- Scratch worktrees belong in `.worktrees/<name>` or `$TMPDIR`, not beside the checkout (instructions).

## Next

1. Ask the owner to restart the app, work with a Claude Code thread in an existing sibling worktree (git, `bun run check`, edits), and confirm no questions, only log lines; then record the result in a verification file.
2. If questions still appear, read the question lines in the Permissions page history for the kind and the command, and check whether they are the by-design cases above.
3. Decide with the owner whether Codex and OpenCode need the same worktree rule (their sandboxes do not write worktrees today; no questions from either appeared in the history).
4. Optionally, with the owner's agreement, a way for git over SSH to work in the sandbox, or a push-and-fetch habit over HTTPS.

## Open questions

- Does the owner accept the widened writable area? Only the owner can answer.
- Should Codex and OpenCode get the worktree rule? Depends on whether the owner uses them in worktrees.

## Sources

- `documentation/changelog/0.1.3-Prototype.md` (CHG-0273); `documentation/capabilities/action-approval/specifications.md`
- `packages/service/src/harness/worktrees.ts`, `claude.ts`, `claudeArgs.ts`, `instructions.ts`; `packages/service/src/policy/containment.ts`; `packages/service/src/work/approvals.ts`
- Tests: `packages/service/test/harness/worktrees.test.ts`, `instructions.test.ts`, `claude.test.ts`; `test/policy/containment.test.ts`; `test/work/approvals.test.ts`
- Earlier design: `.agents/handoffs/2026-11-12-1405-sandbox-review-follow-up.md`
