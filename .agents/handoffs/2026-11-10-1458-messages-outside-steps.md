# Handoff: messages outside steps

Supersedes: `2026-11-10-1410-steps-main.md`
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep all chat messages in normal cards, including intermediate agent replies, and reserve collapsible steps for process actions.
The owner clarified this behavior using a screenshot, accepted the correction, and requested a handoff, commit, and push.

## State

- Verified by diff: `entries.ts` always emits messages as normal entries and groups only settled actions; `conversationEntries.tsx` no longer draws replies as steps.
- Verified by test run: all 13 tests in `apps/app/test/entries.test.ts` pass, including message visibility during and after a turn and messages mixed with actions.
- Verified by commands: workspace typecheck, targeted Biome on the three changed files, and `git diff --check` pass.
- Repository-wide lint failed on unrelated work in progress, including chip editor and terminal files; those changes remain untouched.
- Starting commit: `90bb982`; this delivery is being committed on main and pushed at the owner's request, so check git for its final commit and remote state.
- Appearance in the running app has not been checked.

## Decisions

- The owner's latest clarification supersedes the earlier decision to fold intermediate replies.
- All messages stay visible while working and after completion; the steps group contains recorded settled actions only.
- Pending approvals and Denied, Discarded, or Withdrawn actions retain their existing separate presentation.
- No harness recording or contract changes were made; only actions already recorded by the service appear as steps.

## Next

1. Look at a live turn containing replies and actions to confirm the appearance matches the owner's screenshot correction.
2. If broader tool-call coverage is requested, inspect harness event recording before extending steps.

## Open questions

None for the agreed correction; live appearance remains unverified.

## Sources

- `apps/app/src/entries.ts`, `apps/app/src/conversationEntries.tsx`, `apps/app/test/entries.test.ts`.
- `documentation/changelog.md`, CHG-0118.
- `.agents/handoffs/2026-11-10-1410-steps-main.md`.
