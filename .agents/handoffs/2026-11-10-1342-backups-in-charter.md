# Handoff: the one side panel, backup companions, and their default list in the Charter

Supersedes: `2026-11-10-1345-companions-backups.md`
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `one-side-panel`, on top of `origin/main` at `9530ec1`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

One side panel for a quest and its threads, grouped as Companions, Knows, and Does, with backup companions per thread (CHG-0109, CHG-0111) and a default list of them in the Charter (CHG-0112). Done means the owner has looked at them in the running app and accepts them.

## State

- Pushed to `origin/main` (`9530ec1`, verified by the push output): the one side panel, the Companions, Knows, and Does grouping, backups per thread, a side-quest's own panel and Mark as done (CHG-0111). The working tree's other session's harness-update work (CHG-0110) is in `main` already (`e095bfc`).
- Committed locally, not pushed when this was written (assumed; check `git status -sb`): the Charter's **Backup companions** card (CHG-0112): `Settings.backups`, a new quest's thread starting with a copy of it, a side-quest copying its parent's list, the shared editor `apps/app/src/backupsEditor.tsx`, and `BackupsScreen` (`apps/app/src/backups.tsx`) now using that editor.
- Verified now: `bun run typecheck`, `bunx biome check .`, and `bun run test` (602 passed, 10 skipped) pass in this tree; `packages/service/test/defaultBackups.test.ts` and `backups.test.ts` pass. The Charter card was observed in a browser by the side-quest that built it (`documentation/verification/2026-11-10-charter-backups/`).
- Not checked: the thread's backup menu in the window after it moved to the shared editor; a new quest's own panel showing the copied list; Move up and Move down in the thread menu; a live harness falling back; the look.
- A local worktree at `/tmp/claude-501/wt-panel` was used to rebase and push; remove it with `git worktree remove --force /tmp/claude-501/wt-panel` when done (it is outside the repository).
- Untracked and left: `.tmp.md`, `.agents/handoffs/2026-11-10-1308-guildmaster-links-and-sidebar.md`.

## Decisions

- The one panel stays the window-level right-hand one, restyled in its rows and labels; the owner's words were about categories and Skills, not rounding.
- Backups are per thread, with effort included, as a Ritual's fallbacks; a Ritual's own list runs first. The Charter's list is only a starting copy: later changes leave existing quests alone.
- A side-quest's Mark as done is its own and leaves the quest alone.

## Next

1. Push the Charter commit to `main` once the owner allows it.
2. Ask the owner to look at the panel, the backup menu, the Charter card, and a side-quest's panel; compare OpenBot's "Backup models" ("Ask before switching" and returning to the first Companion after a limit ends are not built).
3. Look at the bookmark covering the end of the top rows when the panel scrolls.

## Open questions

- Should a thread ask before switching to a backup, and switch back when the limit ends? The owner answers.

## Sources

- `documentation/capabilities/thread-panel/specifications.md`, `documentation/capabilities/thread-tree/specifications.md`, `documentation/changelog.md` (CHG-0109, CHG-0111, CHG-0112)
- `documentation/verification/2026-11-10-one-side-panel.md`, `documentation/verification/2026-11-10-charter-backups/`
- `apps/app/src/{questPanel,threadPanel,rowIcons,backups,backupsEditor,settings}.tsx`, `packages/service/src/{backups,settings,missions,tree}.ts`, `packages/service/test/{backups,defaultBackups}.test.ts`
