# Handoff: batch 5 built, thread tree core, awaiting the owner's look

Supersedes: `2026-11-06-0712-autonomous-threads.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Batch 5 (thread tree core, CHG-0037) delivered: threads open threads beneath them, report results, message parent and children, and the owner follows and steers them in a side tree. Done when the owner accepts the side tree and the Delivery is recorded in the changelog.

## State

- Batch 4 is delivered (CHG-0036) after an agent's run-through at the owner's request. Fixed during it: the conversation follows new entries, Always allow saves the sensitive list's label, and the Permissions history shows one-line mission titles. Proof: `documentation/verification/2026-11-06-batch-4-drive.md`. Verified by reading the changelog and the proof.
- Batch 5 is agreed (CHG-0037), built test-first, and driven in the window; its behavior, provisional choices, and checks are in `documentation/work-in-progress.md` (Batch 5). Proof: `documentation/verification/2026-11-06-thread-tree.md`. Verified by reading both.
- New code: `packages/service/src/tree.ts` (opening, depth and running limits, reach, results, relaxing Waiting parents), `waker.ts` (lets the tool server start turns), migration `0007_thread_tree` in `store.ts`, the thread tools in `mcp.ts`, Waiting/Done/Stopped rules and background wakes in `threads.ts`, `OpenThread`, `ResumeThread`, and `ReadMission { threadId }` in `packages/contracts/src/index.ts`, and the side tree in `apps/app/src/threadTree.tsx` with `conversation.tsx`.
- `OPENMISSION_LIVE_CLAUDE=1 bun run test` passed 89 of 89; `bun run typecheck`, `bun run check`, and the desktop build passed. Verified by command output at about 08:30. Eight mutations each failed at least one check in a disposable worktree (`documentation/verification/2026-11-06-thread-tree/mutations.txt`).
- Not judged by the owner: the side tree's layout and wording. The Finder dialog itself has never been clicked by an agent (no accessibility access); the desktop notification is unobserved.
- Committed and pushed with this handoff. Assumed until `git log origin/main` shows it.

## Decisions

- Batch 5 scope "Tree core", view "Side tree + chat", and hooks "Tell threads": recorded in CHG-0037.
- `open_thread` takes an optional short title; `report_result` takes the result text. Made after the first drive showed request-length titles; recorded in the thread-tree and thread-messaging specifications' tool tables and in the proof.
- Provisional choices listed in work-in-progress (Batch 5, Provisional): Waiting becomes Idle on startup; a top thread's result only marks it Done; thread messages arrive at the next turn; no phone layout for the tree.
- Driving the window: Metro must run without `CI=1` to pick up edits; Playwright clicks stall while the Electron window is behind others, so focus it through the main-process inspector first (see the batch 5 proof, Notes).
- Carried over: code follows `documentation/conventions.md`; work proceeds in batches; pushes to `main` need the owner's approval, given for this push ("When finished, hand-off, commit and push.").

## Next

1. Ask the owner to look at the side tree (`bun run dev`, open a mission whose thread opens threads) and accept it, or say what to change.
2. On acceptance, append the batch 5 Delivery (next CHG number) and mark batch 5 delivered in work-in-progress.
3. Choose batch 6 with the owner from the staged thread-tree and thread-messaging items (folding agent threads, deleting, interrupts, mid-turn steering, the chatter guard, journal in starting context) or the backlog.

## Open questions

- Whether a workspace should load its own Claude Code settings and skills (`--setting-sources project`). Owner decision; carried over.
- How the side tree should look on a phone. Owner decision, when phone work starts.
- Carried over: `.zcode/` left untracked, a narrower environment for Claude Code, the packaged desktop build, and the questions at the end of `documentation/work-in-progress.md`.

## Sources

- `documentation/changelog.md` (CHG-0036, CHG-0037)
- `documentation/work-in-progress.md` (Batch 4, Batch 5)
- `documentation/verification/2026-11-06-batch-4-drive.md`, `documentation/verification/2026-11-06-thread-tree.md`
- `documentation/capabilities/thread-tree/specifications.md`, `documentation/capabilities/thread-messaging/specifications.md`
- `packages/service/test/threads.test.ts`, `packages/service/test/claude.test.ts` (live block)
- Repository: https://github.com/Dyrits/OPEN-MISSION
