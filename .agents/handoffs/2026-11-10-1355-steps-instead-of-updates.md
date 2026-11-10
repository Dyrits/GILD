# Handoff: steps instead of update lines in a conversation

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `one-side-panel`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A working thread shows its provider's mark and the current step, then folds the turn's intermediate replies into a collapsible "N steps · Ns" group and shows only the final reply, as OpenBot does (CHG-0113). Done means the owner has looked at it in the running app and accepts it.

## State

- Built: `entriesOf(detail, isWorking)` in `apps/app/src/entries.ts` makes a `Steps` entry from each run of agent replies (all but the last; all of the trailing run while the thread works; a reply with a quest link stays visible); `StepsGroup` and `WorkingIndicator` in `apps/app/src/conversationEntries.tsx`; used by `conversation.tsx` and `guildmaster.tsx`. Verified: typecheck, Biome, and the app tests (117, three new) passed when it was written.
- Behavior kept: with "Show replies as they're written" on, the streaming draft shows in place of the indicator.
- Not built: tool calls as steps (the service records none; it needs a harness step event, a stored record, and a contract change), so the "Pause for ten seconds" kind of step from OpenBot's screenshot is absent.
- Not checked: the look in the running window; a live turn with several intermediate replies.
- Also committed with it: dev-loop relaunch of Electron on service and main-process changes (CHG-0114), not run live.
- Untracked and left alone: `.tmp.md`.

## Decisions

- Client-only grouping, no schema change, because steps are derived from the saved agent replies.
- The duration runs from the message that began the turn to the last step.

## Next

1. Ask the owner to look at the working indicator and a folded group in a real turn.
2. If they want tool calls listed, design the step event and its storage (a specification change first).

## Open questions

- Should the group start open while the turn works, and should a finished turn with one step show a group? The owner answers.

## Sources

- `documentation/changelog.md` (CHG-0113, CHG-0114)
- `apps/app/src/entries.ts`, `apps/app/src/conversationEntries.tsx`, `apps/app/test/entries.test.ts`
