# Handoff: steps instead of update lines, with the actions folded in

Supersedes: `2026-11-10-1355-steps-instead-of-updates.md`
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `one-side-panel`, pushed to `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A working thread shows its provider's mark and current step; a finished turn folds its replies and the actions it ran into one collapsible "N steps · Ns" group, and only the final reply stands (CHG-0113, CHG-0116). Done means the owner has looked at it in the running app and accepts it.

## State

- CHG-0113 (steps from agent replies) is on `main` (pushed as `4d70432`, verified by the push output).
- CHG-0116, committed after it: settled actions (Ran, Allowed, Always allowed, Allowed by a standing permission or by message) fold into the group in time order via `Step` in `apps/app/src/entries.ts`; Denied, Discarded, and Withdrawn stay as lines; the working indicator shows the latest step (`workingLabelOf`). Verified when written: typecheck, Biome, and 118 app tests passed.
- Not checked: the look in the running window; a live turn with several replies and actions; a small `alignItems` tweak to `stepsList` in `apps/app/src/styles.ts`, left uncommitted because that file also holds another session's edits.
- Untracked and left alone: `.tmp.md`. `rowIcons.tsx` and `styles.ts` carry another session's uncommitted work.

## Decisions

- Client-only grouping, no schema change: steps derive from saved replies and settled questions.
- A denied, discarded, or withdrawn action stays visible, since it may need the owner's attention; the owner may ask to fold it.
- A turn's duration runs from the message that began it to its last step.

## Next

1. Ask the owner to look at a real turn: the indicator, the folded group, and its listed steps.
2. Fold Denied lines too if the owner wants; style the action lines left-aligned inside the group.

## Open questions

- Should the group open while the turn works? The owner answers.

## Sources

- `documentation/changelog.md` (CHG-0113, CHG-0116)
- `apps/app/src/entries.ts`, `apps/app/src/conversationEntries.tsx`, `apps/app/test/entries.test.ts`, `apps/app/src/questions.tsx`
