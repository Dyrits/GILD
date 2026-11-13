# Handoff: React Native and simplification review fixes

Supersedes: none
Workspace: ISKIOS repository, branch `main` (Delta worktree)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Act on a review of the whole repository for simplification and React Native best practices: fix the reproduced defects first, then the cheaper improvements. Done for this batch means the fixes are committed and pushed to `main` with the changelog entry CHG-0255.

## State

Done in the working tree, recorded in CHG-0255, committed and pushed with this handoff:
- Reconnection: a reconnection that fails before opening is retried; `close()` ends a pending attempt and its timer (`apps/app/src/foundation/client.ts`, test `apps/app/test/foundation/client.test.ts`). Verified by tests.
- `useServiceQuery` shows only its latest read (`apps/app/src/foundation/useServiceQuery.ts`). Verified by typecheck only; there is no hook test.
- Composer clears only what was sent: text typed or files added during a pending send stay (`apps/app/src/ui/controls.tsx`, `apps/app/src/attachments/useAttachments.ts`). Verified by typecheck only; no component test exists.
- `ChangeSettings` request merges a partial change into the saved settings inside the service transaction; the Charter, permissions and budget screens use it (`packages/contracts/src/requests.ts`, `packages/service/src/service.ts`, test `packages/service/test/changeSettings.test.ts`). `UpdateSettings` stays for whole replacements. Verified by tests.
- `ReadThreadTree` request returns a quest's threads without a conversation; the sidebar and quest list use it (`packages/service/src/work/missionDetail.ts`, test `packages/service/test/threadTree.test.ts`). Verified by tests.
- The quest list reads the mission list once instead of twice. Verified by typecheck.
- Sent-image cache is bounded to 64 MB of base64 (`apps/app/src/attachments/imageCache.ts`, 5 tests). Memory retained in the running app was not measured.
- `App.tsx` screen choice is a `switch`, and the side panel's mode comes from `detailsModeOf` in `apps/app/src/shell/navigation.ts` (5 tests). Not checked in a window.
- `hostOnlyRequests` test updated to list `AddBrowsableRoot` and `RemoveBrowsableRoot` (CHG-0253).
- `vitest.config.ts` has two projects: `parallel`, and `timing` (`harness` and `lore`, one file at a time), plus `retry: 2` and a 20 second timeout.

Verified now or in this session: `bun run check` and `bun run typecheck` pass; `bun run test` passed three times in a row on a quiet machine (1364 passed, 14 skipped by condition: live-token tests behind `ISKIOS_LIVE_CLAUDE` and `ISKIOS_LIVE_HARNESSES`, macOS-only tests, and `gild`-theme tests); `expo export --platform web` compiles.

Not verified: any screen in a real Electron window, retained memory of the image cache, tests on a fully idle machine. The `harness` and `lore` tests wait on real time and failed intermittently under load before the `timing` project and `retry` were added; they also failed on a version without these changes.

## Decisions

- Settings merge in the service, not in the screens, because a paired device or Iskios can change settings concurrently. Recorded in CHG-0255.
- No `memo`, `useCallback`, new state library or React Compiler without profiling an interaction; the review found no render defect.
- Retry and a separate serial project for timing tests mitigate flakiness; the tests themselves are not rewritten. A retry can hide an instability; Vitest reports retried tests as flaky.

## Next

1. Confirm with the user that the batch is committed and pushed, and that the original checkout is synced.
2. Extract the Companion dock logic in `apps/app/src/shell/shell.tsx` (registration, ranking, selection, visibility), tests first, as its own batch.
3. Finish the service consolidations named in `.agents/handoffs/2026-11-13-0017-architecture-audit-candidates-done.md`: one runner resolution in `packages/service/src/work/admission.ts`, and the duplicated checks in `packages/service/src/work/guildmasterProvenance.ts`.
4. Add component tests for the composer's selective clearing and the query hook's latest-read guard; the app has no React rendering in its tests.
5. Make the `harness` and `lore` tests deterministic (wait for state, not duration), then drop `retry` if the suite stays green.

## Open questions

- Whether to profile a long conversation and a long quest list before any render optimization. The user can decide.
- Whether to keep `retry: 2` once the timing tests are rewritten.

## Sources

- `documentation/changelog.md`, entry CHG-0255
- `documentation/work-in-progress.md`
- `.agents/handoffs/2026-11-13-0017-architecture-audit-candidates-done.md`
- `vitest.config.ts`
