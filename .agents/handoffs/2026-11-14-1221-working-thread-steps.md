# Handoff: a working thread's tool calls as steps

Supersedes: none
Workspace: ISKIOS repository, branch `main` (original checkout `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`); the task branch `worktree/working-detail` and its worktree `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS-working-detail` still exist

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner saw threads showing only "Working…" and asked for more information. They chose to show the tool calls as lines of the turn's Steps group, for most of what the thread does. Done means the owner has seen it in a window on a live Claude Code thread and accepts the lines, and the in-progress call and the other harnesses are settled.

## State

- Built for Claude Code and committed on `main` as `eedfa29` (CHG-0276 in `documentation/changelog/0.1.3-Prototype.md`): `packages/service/src/harness/claude.ts` reads `tool_use` blocks of complete assistant messages and emits a `ToolCall` event; `work/turns.ts` saves it (`saveTurnActivity`) in the new `thread_activities` table (migration `0047_thread_activities`); `work/activities.ts` words each call (`describedCall`) and lists them; `missionDetail` returns `activities`; `StepsGroup` in `apps/app/src/conversation/conversationEntries.tsx` draws each as `Ran · <kind> · <target> · <time>`. A call that also reached the permission prompt is marked by its call id (`markPrompted`, from `answer_prompt`'s `tool_use_id`) and shows once, as its action. The approval and prompt tools are left out. Specification: "What a working thread is doing" in the action-approval specification.
- Verified: on the branch before the rebase, typecheck, Biome and the whole suite passed (1530 passed, 14 skipped). On `main` after the rebase onto CHG-0275: the commit hook's typecheck and related tests passed (1012 passed, 10 skipped), the other groups of the full run passed, and the four files that cannot run inside the agent's sandbox (terminals, update swap, OpenCode harness and sandbox tests) passed outside it (123 tests).
- Not verified: a live Claude Code turn (only the stand-in process emits tool calls in tests), the look in a window, the phone build.
- Not done: marking the call in progress as running, a live label in the working indicator (`workingLabelOf` still returns "Working…"), Codex and OpenCode (their events are not probed), and any limit on how many lines a long turn stores.
- Push: asked for by the owner. Check `git status -sb` and `git log origin/main` for whether `eedfa29` and this handoff reached `origin/main`.
- The worktree `ISKIOS-working-detail` holds the same change uncommitted, with its own `node_modules`; its `return-destination` file is in `.git/worktrees/ISKIOS-working-detail`. It can be removed once the owner agrees.

## Decisions

- Tool calls are stored as their own records, not as approval questions, so the Permissions page history and standing permissions are untouched; the owner asked for the lines inside the existing Steps group.
- A call and its prompt are joined by the harness call id, in either arrival order, with one table row marked as prompted.
- A line holds a kind in plain words and one short target, never output or content.
- The new migration is numbered 0047 and the entry CHG-0276; both were free on `main` when landed.

## Next

1. Confirm with the owner that the push happened, and ask them to watch a live Claude Code thread: do the lines appear while it works, and is the target text useful and short enough.
2. Mark the newest call of a working turn as running and put it in the working indicator, if the owner wants it (change `workingLabelOf` in `apps/app/src/conversation/entries.ts` and its test, which now asserts "Working…").
3. Probe Codex and OpenCode events for tool calls and add them behind the same `ToolCall` event.
4. Decide whether a long turn needs a cap on stored lines, or a "show more" in the group.
5. Remove the worktree and branch once the owner agrees.

## Open questions

- Whether the steps group should open by default while the thread works (owner).
- Whether paths and commands may stay visible in lines on a paired phone (owner).

## Sources

- `documentation/changelog/0.1.3-Prototype.md` (CHG-0276), `documentation/capabilities/action-approval/specifications.md` (What a working thread is doing).
- `packages/service/src/work/activities.ts`, `packages/service/src/work/turns.ts`, `packages/service/src/harness/claude.ts`, `packages/service/src/core/recentStoreMigrations.ts`, `apps/app/src/conversation/entries.ts`, `apps/app/src/conversation/conversationEntries.tsx`.
- Tests: `packages/service/test/harness/claude.test.ts`, `apps/app/test/conversation/entries.test.ts`, `packages/service/test/fixtures/stand-in-claude.mjs`.
