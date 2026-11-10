# Handoff: compact left navigation and conditional quest tree

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Give the conversation more room with a compact main left menu and no quest tree column when the quest has no side-quests.
The remaining work is to verify the appearance and navigation in the running app and obtain the owner's visual acceptance.

## State

- Verified by reading source and `git show HEAD`: the main menu defaults to 220px, resizes down to 200px, collapses to 60px, and uses 15px labels, smaller icons and crests, and tighter rows.
- Verified by reading `conversation.tsx`: the tree column appears only when any side-quest exists, including folded or finished children; without it, narrow screens retain Back to quests in the conversation.
- Verified by Git history and committed files: implementation, agreements CHG-0123 and CHG-0124, and the original proof are in `51d4ceb`, the source-folder reorganization commit, already on `origin/main` when this handoff was written.
- Assumed from the preceding session's command results: lint, workspace typecheck, 132 app tests, and web export passed; the full suite hit localhost `EPERM` in the sandbox.
- Verified by reading CHG-0125: the reorganization session records a later full-suite run with four workers (647 passed, 10 skipped); this navigation session has not independently rerun it.
- Verified by reading the proof: no browser check or screenshot is claimed; the owner has not accepted the final appearance.
- Assumed: the installed app still shows its previous build, because this session has not rebuilt or installed it.
- Verified by `git status`: unrelated consumption-and-cost documentation edits and `.tmp.md` remain in the checkout; they are outside this handoff's commit.

## Decisions

- The owner accepted the smaller main left menu, with collapse and resize controls retained (CHG-0123).
- The owner accepted keeping the quest tree on the left and hiding its entire column only when no side-quests exist (CHG-0124).
- Right-panel tabs were proposed but not accepted; the right details panel keeps its existing behavior.
- Existing saved menu widths remain respected; a user with an old saved width can resize it to the new smaller range.
- The owner explicitly requested this shared handoff, a commit, and publication to `main`.

## Next

1. Verify the remaining layout and interaction cases in `documentation/verification/2026-11-10-compact-navigation.md` on a throwaway database, using the current source.
2. If needed for that check, rerun the full suite with local networking and four workers, as recorded in CHG-0125; report any failure before investigating further.
3. Rebuild the installed app if the owner wants to review this change there, then have the owner judge the menu proportions and conversation space.
4. Record the observed evidence and acceptance; any later handoff supersedes this file.

## Open questions

- The owner must judge the final appearance; automated checks cannot settle the proportions.
- A browser check remains outstanding: Aside's selected profile was not connected, and the proposed Playwright fallback was not run.

## Sources

- `apps/app/src/shell/railStorage.ts`
- `apps/app/src/shell/sidebar.tsx`
- `apps/app/src/conversation/conversation.tsx`
- `documentation/capabilities/mission-tracking/specifications.md` (Compact left navigation)
- `documentation/capabilities/thread-tree/specifications.md` (Quest tree visibility)
- `documentation/verification/2026-11-10-compact-navigation.md`
- `documentation/work-in-progress.md` (Compact left navigation specification)
- `documentation/changelog.md` (CHG-0123, CHG-0124, CHG-0125)
- Commit `51d4ceb` on `main`
