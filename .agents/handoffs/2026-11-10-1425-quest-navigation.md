# Handoff: Small quest navigation button

Supersedes: none
Workspace: Gild, /Users/dgerrits/Codelab/Dyrits/CANOPY; prepared from bfa955a for main.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Give opened quests dedicated information cards with only a small top-right navigation button using the existing quest sword emblem.
The appearance awaits the owner.

## State

Verified by source read: QuestButton uses Emblem sword with goldHi tint, and QuestLink has no left medallion.
Verified by diff: styles.ts gives the corner button a dark background and removes obsolete large-button styles.
Verified this session: bun run check and bun run typecheck pass; bun run test apps/app/test passes 118 tests.
The running app was not visually checked.
Standalone information cards and their entry tests were already committed at starting revision bfa955a.
Unrelated .tmp.md remains untracked and must stay excluded.
Verified by Git: main has a stale worktree registration at /private/tmp/gild-main-wt; the folder does not exist.
Commit and push were requested; check Git for their final status.

## Decisions

The owner wants no left icon and the existing quest icon at the top right, replacing the custom arrow.
Reuse Emblem sword, the same component as the Quests sidebar, for navigation on information and report cards.

## Next

1. Confirm the main commit and remote status.
2. Check the cards and navigation in the running app with the owner, including narrow layouts.

## Open questions

Does the final appearance satisfy the owner?

## Sources

- apps/app/src/conversationEntries.tsx
- apps/app/src/styles.ts
- apps/app/src/emblems.tsx
- apps/app/test/entries.test.ts
- documentation/capabilities/mission-coordination/specifications.md
- documentation/changelog.md, CHG-0117
