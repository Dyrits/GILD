# Verification: batch 9, mission tracking

Agreement: CHG-0045. Base revision: `63d4b15`. Changes remain uncommitted.

## Checked on resumption, 2026-11-06

- `bun run test`: 175 passed, 5 skipped across 15 files. Skipped checks require the opt-in live Claude environment.
- `bun run typecheck`: all four workspaces pass.
- `bun run check`: passes.
- `bun run --filter desktop build`: passes.
- `git diff --check`: passes.

`packages/service/test/tracking.test.ts` covers urgency, result and inactivity prompts, dismissal, hourly updates, ending confirmations and stale previews, stopping threads, journal entries, automatic archiving, reopening, and writing into ended missions. `dashboard.test.ts` covers title ownership, prefilled choices, ordering, filters, and title/briefing search. UI label checks live in `apps/app/test/labels.test.ts`.

## Recovered evidence

The interrupted session left [15 mutation results](2026-11-06-mission-tracking/mutations.txt) and their [script](2026-11-06-mission-tracking/mutations.sh). All mutations caused failing checks, and the restored run passed 175 checks. This log was inspected on resumption; the mutations were not repeated.

It also left screenshots in [the evidence folder](2026-11-06-mission-tracking/): dashboard attention ordering, ending confirmation, Done header, Archived view, Done filter, search, inactivity question, and settings. These are recovered evidence, not a newly repeated window drive. The ending-confirmation screenshot was inspected on resumption and shows one thread at work and the Stop and mark as done / Cancel controls.

## Completion gap

On resumption, dashboard rows were missing the agreed ending actions. They now reuse `MissionEndingActions` beside the row's opening target, including Reopen in Archived. Header and dashboard therefore use the same preview, confirmation, error handling, and service requests. Typechecking and lint were repeated after this change and pass.

The new dashboard buttons still need an interaction check in the Electron window: Mark as done on an active mission, confirm or cancel stopping working threads, Archive, then Reopen from Archived and confirm the row returns to the main dashboard. Verify rename and workspace filtering too; the recovered screenshots alone do not establish those interactions.

This side thread cannot control desktop applications. Continue the Electron drive in the main chat. No delivery or owner acceptance is claimed yet. The user deferred visual polish; this remaining check concerns behavior.
