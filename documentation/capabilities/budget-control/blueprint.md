# Budget control blueprint

Status: built in three steps on 2026-11-10 and 2026-11-11 (proofs: [step 1](../../verification/2026-11-10-consumption-and-cost.md), [step 2](../../verification/2026-11-11-account-budgets.md), [step 3](../../verification/2026-11-11-reply-usage-and-plan-limits.md)). Departures from the design below: `spendingColumns`, `tokenSum`, and `costSum` keep their names instead of becoming `countedColumns`; the budget-scope module lives in `work/budgetScopes.ts` (it needs the harness labels) and also holds `budgetLineOf` and `budgetRefusalOf`; the pacing gate is the pure `work/usageReadGate.ts`; plan limits are a `PlanLimits` service (`work/planLimits.ts`) that returns the kept reading at once and starts a paced read in the background; `HarnessAdapter.readPlanLimits` returns null for a harness that reports none and fails when it could not answer; per-answer usage is kept in `reply_usage` and each turn's remainder is added to its last reply when the turn ends; the Charter shows account budgets in their own card. The mission, global, and stop behavior already built is kept; this blueprint changes how it counts, adds a third budget scope, and adds the estimate, price table, plan limits, and per-answer lines. Read with the [specifications](specifications.md), [decision record 0014](../../architecture-decision-record/0014-model-prices-from-a-public-table.md) (proposed), and the existing code in `packages/service/src/{core,work,harness}`.

The approach has four parts, all inside the local service:

1. **Count by billing kind**: each turn is recorded with its harness, account, model, billing kind, reported cost, and estimated cost; one counting rule in `spending.ts` picks the budget unit from the billing kind, never from whether a cost is present.
2. **Price once, at turn end**: a price table module estimates a turn when `completeTurn` records it, and the figure is stamped.
3. **One budget-scope module** replaces the "`missionId`, or `null` for global" convention, so an account budget is a third adapter, not a third branch everywhere.
4. **Read model and sources**: one consumption read serves the card, panels, dashboard, rail, budget window, and reply lines; plan limits come from a per-harness source behind a pacing gate.

## Modules

New or changed modules, in dependency order. Paths are where the module lives or will live.

- **Billing kind** (`@gild/contracts` `BillingKind`, set by each adapter in `TurnOutcome`): Subscription, ApiKey, or Unknown. Interface: `TurnOutcome.billing` is required; an adapter that cannot tell returns `Unknown`. Claude Code reads it from the `apiKeySource` of its init event (kept on the connection), Codex from the `account/read` reply at process start, OpenCode returns `Unknown` until its probe. Counting treats `Unknown` as Subscription. A turn's billing never changes after it ends.
- **Price table** (`core/prices.ts`, new): hides the fetch, the cache, the snapshot, and matching a harness's model name to a table entry. Interface: `PriceTable` service with `estimate(model, usage): Effect<Estimate | null>` (where `Estimate` is `{ amount, source: "Table", priced: <table date> }`; null when the model has no price), `status: Effect<PriceStatus>` (source `Fetched | Snapshot`, date, whether fetching is on), and `refresh: Effect<PriceStatus>` (the Charter's Refresh now). Invariants: `estimate` never fails and never reads the network; a failed refresh keeps the cached table; with `shouldFetchPrices` off only the snapshot is read; a model with no match returns null, never a nearest guess beyond the matching rules (exact id, then without a provider prefix such as `anthropic/`, then without a date suffix). Ordering: the table is loaded into memory at startup from SQLite or, when empty, the snapshot, before the first turn can end.
- **Price source seam** (`core/priceSources.ts`, new): one function `fetchTable: Effect<RawPriceTable, PriceReadFailed>`. Adapters: `modelsDevSource` (HTTPS GET of `https://models.dev/api.json`, sending no headers beyond the client's own, keeping only the models the harnesses offer and OpenCode lists), `snapshotSource` (a JSON file in `packages/service/prices/`, rewritten by a script `bun run prices:snapshot` before a release); test adapter: an in-memory fake. Request content is asserted by a test (requirement).
- **Price refresh** (`work/priceRefresh.ts`, new, beside `budgetPeriods.ts` and `ending.ts`): a scoped fiber that refreshes at startup and then daily while `shouldFetchPrices` is on. Interface: a layer, no calls.
- **Spending** (`core/spending.ts`, deepened): owns what counts toward a limit. The column test `CASE WHEN u.cost IS NULL` is replaced by one expression, `unitOf(row)`: ApiKey counts its reported cost, else its estimate, toward the cost unit; Subscription and Unknown count tokens (input, output, cache read, cache write) toward the token unit; a row recorded before billing kinds (billing NULL) counts as it always did, by whether it has a cost. Interface: `spendingColumns` and `tokenSum` become `countedColumns` (cost, tokens), used by every reader, so no caller restates the rule; `Spending` stays `{ cost, tokens }`.
- **Consumption** (`work/consumption.ts`, new): the one read model for what a turn or a set of turns used, shown rather than counted. Interface: `readConsumption(filter, groupBy)` where `filter` is a mission, thread, account, or the global period and `groupBy` is none, thread, harness, account, model, or billing kind; each row answers `{ tokens: TokenUsage, reported, estimated, unpricedTurns, earlierTurns, turns }`. `labels.ts` in the app turns a row into `≈ $1.20` / `$1.20` / "no price for X" (one function, `spendingTextOf`). The mission card, quest and thread panels, dashboard row, rail figure, and budget window all call it, so a figure cannot differ between screens.
- **Budget scope** (`work/budgetScopes.ts`, new): replaces `missionId | null`. A scope is `{ _tag: "Mission", id } | { _tag: "Global" } | { _tag: "Account", harness, accountId | null }`. Interface, one record per scope kind: `limits`, `spent` (counted, by the period or since-date), `covers` (the threads it stops), `stopRows` (the `budget_stops` filter), `eventTarget` (the quest that records its lines: the mission's top thread, Guildmaster, or each stopped quest), and `words` (text for lines and questions). Three adapters (mission, global, account) make this a real seam. `budgets.ts` iterates `reachedScopesOf(missionId, accountKey)` and no longer tests for null; `budgetViews.ts` reads through the same record.
- **Account budgets** (`work/accountBudgets.ts`, new): the owner's limits and credits per provider account. Interface: `setAccountBudget(accountKey, limits, period | null, since | null)`, `addCredit(accountKey, amount, since)`, `readAccountBudget(accountKey)` (limits, period, spent, left, "Counted by Gild"). Invariants: only the owner calls them (no thread tool); a change records its line on the account row and, if the account is now at its limit, stops its threads through `enforceBudgets`; removing an account deletes its budget row. An account key is `{ harness, accountId | null }`, with null for the computer's own sign-in.
- **Budget enforcement** (`work/budgets.ts`, changed): `enforceBudgets(missionId, accountKey, holder)` covers three scopes. An account stop's question carries a third answer, **Switch to a backup Companion**, implemented by calling the existing backups handover for the held thread; the other answers are unchanged. `holdIfReached` and `releaseBudgets` also check the thread's account scope. `open_thread` and a thread opened on an account at its budget are refused through `budgetRefusalOf`, which gains the account case.
- **Plan limits** (`work/planLimits.ts`, new) with a **usage read gate** (`harness/usageReadGate.ts`, new): hides when and how a subscription's limits are read. Interface: `readPlanLimits(accountKey): Effect<PlanLimitReading | null>` returning `{ windows: [{ label, usedPercent, resetsAt }], readAt }` or null for "Limits not reported"; `PlanLimitReading` is also stored (`plan_limits`) so a reading outlives a restart. The gate allows one read at a time, lets a reading stand for four minutes, backs off 5, 10, 20, then 40 minutes up to an hour after a failure, and keeps the last reading shown meanwhile. Harness seam: `HarnessAdapter.readPlanLimits?(configDirectory)`; Codex implements it by starting a short `codex app-server` in the account's folder and calling `account/rateLimits/read` (decided with the owner); Claude Code and OpenCode implement it as a passive report, `HarnessEvent.PlanLimits`, recorded when their stream carries windows (probe), otherwise null. No adapter reads a token or credential file.
- **Per-answer lines** (`harness` events and `work/turns.ts`, provisional until the usage probe): adapters emit `HarnessEvent.CallUsage { usage, model }` after each model call they can measure; `saveTurnReply` attaches the latest call's usage to the reply it saves (`reply_usage`). A turn whose harness reports only per turn shows the turn's line under its last reply, computed at read time; one that reports nothing shows none. A test asserts the lines of a turn sum to the turn's total.
- **Thread panel and mission summary** (`work/threadPanel.ts`, `work/missions.ts`, changed): `readThreadPanel` returns `consumption` beside `spending`; `MissionSummary` gains the mission's consumption. Both call `consumption.ts`.
- **Charter and app** (`apps/app`): the Charter gets the Fetch prices switch, Refresh now, and the status line; each account row gets its budget, credits, and plan limits; `labels.ts` gets `spendingTextOf`; the board card, quest and thread panels, dashboard row, rail figure, budget window, and each agent reply show the line. The app holds no counting logic.

## Data

All in the service's SQLite file (ADR 0002), as new numbered migrations after the latest in `core/store.ts`; each migration has a two-step check like the earlier ones.

- **`usage`** (changed, one row per turn): add `harness`, `model`, `account_id`, `billing` (NULL for turns recorded earlier), `estimate` (REAL, NULL when unpriced), `estimate_source` (`Table`, `Harness`, or NULL), `priced_at` (the price table's date). `cost` stays as the harness-reported cost. Earlier rows keep NULL in the new columns and count as before.
- **`prices`** (new): `model`, `provider`, `input`, `output`, `cache_read`, `cache_write` (dollars per million tokens), `source`, `fetched_at`; holds only the models the harnesses offer. The Charter switch is a setting, `shouldFetchPrices` (default on), in `Settings`.
- **`account_budgets`** (new): `harness`, `account_id` (empty for the computer's own), `cost`, `tokens`, `period` (NULL for credits), `since` (the credit's day, or NULL).
- **`budget_stops`** (changed): add `account_key` (NULL for mission and global scopes). Scope is read through `budgetScopes.ts`, never by testing `mission_id IS NULL`. `budget_events` gains the account stop line for each stopped quest (`mission_id` of that quest).
- **`plan_limits`** (new): `account_key`, `windows` (JSON), `read_at`, `source`.
- **`reply_usage`** (new, provisional): `message_id`, token counts, `estimate`, `priced_at`.

Contracts (`packages/contracts`): `BillingKind`, `Consumption`, `PriceStatus`, `AccountBudget`, `PlanLimitReading`, and requests `SetAccountBudget`, `AddCredit`, `ReadAccountBudgets`, `RefreshPrices`, `ReadPriceStatus`, `ReadPlanLimits`; `Settings.shouldFetchPrices`. Spending records outlive deleted threads and missions as they do now.

## Seams

- **Price source**: what the table is read from; adapters: models.dev HTTP, the shipped snapshot; test: an in-memory fake that records the request it was given.
- **Budget scope**: which spending and threads a limit covers; adapters: mission, global, account; test: the same three over a temporary database.
- **Plan limit source**: how a harness reports its limits; adapters: Codex app-server read, Claude Code and OpenCode stream reports; test: the fake harness reporting windows and the stand-in app server in `test/fixtures`.
- **Harness events**: `Usage` events and `TurnOutcome.billing` come from the existing harness seam; the fake harness gains lines that report a billing kind, a model name, a per-call usage, and plan-limit windows, beside its `spend` line.
- **Clock**: all period starts, price stamps, and gate timing use `Clock`, driven by `TestClock`.

## Acceptance

| Acceptance criterion | Module and test seam |
| --- | --- |
| Cost and token limits counted by billing kind; Unknown counts as Subscription; one unit per turn; empty limit never stops | `spending.ts` `unitOf`, through `budget.test.ts` with the fake harness reporting billing |
| An estimate never counts, except an API-key turn with no reported cost | `spending.ts`, the same tests |
| A Claude subscription turn with a reported cost counts tokens | `spending.ts` with the fake harness `billing Subscription` and a cost |
| Estimate by token kind, stamped with model and date, unchanged by a later table, unpriced with a reason, harness figure when the table lacks the model | `PriceTable.estimate` and `completeTurn`, fake price source and `TestClock` |
| Earlier turns unpriced, totals say how many | `consumption.ts` after a migration check of the new `usage` columns |
| Price read at startup and daily, failure keeps the table, offline uses the snapshot, switch off uses only the snapshot, the request carries nothing about missions | `priceRefresh.ts` and `PriceTable` through the fake source; the request is asserted on the fake |
| Every thread draws on the mission; spending counts toward mission, account, and global budget | `budgetScopes.ts` three adapters, `budget.test.ts` |
| Default mission budget; mission budget changed; global period starts | Existing `budget.test.ts` cases, kept passing through the scope module |
| Account budget over a period and with none; credits from the day entered; Add credit; a removed account removes its budget | `accountBudgets.ts`, `TestClock` |
| A turn stopped at once at a limit; Raise resumes; Stop stays stopped | `budgets.ts` `enforceBudgets`, `releaseBudgets`, `stopAtBudget`, the existing cases |
| An account's limit stops its threads across missions and no others; Switch to a backup hands over; a thread opened on that account refused | `budgets.ts` account scope with `backups.ts` handover; fake harness on two accounts |
| Global limit stops everything with one question; `open_thread` and open mission refused with the reason | Existing cases through `budgetRefusalOf` |
| Lowering below spending stops running threads | Existing case, for each scope |
| Budget line with the account part, left out with no budget | `budgetLineOf` through `startingContext.test.ts` |
| No thread can change a budget | Thread tool catalogue test: no budget tool listed (existing) |
| Each change and stop recorded as a line, including the account stop line in each stopped quest | `budgetScopes.eventTarget`, `budget.test.ts` |
| Reply lines add up to the turn's total, per call, per turn only, and nothing | `reply_usage` and `consumption.ts`, fake harness in three modes; provisional until the probe |
| Plan limits read from a fake Codex report, paced, last reading kept after a failure, "Limits not reported", no token read | `planLimits.ts` and `usageReadGate.ts` with the stand-in app server and `TestClock`; a test that no credential file is opened |
| Human acceptance on desktop and phone | The app driving the Charter, card, panels, budget window, and replies on a throwaway database with the fake harness |

## Requirements

| Requirement | How the design meets it |
| --- | --- |
| Local data | The only new outbound request is the price read, which carries nothing about missions, workspaces, accounts, or the owner; the table and every reading are stored in the service's SQLite file. |
| Price table read carries no owner data | The price source seam sends a fixed request; a test inspects it; the Charter switch selects the snapshot adapter only. |
| Comply with provider terms | No adapter reads a token, keychain item, or credential file; Codex limits come from its own app server, Claude Code and OpenCode only from their own streams; account credits are the owner's own entry. |
| Bring your own provider | Billing kind reads the harness's own report of the sign-in; Gild holds no key. |
| End-to-end encrypted phone traffic | A stop at an account's budget uses the existing content-free notification. |
| Single user | Account budgets are the owner's; guests never change them. |

## Alternatives

- **Bolt the account scope onto the `null` convention**: smaller now, but every later scope repeats the branching in `budgets.ts`, `budgetViews.ts`, and the stop queries. The owner chose the scope module.
- **Price at read time**: always current, but a mission's figure would shift when prices move or a fetch failed, and `usage` rows hold no model. The owner chose stamping at record time.
- **Harness figure first for the estimate**: needs a per-harness branch and Claude's running-total probe as a prerequisite. The owner chose the table first.
- **A vendor SDK in any adapter**: not taken; [decision record 0008](../../architecture-decision-record/0008-drive-harness-tools-directly.md) stands, and OpenCode's HTTP server is a probe in the [backlog](../../backlog.md).
- **Reading plan usage from a vendor endpoint with the CLI's token** (as OpenBot does for some providers): excluded by Comply with provider terms.
- **Per-thread processes only for Codex limits**: stale for an account with no recent Codex turn; the owner chose a short paced process.

## Delivery steps

Each step leaves a runnable, tested application (the iterate rhythm).

1. **Billing kind, estimate, price table**: `TurnOutcome.billing`, the `usage` columns, `spending.ts` `unitOf`, `PriceTable` with source seam, refresh fiber, `consumption.ts`, the Charter switch, and the estimate on the card, panels, dashboard, rail, and budget window. The existing budget tests pass unchanged except where the unit rule changed deliberately (a Claude subscription turn with a cost now counts tokens).
2. **Budget scopes and account budgets**: `budgetScopes.ts` with the mission and global adapters first (a pure refactor against the existing tests), then the account adapter, `accountBudgets.ts`, credits, Switch to a backup Companion, and the Charter rows.
3. **Probes, then per-answer lines and plan limits**: the live probes first (usage per model call per harness, `rate_limit_event`, billing kind per harness, Claude's `total_cost_usd` total), then `reply_usage` and the reply lines, then `planLimits.ts` with the gate and the Codex read.

## Open

- **Model-name matching**: Claude Code's ids (`claude-sonnet-5-5`), Codex's names, and OpenCode's `provider/model` ids must match models.dev's. Recommendation: the three rules above and a test table built from each harness's offered list, with unmatched models listed in the Charter's price line ("3 models have no price") so a gap is visible.
- **Billing kind of OpenCode**: ACP reports no sign-in kind. Recommendation: `Unknown` (counts as Subscription) until the probe; a provider known to bill per key (for example an OpenRouter or API-key provider) may later map to ApiKey.
- **Earlier turns in the budget window**: rows with billing NULL show "recorded before billing kinds" in the details. Recommendation: accept; no backfill.
- **Credits across a changed amount**: a new amount and day start a new count (specification). Recommendation: keep the old credit's history in the account row's list so a top-up is not lost.
- **When the rail reads plan limits**: on opening the Charter, at the end of a Codex turn, and every five minutes while the rail shows (paced by the gate). Recommendation: as stated; adjustable.
- **Proposed decision record 0014** awaits the owner's acceptance; `architecture.md` (Integrations, Decisions) and `AGENTS.md` change on acceptance.
- **Estimate source, the API-key rule, and the requirement's scope** were agreed provisionally; the first is settled (table first), the other two await the owner's confirmation.
