# Proof: billing kind, estimated cost, and the price table (step 1 of the budget-control blueprint)

- **Verdict:** partly proven. Every behavior below is proven by tests at the service's public interface, a mutation that each check caught, and a drive of the real service and the web build; the look awaits the owner.
- **Work:** working tree on `406650d` (main), staged and uncommitted when proven
- **Agreement:** CHG-0126, [budget-control specifications](../capabilities/budget-control/specifications.md) and [blueprint](../capabilities/budget-control/blueprint.md) (delivery step 1)
- **Environment:** macOS, Bun workspace, Electron as Node for the service and tests, Expo web export served on localhost:8099, Playwright (Python) with Chromium; the throwaway data folder `/tmp/gild-consumption`, the fake harness, and a stand-in price table (never the owner's `Gild` data or models.dev)
- **Date:** 2026-11-10

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | A turn counts toward one budget unit chosen by its billing kind: API-key turns toward cost, Subscription and Unknown toward tokens, whether or not a cost number is present | specification, Budgets | proven |
| C2 | An estimate never counts toward a limit, except for an API-key turn whose harness reported no cost | specification, Budgets (provisional: "I guess") | proven |
| C3 | Claude Code's billing kind comes from the init event's `apiKeySource` (`none` is Subscription, another source is API key, none given is Unknown) | specification, Billing kind | proven against the stand-in; a live `claude` run is not done |
| C4 | Each turn is estimated once when it ends, by token kind at the model's price, and stamped; a later table never changes it | specification, Estimated cost | proven |
| C5 | A model the table lacks leaves the turn unpriced ("no price"), or takes the harness's own cost as the estimate when it reported one; nothing is guessed | specification, Estimated cost | proven |
| C6 | Model names match their price by exact name, provider prefix, then without a release date | blueprint, Open | proven |
| C7 | The price table is read at startup, a failed read keeps the table and reports why, an unread table falls back to the shipped snapshot, and Fetch prices off reads nothing and uses only the snapshot | specification, The price table | proven |
| C8 | The price request is a plain GET to models.dev with no body and no header beyond `accept` | requirement "Price table read carries no owner data" | proven |
| C9 | Turns recorded before billing kinds count as they always did and are shown as earlier turns, unpriced; a mission with no turn has none | specification, Estimated cost | proven |
| C10 | The quest card, quest panel, thread panel, rail, top bar, and budget window show the estimate as `≈ $x`, an API-key turn's reported cost as `$x`, and the budget window splits by thread, harness, and model | specification, Seeing budget use and consumption | proven in the page; appearance awaits the owner |
| C11 | The Charter has the Fetch prices switch, Refresh now, and the status line, which changes to the snapshot line when switched off | specification, The price table | proven in the page; appearance awaits the owner |
| C12 | No regression | blueprint, step 1 | proven; four timing tests fail only under parallel load, as before |

## Evidence

### C1, C2: billing kind chooses the unit

- **Check:** `bun run test packages/service/test/budget.test.ts packages/service/test/prices.test.ts` ("counts a subscription turn's tokens even when the harness reported a cost", "counts an unknown billing kind as subscription tokens, and an API-key turn as cost", "counts an API-key turn the harness gave no cost for by its estimate", "never counts an estimate toward a limit for a subscription turn"); `ReadMission` through the service, the fake harness reporting `billing` and `spend` lines.
- **Shown able to fail:** the checks failed on the starting rule before the change (2 red); mutation M1 (invert the API-key test in `spending.ts`) failed 22 tests, M10 (an API-key turn without a cost counts nothing) failed the estimate-counting test.
- **Result:** `spent` `{ cost: 0, tokens: 500 }` for a Subscription turn with cost 1.5; `{ cost: 4, tokens: 300 }` for Unknown 300 tokens then API-key cost 4; `{ cost: 3, tokens: 0 }` for an API-key turn with 1,000,000 tokens and no cost.
- **Reproduced:** by me, three runs; match.

### C3: Claude Code's billing kind

- **Check:** `packages/service/test/harness/claude.test.ts` ("records each turn's own cost ..., on an API key", "counts a subscription turn's tokens, not the cost Claude Code reports, when no API key signed it in", "counts a turn as subscription tokens when Claude Code does not report how it signed in"), with the stand-in's `STAND_IN_API_KEY_SOURCE`.
- **Shown able to fail:** M5 (always API key) failed the subscription test.
- **Result:** with `none` the stand-in's reported cost counts 0 cost and tokens > 0; with `ANTHROPIC_API_KEY` it counts the cost.
- **Not observed:** a real `claude` run: the exact values of `apiKeySource` are unprobed (backlog, build order).

### C4, C5, C6: estimates and matching

- **Check:** `prices.test.ts` ("stamps an estimated cost ...", "prices each token kind at its own rate", "leaves a turn unpriced ...", "takes the harness's own cost as the estimate ...", "keeps a turn's stamped estimate when the table changes") and `priceSources.test.ts` ("matching a model to its price"). Expected values are worked from the prices in dollars per million tokens (for example 0.3 + 3 + 0.3 + 1.5 = 5.1), not from the code.
- **Shown able to fail:** M2 (drop the cache-write term) failed "prices each token kind"; M3 (stamp nothing) failed 11 tests.
- **Result:** `estimated: 3` for 1,000,000 input tokens at $3; 33 after the table's price became $30 while the first turn stayed 3.
- **Reproduced:** by me; match.

### C7, C8: the table, its fallback, and its request

- **Check:** `prices.test.ts` ("reads the public table at startup", "keeps the table it has when a read fails, and says why", "falls back to the shipped snapshot when no table was read", "uses only the snapshot, and reads nothing more, with Fetch prices off") and `priceSources.test.ts` ("sends a plain GET that carries nothing about the owner", "fails with a reason when the table answers with an error").
- **Shown able to fail:** M4 (refresh ignores the switch) and M7 (estimates use the fetched table whatever the switch) failed the switch test (M7 first escaped: the test turned the switch off before the table was read, so it was strengthened to fill the table first, and then caught it); M9 (a cookie header) failed the request test.
- **Result:** Sonnet 5.5 priced from the snapshot at $2 per million input tokens (a literal from the snapshot, `claude-sonnet-5-5`); the request is `GET https://models.dev/api.json` with `{ accept: "application/json" }`.
- **Not observed:** a read of the real models.dev from the service (the proof used the stand-in; the snapshot script read it once, 309 prices).

### C9: earlier turns

- **Check:** `prices.test.ts` ("stay unpriced, are counted as they were, and are named as earlier turns", "counts no earlier turns for a mission that has run none", "names turns recorded before models were recorded as earlier turns"); rows inserted with the old columns only.
- **Shown able to fail:** M8 (count the join's empty row as an earlier turn) failed "counts no earlier turns"; it was a real bug found by the full run, fixed before this proof.
- **Result:** one earlier turn with cost 1.25 is reported, the other counts 700 tokens; a new mission has `earlierTurns: 0`.

### C10, C11: the screens

- **Check:** `drive.py` ([script](2026-11-10-consumption-and-cost/drive.py), [service](2026-11-10-consumption-and-cost/serve.ts.txt)) against the throwaway service with two quests: a Subscription quest of 1,000,000 tokens and an API-key quest reporting $1.25 for 500,000.
- **Shown able to fail:** M6 (no `≈`) failed the label tests; the page figures come from the same label functions. The drive reads the page text, so a missing field would have printed False.
- **Result:** the board card `≈ $3.00 1,000,000 tokens` and `$1.25 500,000 tokens`; the rail and the top bar `1,500,000 tokens · ≈ $4.25`; the quest panel `Quest usage 1,000,000 tokens · ≈ $3.00`; the budget window "Used 1,000,000 tokens · ≈ $3.00", "By harness" (Claude Code) and "By model" (test-model); the thread panel `This thread 1 turn · ≈ $3.00 · 1,000,000 tokens`; the Charter "Prices from models.dev · fetched 10 Nov" with a Refresh now button, and after switching Fetch prices off "Prices from the snapshot of 10 Nov" with no button. Screenshots: [board](2026-11-10-consumption-and-cost/01-board.png), [quest panel](2026-11-10-consumption-and-cost/02-quest-panel.png), [budget window](2026-11-10-consumption-and-cost/03-budget-window.png), [thread panel](2026-11-10-consumption-and-cost/04-thread-panel.png), [Charter](2026-11-10-consumption-and-cost/05-charter-prices.png), [Charter, off](2026-11-10-consumption-and-cost/06-charter-prices-off.png).
- **Reproduced:** by me, three runs of the drive; match.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Typecheck | `bun run typecheck` | pass | pass |
| Lint and format | `bun run check` | pass | pass |
| Tests | `bun run test --maxWorkers=3` | not run | 680 passed, 10 skipped, 4 failed under load |
| The four failing tests alone | `bun run test packages/service/test/harness/harnesses.test.ts packages/service/test/lore/loreOverTime.test.ts` | not run | 49 passed |
| Web export | `cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export` | not run | pass |

- The four timing-sensitive tests (Codex steering and interrupt, OpenCode interrupt, Lore fading) time out under parallel load, as recorded in CHG-0125 for the unmoved commit; they pass alone.

## Not proven

- **Appearance** of the card figures, the panels, the budget window, and the Charter card: screenshots are in the folder, awaiting the owner.
- **Live harness values:** Claude Code's real `apiKeySource`, and Codex's and OpenCode's billing kind (they report `Unknown` until probed); the real models.dev read from the service. None is claimed by this step.
- **Daily refresh:** the schedule (`Schedule.spaced("1 day")`) is not driven by a test clock; only the startup read is observed.

## Reproduce

```sh
bun run typecheck && bun run check
bun run test packages/service/test/budget.test.ts packages/service/test/prices.test.ts packages/service/test/priceSources.test.ts packages/service/test/harness/claude.test.ts apps/app/test/foundation/labels.test.ts
bun run test --maxWorkers=3
# the window drive, from packages/service:
cp ../../documentation/verification/2026-11-10-consumption-and-cost/serve.ts.txt scratch-serve.ts
GILD_DATA_DIR=/tmp/gild-consumption ELECTRON_RUN_AS_NODE=1 ../../node_modules/.bin/electron scratch-serve.ts > /tmp/gild-serve.log &
# from apps/app: bunx expo export --platform web --output-dir /tmp/gild-export, then `python3 -m http.server 8099` inside it
python3 documentation/verification/2026-11-10-consumption-and-cost/drive.py documentation/verification/2026-11-10-consumption-and-cost
# afterwards: stop both processes and delete packages/service/scratch-serve.ts
```

## New files

`packages/service/test/prices.test.ts`, `packages/service/test/priceSources.test.ts`, `packages/service/test/fixtures/prices.ts`, and this proof's folder.
