# Handoff: changing a thread's Companion while it works

Supersedes: none
Workspace: ISKIOS repository, branch `main` (checkout `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner could not change a working thread's Companion (harness, account, model, effort). They want to change it at any time, with the running turn finishing as it was and the next turn running on the new Companion automatically. Done means the owner has seen it in a window and accepts it.

## State

- Built and committed together with this handoff (CHG-0278 in `documentation/changelog/0.1.3-Prototype.md`; behavior in the "When" bullet of `documentation/capabilities/thread-handover/specifications.md`). Check `git log` and `git log origin/main` for whether the commit reached `origin/main`.
- Service: `changeThreadRunner` in `packages/service/src/work/handover.ts` no longer refuses Running or Attention threads. New helpers there: `isRunnerChangedSince` (used in `threads.ts`: a failed turn takes no backup or Ritual fallback when the owner changed the runner during it) and `isSessionOfThread` (used in `turns.ts` `completeTurn`: the finished turn's session is saved only if the thread's harness and account are still the turn's, otherwise the session is cleared). `endTurn` in `lifecycle.ts` now accepts a null session.
- App: the runner pickers (`RunnerPickers`) stay in the composer during a turn, in `apps/app/src/conversation/conversation.tsx` and `guildmaster.tsx`.
- Verified now in this session: new and changed tests pass (`handover.test.ts`: accepted in a turn, new harness gets a new session with the conversation, model change keeps the session; `backups.test.ts`: no fallback over the owner's choice, and red when the guard is removed; `presetStacks.test.ts`: a preset applies to a running thread). `bun run typecheck` and Biome passed.
- Verified: the full suite in the agent's sandbox gave 1,512 passed and 32 failed; the failures were the OpenCode Seatbelt tests (`harnesses.test.ts`), `apps/desktop/test/terminals.test.ts` and `apps/desktop/test/updates/swap.test.ts`, which need a process sandbox, a pty and disk images the agent's sandbox blocks. They were not rerun outside it for this change.
- Not verified: the look and behavior in a window, a live harness, a paired device, the phone build.
- Known gap (assumed from reading the code): while the old turn works, the working indicator (`WorkingIndicator harness={thread.harness}`) and a streaming draft may show the new Companion's mark.

## Decisions

- The change is accepted in any thread state; it changes the thread's stored runner at once, and the running turn keeps the runner it was admitted with. The handover line is written when the next turn starts (existing `recordPendingHandover`), recorded in CHG-0278.
- If the turn fails after the owner's change, the thread stays Failed until Retry; no fallback replaces the owner's choice. Recorded in CHG-0278.
- A message sent during the turn is still steered into that turn on the old runner (unchanged); only messages that start a later turn use the new runner.

## Next

1. Confirm with the owner whether the commit reached `origin/main`, then ask them to restart `bun run dev`, start a turn, change the Companion while it works, and watch the next turn run on it.
2. Fix the working indicator and streaming draft to show the runner that is running the turn, if the owner sees the wrong mark.
3. Decide whether Attention with an open question should also allow the change (it does now) and whether the Companions tab (right-hand column) needs any change; it was not checked.

## Open questions

- Whether a message sent right after the change should wait for the next turn instead of joining the running one (owner).
- Whether the picker should say that the change applies from the next turn (owner).

## Sources

- `documentation/changelog/0.1.3-Prototype.md` (CHG-0278), `documentation/capabilities/thread-handover/specifications.md`.
- `packages/service/src/work/handover.ts`, `turns.ts`, `threads.ts`, `lifecycle.ts`; `apps/app/src/conversation/conversation.tsx`, `guildmaster.tsx`.
- Tests: `packages/service/test/work/handover.test.ts`, `backups.test.ts`, `presetStacks.test.ts`.
