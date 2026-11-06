# Handoff: batches 10 (off-topic requests) and 11 (budget control) built, awaiting the owner

Supersedes: `2026-11-06-1705-off-topic-requests.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Get the owner's acceptance of batch 9 and agreement to batches 10 and 11 with their provisional choices; check them live; record them; commit with authorization.

## State

- Verified (superseded handoff, unchanged): batch 9 behavior proven in the window; no acceptance or delivery recorded.
- Verified (superseded handoff, unchanged): batch 10 built and proven on the fake harness; no agreement recorded.
- Verified by command output: batch 11, budget control, is built test-first. `bun run test` passes 200 with 5 opt-in live tests skipped; typecheck, `bun run check`, desktop build, and `git diff --check` pass; 16/16 mutations caught. Driven in the window on the fake harness: a 1,000-token budget, the orange then red meter, the stop question, +50% raise resuming a stopped child, the global budget's shared question, the new-mission refusal, and Stop all.
- Batch 11 was chosen by an agent under the owner's instruction ("Go for next feature", AFK, no questions). Control and the phone are out of it: neither exists.
- Verified by git status: everything since `8e05eb0` is uncommitted (batch 9 proof updates, batches 10 and 11). No commit authorization was given. `.zcode/` stays untracked.
- Verified: this session's test instances are stopped. Metro 8081/8082 and an Electron on 9333 from earlier sessions still run; not touched.

## Decisions

- Batch 11 provisional choices are listed in work-in-progress (Batch 11): Claude Code counts as subscription spending in tokens, cache reads included; spending counts at a turn's end; split by thread only; no global budget lines (Control holds them); meters are bars.
- Batch 10 provisional choices are listed in work-in-progress (Batch 10).
- No changelog records were added for batches 10 and 11, or for batch 9's delivery.

## Next

1. Ask the owner to accept batch 9 and record its delivery.
2. Present batches 10 and 11 with their provisional choices; record the agreements or changes in the changelog.
3. With approval, run live checks with Claude Code: an off-topic message, and a small token budget reached.
4. Commit and push only with the owner's authorization.
5. Next feature candidates: scoped-intel, tool-and-skill-loading, mission-coordination (Control, which batches 10 and 11 leave hooks for), thread-handover.

## Open questions

- Batch 11 observations in its proof: the parent left Idle after a raise, the refusal without a Raise button, Stop on a held thread.
- Carried over: the questions in work-in-progress (Open questions) and the superseded handoff.

## Sources

- `documentation/work-in-progress.md` (Batches 9, 10, 11)
- `documentation/verification/2026-11-06-budgets.md`, `2026-11-06-off-topic.md`, `2026-11-06-mission-tracking.md`
- `documentation/capabilities/budget-control/specifications.md`
- `packages/service/src/budgets.ts`, `spending.ts`; `apps/app/src/budgets.tsx`
- `packages/service/test/budget.test.ts`
