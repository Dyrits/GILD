# Handoff: Reserves usage page and plan-limit rings

Supersedes: none
Workspace: Iskios repository (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish the Reserves usage page so it meets its specification (budget-control, Reserves usage page), and have the owner review it and the rail's plan-limit rings in the running app. Done means the page's listed gaps are closed, it was driven live in the desktop app, and the owner accepted how both look.

## State

Verified now (commands run on 2026-11-12 before this file was written): `bun run typecheck` passes for all four workspaces; `npx biome check .` is clean (426 files); app tests 296 passed, 4 skipped; service tests 640 passed, 10 skipped (run with `ELECTRON_RUN_AS_NODE=1 ../../node_modules/.bin/electron ../../node_modules/vitest/vitest.mjs run` from `apps/app` and `packages/service`).

Built, in the commit that adds this file (CHG-0198, CHG-0199):
- The usage page: `apps/app/src/shell/usagePage.tsx` with `usageSummary`, `usageChart`, `usageBreakdown`, `usageControls`, `usageScale`, `usageFormat`, `usageLabels`, and `usageColors` beside it; the `ReadUsage` request (`packages/contracts/src/usage.ts`, `requests.ts`) answered by `packages/service/src/work/usageReport.ts`, `usageRows.ts`, `usageScope.ts`, `usageGaps.ts`. Breakdowns: harness, model, realm, quest, account, day. Period: 7 or 30 days or a custom range of local days. Metric: cost or tokens.
- The rail's plan limits as rings (`apps/app/src/editors/planLimitRings.tsx`, `planRings.ts`; the old `planLimitLines.tsx` is deleted): one circle per provider in a row, concentric rings for its windows with the longest outermost, each ring filled with the share left, green until 80% used, orange from 80%, red at 100%; a window whose reset time passed reads as unused. Hovering or focusing a circle lifts it and opens a card above the rings with the provider and each window's bar, "N% left", and time to reset. The rail no longer shows the tokens and cost line.
- Claude Code plan limits: `planLimitsOf` and the adapter's `readPlanLimits` in `packages/service/src/harness/claude.ts` keep the `rate_limit_event` of each turn (`unifiedWindows.five_hour` and `seven_day`, `utilization` 0 to 1, `resetsAt` in seconds). An account with none yet is probed once per run with one one-word turn to the `haiku` model in an empty folder. Verified live on Claude Code 2.1.322 on 2026-11-12: both windows came back for the Subscription sign-in. `runHarnessCommand` gained an optional `cwd`.

Not done, all unverified or open:
- A review of the usage page against its specification found: no breakdown by companion or skill; a breakdown shows only its first 100 rows (`maxRows` in `usageReport.ts`, with `hiddenRows` counted) and the rest cannot be reached; token detail for turns with incomplete data is not fully distinguished from missing; one unsafe type cast was reported without a location. These were reported by reviewers and not rechecked or fixed.
- Neither the page nor the rings were seen in the running app. The hover card opens upward over the quest list and was only checked in code for clipping (assumed fine: no `overflow: hidden` on the rail's ancestors except the page panel).
- OpenCode reports no plan limits and is unprobed. Claude Code's limits refresh only when a Claude turn happens, plus the one probe per run.

## Decisions

- Rings show what is left, not what is used, to match the hover card and the owner's reference; colors still follow how much is used (the owner asked for this after a mismatch was noticed).
- Circles sit in a row, one per provider, and the usage text lines and the "Usage" card header were removed at the owner's request.
- Claude's limits come from turns the user already runs, with one probe per run, to avoid spending subscription tokens on repeated reads (reads are paced to 4 minutes by `usageReadGate.ts`). Recorded in CHG-0198.
- Iskios never reads a CLI's token to ask for limits (requirements, Comply with provider terms).

## Next

1. Drive the app live (the repository's verification notes describe how) and look at the Reserves page and the rail's rings with Codex and Claude Code both reporting; fix any clipping or cramped layout of the hover card.
2. Close the usage page's gaps: reach rows beyond the first 100, add the companion and skill breakdowns only where usage can be attributed (the specification forbids charging a whole turn to every skill), separate unavailable token categories from zero, and find and remove the reported unsafe cast.
3. Probe OpenCode's reports for plan limits (backlog, Plan usage in the rail).
4. Append the outcomes to the changelog and write a new handoff.

## Open questions

- Whether the owner wants the Companion and Skill breakdowns now, given that skill cost can only be shown when reliably attributed. The owner can answer.
- Whether the hover card should open upward over the quest list, or to the side of the rail, once seen live. The owner can answer.

## Sources

- `documentation/capabilities/budget-control/specifications.md` (Reserves usage page, Plan limits)
- `documentation/changelog.md` (CHG-0134 to CHG-0137, CHG-0198, CHG-0199)
- `documentation/backlog.md` (Plan usage in the rail)
- `documentation/work-in-progress.md` (Reserves usage page and plan-limit rings)
- `packages/service/src/harness/claude.ts`, `packages/service/src/harness/codex.ts`, `packages/service/src/work/planLimits.ts`
- `packages/service/test/harness/claudePlanLimits.test.ts`, `apps/app/test/editors/planRings.test.ts`
