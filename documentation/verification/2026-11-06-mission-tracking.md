# Verification: batch 9, mission tracking

Agreement: CHG-0045. Built on `63d4b15`, committed in `8e05eb0`; the window drive below ran on `8e05eb0`.

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

## Window drive, 2026-11-06 (closes the completion gap)

- **Environment:** working tree on `8e05eb0`, desktop rebuilt. Fresh Metro on port 8083; Electron run as `env -i HOME PATH USER TMPDIR LANG OPENMISSION_HARNESS=fake OPENMISSION_DATA_DIR=/tmp/om-run/data-b9drive OPENMISSION_APP_URL=http://localhost:8083 electron --inspect=9336 dist/main.js --remote-debugging-port=9335` in `apps/desktop`. Driven with Playwright CLI over CDP (`playwright-cli attach --cdp=http://localhost:9335`) through [drive-run-code.sh](2026-11-06-mission-tracking/drive-run-code.sh) and [drive-start-mission.sh](2026-11-06-mission-tracking/drive-start-mission.sh). The folder dialog handler was replaced through the Node inspector with [main-eval.ts](2026-11-06-batch-4-drive/main-eval.ts), as in the batch 4 drive, to return `/tmp/om-run/ws-alpha` or `/tmp/om-run/ws-beta`. The fake harness's `wait 900000` kept one thread running; `call <tool> <json>` called thread tools. Results were read from the window and from `openmission.sqlite`.
- **Who:** an agent, at the owner's request ("build what is next").

Five missions: "Scratch probe" (no workspace), "Alpha long task" (ws-alpha, running), "Beta quick task" and "Gamma idle task in alpha" (ws-alpha), "Delta task in beta" (ws-beta).

| Check | Observed | Verdict |
| --- | --- | --- |
| Workspace filter | ws-beta listed Delta only; ws-alpha listed Gamma, Beta, Alpha; ws-alpha with Idle listed Gamma and Beta ([screenshot](2026-11-06-mission-tracking/workspace-and-state-filter.png)); All workspaces and All states listed all five | proven |
| Row Mark as done on a running mission | The row showed "1 thread is still running. Stop it and mark as done?" with Stop and mark as done and Cancel ([screenshot](2026-11-06-mission-tracking/row-ending-confirmation.png)). Cancel closed it; the database still had the thread Running and no ending. Confirming made the mission Done and its thread Stopped; the Running filter then showed none and the Done filter showed Alpha with Archive only | proven |
| Row Archive | Archive on Alpha (Done) and on Beta (Idle) set both to Archived; both left the dashboard and appeared in the Archived view with Reopen ([screenshot](2026-11-06-mission-tracking/archived-from-rows.png)) | proven |
| Reopen from Archived | Reopen on Beta removed it from the Archived view; back on the dashboard it was Idle with Mark as done and Archive | proven |
| Journal entries | Alpha: "Marked done by the user", "Archived by the user"; Beta: "Archived by the user", "Reopened by the user"; all by the user | proven |
| Rename | Clicking the header title opened a field with Save and Cancel; Save made the mission and its top thread "Gamma renamed", marked as named by the owner. `set_mission_title` from that thread then answered "Not named: the owner named this mission, so its title stays." and the title stayed ([screenshot](2026-11-06-mission-tracking/rename-refuses-agent-title.png)) | proven |
| Agent title | On Delta, not renamed, `set_mission_title` made the mission and top thread "Delta by agent" | proven |
| Mark as done? | The top thread's `report_result` raised "Missions to settle: Delta by agent, Mark as done?" ([screenshot](2026-11-06-mission-tracking/mark-as-done-question.png)). Not now removed it without ending; a second result asked again; Mark as done ended the mission as Done | proven |
| Writing in a Done mission | Scratch probe marked done from its header, then a message sent: the mission returned to Idle with no ending | proven |
| Search | "gamma" listed Gamma renamed only; "alpha" listed none (Alpha archived, Gamma renamed) | proven |
| Prefilled workspace | After a mission in ws-beta, the starter showed ws-beta | proven |

Observed, not changed (interface pass): the workspace chips swap order between renders (ws-alpha and ws-beta); a mission whose top thread is Done shows Idle, as the open question on Idle as the mission state already notes.

Drive note: Playwright CLI turned some snapshot refs into loose locators (`div` filtered by text "Send", `nth(4)`) that clicked the wrong element, so Send seemed to do nothing. Exact-text locators through `run-code` work; the helper scripts use them.

No delivery or owner acceptance is claimed yet. The user deferred visual polish.
