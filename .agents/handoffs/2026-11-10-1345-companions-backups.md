# Handoff: the one side panel regrouped, backup companions, and a side-quest's own panel

Supersedes: `2026-11-10-1321-one-side-panel.md`
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `one-side-panel` (on top of `main` at `428f2b3`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

One side panel for a quest and its threads (CHG-0109), grouped like OpenBot's agent panel at the owner's request (CHG-0111): Companions, Knows, Does; backup companions chosen in a menu of their own; and a side-quest panel that names its quest and can be marked done alone. Done means the owner has looked at it in the running app and accepts it.

## State

- Built and committed on `one-side-panel` (CHG-0111, one commit after `f3497fe`). Verified: `bun run typecheck`, `bunx biome check .`, and `bun run test` (599 passed, 10 skipped) pass in the working tree, which also held another session's uncommitted harness-update work; `packages/service/test/backups.test.ts` (4 tests) passes.
- Panel: `apps/app/src/questPanel.tsx` (`Group`, `Row` with icons and chevrons, `QuestSidebar`, `ThreadSections`), `threadPanel.tsx` (builds Companions, Knows, Does rows and `SideQuestDone`), `rowIcons.tsx` (icons). Skills is one row that expands a block of names. Verified by screenshots in `documentation/verification/2026-11-10-one-side-panel/`.
- Backups: contracts `BackupCompanion`, `ThreadPanel.backups`, `SetThreadBackups`; service `backups.ts` (`setThreadBackups`, `fallBackToBackup`, `resetBackupStep`), migration `0031_thread_backups` (`threads.backups`, `threads.backup_step`), the failure path in `threads.ts`; menu `apps/app/src/backups.tsx` (`BackupsScreen`). Fall-back proven on the fake harness (`backups.test.ts`); the menu adding a backup observed in the window. Not checked: Move up and Move down, a live harness falling back, the menu in a narrow window.
- Side-quest: `MarkThreadDone` (`lifecycle.ts` `markThreadDone`) stops the turn, sets Done, relaxes parents, and refuses a quest's top thread. Observed in the window: the side-quest became Fulfilled and the quest stayed Resting.
- Not mine and left alone: another session's uncommitted work in the same tree (`UpdateHarness`, `harnessVersions.ts`, CHG-0110, accounts and Charter files). I committed only my hunks of the shared files (`requests.ts`, `service.ts`, `documentation/changelog.md`); the working tree still holds both.
- Push: committed locally; the push to `origin/main` was not made when this was written (approval tool was unavailable). Check with `git status -sb`.
- Untracked and left: `.tmp.md`, `.agents/handoffs/2026-11-10-1308-guildmaster-links-and-sidebar.md`.

## Decisions

- The one panel stays the window-level right-hand one (parchment, gilt frame), restyled in its rows and labels; the owner's later words were about categories and Skills, not rounding.
- Backups are per thread, as a Ritual's fallbacks, with effort included (the owner: "not just the model but also the effort level"); a Ritual's own list runs first.
- A side-quest's Mark as done is its own and leaves the quest alone; the quest's Mark as done and Archive stay in the quest's panel.

## Next

1. Push `one-side-panel` to `main` once the owner allows it, after confirming the other session's work is not mixed into the commit (`git show --stat HEAD`).
2. Ask the owner to look at the panel, the backup menu (compare OpenBot's "Backup models": an "Ask before switching" toggle and a return to the first Companion after a limit ends are not built), and a side-quest's panel.
3. Look at the bookmark covering the end of the top rows when the panel scrolls.

## Open questions

- Should a thread ask before switching to a backup (OpenBot's toggle), and should it switch back when the limit ends? The owner answers.
- The side-quest panel shows the quest's state in its header line, not the side-quest's own; fine, or should it show the side-quest's?

## Sources

- `documentation/capabilities/thread-panel/specifications.md`, `documentation/capabilities/thread-tree/specifications.md`, `documentation/changelog.md` (CHG-0109, CHG-0111)
- `documentation/verification/2026-11-10-one-side-panel.md`
- `apps/app/src/{questPanel,threadPanel,rowIcons,backups,conversation}.tsx`, `packages/service/src/{backups,lifecycle,threads,threadPanel,handover,store}.ts`, `packages/service/test/backups.test.ts`
