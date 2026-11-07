# Handoff: batch 17 (the warning before a thread starts with too large a starting context) built and verified, uncommitted, awaiting the owner

Supersedes: `2026-11-07-0650-intel-proposals.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants an MVP fast and adjusts afterwards. For this session the owner said: "For now, we build, step by step and we verify it works. The look and feel will be adjusted later. Don't ask any question for this session, build what is next. I'll be AFK." The next intel batch (Tidy up intel) waits for routines, so an agent took the next candidate the previous handoff named, the starting-context warning (thread-tree, Opening a thread), then built, verified, and handed it off.

## State

- Verified by command output just before this handoff:
  - `bun run test` passed 311, with 5 opt-in live tests skipped.
  - `bun run typecheck`, `bun run check`, `git diff --check`, the desktop build, and `CI=1 bunx expo export --platform web` passed.
  - 13 of 13 mutations were caught in a separate copy; the new checks fail 8 of 9 on the batch 16 state (the ninth guards that a small thread still opens).
  - The window drive on the fake harness proved C4 of the proof.
- Batches 16 and 17 are both **uncommitted** on `b94771f`; the owner did not ask for a commit. `.zcode/` stays untracked.
- Not done: no fresh-context agent reran this proof.
- Not agreed or accepted by the owner: batches 12–17 and their provisional choices (CHG-0049, CHG-0051 to CHG-0055; work-in-progress, Batches 12–17).
- Not verified: live Claude Code threads for batches 10–17.
- No processes from this session are left running, and its `/tmp` copies are removed. The Metro and Electron instances on 8081, 8082, 9333, and 9334 were running before the session and were left alone.

## Decisions

- Provisional choices, listed in work-in-progress (Batch 17). The weightiest:
  - The service refuses `OpenThread` over 25% unless `shouldStartAnyway` is true, so the warning cannot be skipped by a stale form.
  - Only threads the owner opens beneath a thread are warned; agent-opened threads, asides, and mission starts are not.
  - With every model at 200,000 tokens, no larger model is offered.
  - Trim intel opens the intel panel inside the form, so the typed request stays.
- Structure: `startingContext.ts` owns the measurement and the refusal text; `readIntelSize` in `intel.ts` is shared by the gauge and the preview; `Composer` gained an optional `onChangeText`.
- Contract: request `PreviewStartingContext` answering `StartingContext` (with `StartingContextParts`); `OpenThread.shouldStartAnyway`. Thread tools did not change.

## Next

1. Ask the owner to agree to and accept batches 12–17. The proofs are `documentation/verification/2026-11-06-scoped-intel.md`, `2026-11-06-intel-over-time.md`, `2026-11-07-replacing-intel.md`, `2026-11-07-intel-history.md`, `2026-11-07-intel-proposals.md`, and `2026-11-07-starting-context.md`. Record the acceptance in the changelog. Commit when the owner asks.
2. Candidate batches: tool-and-skill-loading (specified, not built), mission-coordination (Control; specified, not built), thread-handover (not specified), routines (not specified; Tidy up intel's routine waits for it). Staged from batch 17: summarizing an over-window starting context, and the warning when starting a mission.
3. With approval, run the live Claude Code checks still listed as not verified in batches 10–17.

## Open questions

- New: when the opener's messages, not intel, make a starting context large, the specified choices (a larger model, trimming intel) do not help; should the owner be able to leave the opener's messages out?
- New: in the window drive, a 90,000-character mission start from the dashboard's Send stayed pending, while the service took the same message in a probe test. Not investigated.
- Carried over: should a save that duplicates a wider intel be refused or noted as redundant? Should the specification's 30-day dormant example change, or the 3-day half-life? Should workspace intels that repeat a global intel be proposed for deletion? There is still no test for withdrawing a suggestion when a turn fails.
- `intelChanges.ts` is 390 lines, over the 250-line convention; splitting it is a candidate refactor. `threadTree.tsx` now holds the tree and the open form; splitting the form out is a candidate.

## Sources

- `documentation/changelog.md` (CHG-0055)
- `documentation/work-in-progress.md` (Batch 17)
- `documentation/verification/2026-11-07-starting-context.md` and its folder (screenshots, `mutations.py`, `mutations.txt`)
- `documentation/capabilities/thread-tree/specifications.md` (Opening a thread)
- `documentation/backlog.md` (Starting context, staged from batch 17)
- `packages/service/src/startingContext.ts`, `tree.ts`, `intel.ts`, `service.ts`
- `packages/contracts/src/records.ts`, `requests.ts`
- `apps/app/src/threadTree.tsx`, `controls.tsx`, `labels.ts`, `styles.ts`
- `packages/service/test/startingContext.test.ts`, `apps/app/test/labels.test.ts`
