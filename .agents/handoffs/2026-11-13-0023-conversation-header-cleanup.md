# Handoff: Conversation header cleanup

Supersedes: none
Workspace: ISKIOS, main

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Simplify quest and Iskios conversation headers and publish the approved changes. Confirm their appearance in the running app.

## State

- Verified by commit output: `33d0f96` implements the UI batch, starting at `22ac07b`.
- Verified by commands: workspace typecheck, Biome, and diff whitespace checks pass. The earlier full suite recorded 1319 passes, 14 skips, and five service failures; see work in progress for details. No live UI check was run.
- Verified by fetch: remote main is `861e64b`; this branch still needs reconciliation before publication.
- Verified by read-only Git inspection: the original checkout at `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS` is on main at `fbf830b` and contains untracked `documentation/architecture-audit/architecture-audit-2026-11-12-2245.html`. Local sync is blocked by that dirty destination; leave the file untouched.
- Owner reported runtime SVG errors in the sidebar and plan-limit rings; the actual error message was elided. Not diagnosed or fixed in this batch.

## Decisions

- Main quests only get the tiny existing Archive image beside their state dot; side-quests and Rituals do not. Archive uses the existing preview and active-work confirmation, never deletion.
- Remove the standalone Delete button, header Lore and Iskios budget. Keep budget enforcement and stop recovery.
- Open side-quest becomes an icon beside the input. Conversation state becomes a colored dot with an accessible label; sidebar badges are unchanged.

## Next

1. Ask the owner to account for the original checkout's untracked report before local synchronization.
2. Rebase this branch's UI and handoff commits onto the current remote main, preserving both threads' documentation. Recheck the three-newest-handoffs pointer rule.
3. Run workspace typecheck, Biome, and diff checks after reconciliation. Synchronize the clean original main and publish to origin/main only under the owner's landing authorization.
4. Verify the header appearance and archive/side-quest interactions in the running app.

## Open questions

- The owner must decide how to preserve the untracked architecture-audit report in the original checkout.
- Obtain the unelided runtime error to diagnose sidebar SVG warnings.

## Sources

- `33d0f96`
- `apps/app/src/conversation/conversation.tsx`
- `apps/app/src/conversation/guildmaster.tsx`
- `apps/app/src/ui/controls.tsx`
- `apps/app/src/quests/missionActions.tsx`
- `documentation/work-in-progress.md`, Conversation header cleanup
- `documentation/changelog.md`, Conversation header cleanup
