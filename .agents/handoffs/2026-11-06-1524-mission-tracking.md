# Handoff: batch 9 mission tracking awaiting interaction verification

Supersedes: `2026-11-06-1454-choose-batch-9.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish behavior verification of batch 9 (mission tracking), obtain the owner's acceptance, and record delivery. Implementation is ready for the remaining Electron interaction checks; visual polish is deferred.

## State

- Verified by reading CHG-0045 and Batch 9 in work-in-progress: mission tracking is agreed and implemented but no delivery or owner acceptance is recorded. Follow those sources for scope and provisional choices.
- Verified now by command output: `bun run test` passes 175 tests, with 5 opt-in live tests skipped; `bun run typecheck`, `bun run check`, and `bun run --filter desktop build` pass.
- Verified by reading the proof note: earlier mutation and screenshot evidence was recovered; it is not a fresh interaction drive. Dashboard ending actions were added on resumption and still require interaction verification, along with rename and workspace filtering.
- Verified by git status: implementation, tests, CHG-0045, work-in-progress, and verification artifacts are present on `main`, based on `63d4b15`. This handoff and that work are being committed and pushed at the owner's request; confirm the resulting revision with git log and origin/main.
- Assumed: the earlier Metro server on 8082 and Electron debug window on 9333 may still be running. Inspect before reusing them. This side thread cannot control desktop apps; continue that check in the main chat.
- Verified by git status: `.zcode/` remains untracked and is excluded from this commit.

## Decisions

- CHG-0045 and work-in-progress are the authoritative batch 9 behavior agreement and provisional decisions. Budget rings, the phone web app, and `find_missions` remain outside this batch.
- Visual polish is deferred by the owner, as recorded in the verification note. Remaining checks concern behavior.
- The current request authorizes a handoff, commit, and push. It does not establish batch acceptance.

## Next

1. In the main chat, check the dashboard row actions in Electron: Mark as done; cancel and confirm stopping active threads; Archive; Reopen from Archived and confirm return to the main dashboard. Check rename and workspace filtering. Follow the proof note's completion gap.
2. Record observed results in the proof and work-in-progress; fix and recheck any failures. Obtain the owner's acceptance before recording delivery.
3. Record the delivery following CHG-0045 only after the remaining checks and acceptance; then choose the next batch with the owner. Commit and push subsequent work only with authorization.
4. Stop test servers/windows when no longer needed, after checking which processes belong to these tests.

## Open questions

- Remaining interaction checks and owner acceptance are unresolved.
- Carry-over questions and provisional behavior are in work-in-progress and the superseded handoff; address them when a batch needs them.

## Sources

- `documentation/work-in-progress.md` (Batch 9 and Open questions)
- `documentation/changelog.md` (CHG-0045)
- `documentation/verification/2026-11-06-mission-tracking.md` and its sibling evidence directory
- `documentation/capabilities/mission-tracking/specifications.md`
- `documentation/capabilities/mission-journal/specifications.md`
- `apps/app/src/missionActions.tsx`, `apps/app/src/dashboard.tsx`
- `packages/service/src/ending.ts`, `packages/service/src/titles.ts`
- `packages/service/test/tracking.test.ts`, `packages/service/test/dashboard.test.ts`
- Repository: https://github.com/Dyrits/OPEN-MISSION
