# Handoff: the one side panel, with backup companions chosen in the panel itself

Supersedes: `2026-11-10-1342-backups-in-charter.md`
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `one-side-panel`, one commit (`CHG-0115`) ahead of `origin/main` when written

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

One side panel for a quest and its threads, grouped as Companions, Knows, and Does, with backup companions per thread edited in the panel itself (CHG-0109, CHG-0111, CHG-0115) and a default list in the Charter (CHG-0112). Done means the owner has looked at it in the running app and accepts it.

## State

- On `origin/main` (verified by the earlier push output, `7530eea`): the panel, its grouping, per-thread backups with fall-back, a side-quest's own panel and Mark as done, and the Charter's default backup list.
- Committed locally, not pushed when this was written (assumed; check `git status -sb`): CHG-0115. The Backup companions row now expands the list in place in the panel (`BackupsInline` in `apps/app/src/threadPanel.tsx`, the shared `apps/app/src/backupsEditor.tsx` with an `isBare` option and a header of number, move up, move down, Remove above the pickers); the full-screen `BackupsScreen` (`backups.tsx`) is deleted.
- Verified now: Biome, `bun run typecheck` (0 errors), and the app's 117 tests pass. Observed in a browser on the fake harness: adding, moving and removing backups in the panel, no "← Back" link, and the count after a reload (`documentation/verification/2026-11-10-one-side-panel/8-backups-in-panel.png`, `drive-inline.py`). The service tests were not rerun for this change (no service change).
- Not checked: the list in a narrow window; the look; a live harness falling back.
- Another session works on this branch at the same time (steps in conversations, CHG-0113 and CHG-0114, committed; more uncommitted in `conversationEntries.tsx`, `entries.ts`, `styles.ts`, `rowIcons.tsx`). My changelog number was moved to CHG-0115 for that reason. Stage only your own files.
- Untracked and left: `.tmp.md`.

## Decisions

- Backups are chosen directly in the sidebar, not in a full screen (the owner).
- The one panel stays the window-level right-hand one; backups are per thread with effort included; the Charter's list is only a starting copy.
- A side-quest's Mark as done is its own and leaves the quest alone.

## Next

1. Push CHG-0115 to `main` once the owner allows it.
2. Ask the owner to look at the panel with the list open, the Charter card, and a side-quest's panel; OpenBot's "Ask before switching" and returning to the first Companion after a limit ends are not built.
3. Look at the bookmark covering the end of the top rows when the panel scrolls.

## Open questions

- Should a thread ask before switching to a backup, and switch back when the limit ends? The owner answers.

## Sources

- `documentation/capabilities/thread-panel/specifications.md`, `documentation/changelog.md` (CHG-0109, CHG-0111, CHG-0112, CHG-0115)
- `documentation/verification/2026-11-10-one-side-panel.md`
- `apps/app/src/{threadPanel,backupsEditor,questPanel,settings}.tsx`
