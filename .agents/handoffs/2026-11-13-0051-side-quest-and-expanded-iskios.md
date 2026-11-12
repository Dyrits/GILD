# Handoff: Side-quest controls and expanded Iskios

Supersedes: none
Workspace: ISKIOS, branch `main`, Delta worktree `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS/.delta/worktrees/sjqacxeagf1g/ISKIOS`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish acceptance of the side-quest controls and expanded Iskios behavior recorded in CHG-0246 to CHG-0249, and diagnose the recurring sidebar rendering errors separately. Complete the requested local sync and remote publication without losing other threads' work.

## State

- Verified now by Git status, history, and diff: the implementation is one local commit, `a3a12bb` before this handoff is amended into it, based on published `6d91ede`. The earlier Companions-tab work is now in that base (`514db9f`); it had originally stayed uncommitted in its own thread, not been overwritten by the header cleanup.
- Verified by source reads and diff: the side-quest action is after Send; the draft uses the shared Companion button; Cancel is a red ✕; expanded Iskios has no 900 px width cap; sidebar navigation restores it; expanded mode hides the underlying page's highlight and Quest tab, restricts Companions to Iskios, and omits hidden-page viewing context. See the changelog for behavior details.
- Recorded verification from this session: `bun run check`, `bun run typecheck`, and `git diff --check` pass. `bun run test apps/app --reporter=dot` passes with 323 tests and 4 skips. The new viewing-context test was observed failing before the fix; the new scope tests pass. No full workspace suite or live browser interaction was run for this batch. These claims are recorded results, not checks rerun while writing this handoff.
- Verified now: `origin/main` and the original checkout's `main` are at `6d91ede`; the original checkout is clean. Its path is `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`; its Git directory matches this clone's `local` backlink. Other linked worktrees must remain untouched.
- Publication and local sync are not yet verified as this file is written. The user authorized committing and pushing to main with `--no-verify`. The original checkout is outside the attached workspace; attach it or obtain explicit direct-edit authorization before changing it. Re-read all three refs before continuing.
- Unresolved: repeated development logs show stacks in `Heading` (`shell/sidebar.tsx`) and SVG `WebShape` through `editors/planLimitRings.tsx`. The actual error text is missing in Bun's elided output. No reproduction, cause, or fix has been established.

## Decisions

- Keep this thread's work in one commit by amending it, as the owner requested. Once it is published, obtain explicit authorization before rewriting published history.
- Iskios expanded in the main panel is the active context, not the quest behind it. Docked Iskios retains the context of the visible neighboring page.
- Reuse the Companions selector for side-quest drafts; draft changes must not mutate the parent thread.
- Preserve the accepted Companions implementation and header cleanup already in the base. Do not recreate or overwrite either.
- The rendering stacks do not establish their error causes; capture the complete messages before changing behavior to address them.

## Next

1. Check current local, original-checkout, and remote refs and whether publication completed. If remote main has the amended batch, do not push it again.
2. Complete local sync only after workspace permission is settled: attach the original checkout or obtain explicit permission to update it directly. Recheck that it is clean and fast-forward its main to the exact published commit; stop on new local work or divergence.
3. Verify in the running app: open and cancel a side-quest draft; choose its model and effort and send it without altering the parent; expand Iskios from a quest with the quest's Companion selected; check its full width, Iskios-only Companions and backups, no Quest tab, and restoration on sidebar navigation, including choosing the current destination again. Check narrow-window behavior.
4. Capture unelided rendering errors. Running the desktop dev script directly from `apps/desktop` rather than through the workspace-filter output may expose the missing messages; inspect its current command first. Use isolated application data for any independent reproduction. Diagnose and add regression coverage before fixing.
5. Record live evidence and unresolved acceptance in work-in-progress. The reported errors are not fixed by the layout changes.

## Open questions

- Does the owner accept the final live layout and interactions? Screenshots confirmed intermediate appearances, not all final behavior.
- What are the actual `Heading` and SVG error messages, and can they be reproduced on isolated data?
- Will the owner attach the original checkout or authorize its direct update?

## Sources

- `documentation/changelog.md`, CHG-0246 to CHG-0249; `documentation/work-in-progress.md`, expanded Iskios and side-quest entries.
- `apps/app/src/ui/controls.tsx`, `apps/app/src/conversation/threadTree.tsx`, `apps/app/src/conversation/guildmaster.tsx`.
- `apps/app/src/shell/shell.tsx`, `apps/app/src/shell/companionScope.ts`, `apps/app/src/shell/viewing.ts`; corresponding tests under `apps/app/test/shell/`.
- Existing header-cleanup context: `.agents/handoffs/2026-11-13-0023-conversation-header-cleanup.md`.
- Original Companions thread: `delta://thread/ksQQLI1c1e8sTgyg4Iyw0zuqw5LNolKSAcQQ-B29l40ESxaJQfbrrg7pjA`.
