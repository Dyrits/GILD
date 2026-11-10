# Budget control

## Problem and outcome

Threads open threads on their own, many at once, on the user's own provider accounts. Without limits, one mission can spend far more than the user meant. Budgets on each mission, on Guildmaster, on each provider account, and on all spending over a period stop new spending at a limit the user chose, and show at a glance how close each one is, so the user pays for the work knowingly.

The user also sees what every turn used, whatever the provider: its tokens, and an estimated cost for every model Gild has a price for, so subscription and API-key work can be compared. Each subscription's own limits are shown where its harness reports them.

Status: the budgets, their stops, and their records were agreed earlier. The billing kind, estimated cost, price table, account budgets, credits, per-answer lines, and plan limits were agreed by the owner on 2026-11-10 (CHG-0126). Two parts stay provisional until a live probe is in: the per-answer lines and the plan limits of Claude Code and OpenCode (marked below). The owner accepted the billing kind rule for API-key turns without a reported cost with "I guess" and may reopen it.

## Agreed behavior

Version 1 serves the installation's owner. In future hosted missions, guest-triggered work uses the host's provider account and counts toward the mission and global budgets. Only the host changes budgets (CHG-0017). See the [hosted agreements](../../architecture.md#future-multiplayer-open-architecture-questions).

### Billing kind

- Each turn is recorded with a **billing kind**: **Subscription**, **API key**, or **Unknown**, worked out from what the turn's harness reports about the sign-in it ran with. The kind is fixed when the turn ends; a later change of account or harness gives later turns their own kind.
- **Unknown** counts as Subscription, so a harness that reports nothing never escapes a token limit.
- The owner reads each turn's billing kind in the thread's details.

### Budgets

- A budget holds two optional limits: a **cost** limit for API-key spending and a **token** limit for subscription spending, matching the units in [mission-tracking](../mission-tracking/specifications.md#spending). An empty limit means no limit.
- A **cost** limit counts the cost of API-key turns: the cost the harness reported, or, when it reported none, the turn's estimated cost. A **token** limit counts the tokens (input, output, cache reads, and cache writes) of Subscription and Unknown turns. A turn counts toward one unit only, chosen by its billing kind and never by whether a cost number happens to be present.
- An estimated cost never counts toward a limit, except for the one case above: an API-key turn whose harness reported no cost. Provisional (the owner accepted it with "I guess", CHG-0126).
- Budgets exist on missions, on Guildmaster, on provider accounts (below), and as one **global budget**. Single threads have no budget of their own: every thread in a mission draws on the mission's budget.
- A mission's budget and Guildmaster's budget cover their whole life and have no period.
- The global budget covers the spending of all missions and Guildmaster over a period the user chooses: **Day**, **Week**, or **Month** (the default). A period starts at local midnight, on Monday for a week and on the 1st for a month.
- Spending counts toward its mission's or Guildmaster's budget, toward its account's budget, and toward the global budget; a thread stops at whichever limit it reaches first.

### Estimated cost

- Every turn gets an **estimated cost** unless it is an API-key turn with a reported cost: its tokens by kind (input, output, cache read, cache write) times the model's price per token in the price table, in US dollars, so every harness is priced from one source. It is worked out once when the turn ends, stamped on the turn with the model and the table's date, and never changes afterwards, whether prices move or a later fetch fails.
- When the table has no price for a turn's model and the harness reported a cost for the turn (Claude Code's `total_cost_usd`), the harness's figure stands as the estimate, stamped as the harness's own. The owner chose the table first on 2026-11-10 (CHG-0126).
- When neither the harness nor the table gives a price for a turn, the turn has no estimated cost. A price is never guessed.
- Turns recorded before this feature stay as they were: tokens, and a cost where the harness reported one. They are not priced afterwards; totals say "N earlier turns not priced".
- An estimate is shown as `≈ $1.20`. A cost the harness reported on an API-key turn is shown as `$1.20`. Tokens are always shown beside it. A total that mixes the two reads `≈`, and its details say how much was reported and how much estimated. A turn with no price shows its tokens and, in the details, "no price for <model>".
- An estimate is never shown as a limit, a ring, or a meter: only real budgets fill rings.

### The price table

- Prices come from [models.dev](https://models.dev) (`api.json`: per million tokens, input, output, cache read, cache write), read at startup and then daily, kept on the computer, with a snapshot shipped with Gild as the fallback when the computer is offline or the read fails. A failed read leaves the kept table as it was.
- The request carries nothing about missions, workspaces, accounts, or the owner. It is the same kind of public read as the check for a harness's newest version.
- The Charter has a **Fetch prices** switch, on by default, a **Refresh now** button, and one line such as "Prices from models.dev · fetched 10 Nov". With the switch off, only the shipped snapshot is used, and the line says "Prices from the snapshot of 3 Nov".
- Only US dollars.

### Setting budgets

- Settings hold an optional default mission budget, empty at first, applied to each new mission, and the global budget with its period, also empty at first.
- The user sets, changes, or removes a mission's budget from the mission itself, and Guildmaster's from Settings or from Guildmaster. No budget is set on Guildmaster by default.
- Only the user sets or raises a budget. No thread can, and no thread gives part of a budget to another.

### Account budgets and credits

- Each provider account (the computer's own and each added one) can carry an **account budget**: a cost limit, a token limit, or both, over a period (**Day**, **Week**, **Month**) or over no period. It is set from the account's row in the Charter. Empty at first.
- It counts only what Gild's own turns used on that account, by billing kind as every budget does, across all missions and Guildmaster. It cannot see what other tools use on the same account, and the row says so ("Counted by Gild").
- **Credits** are an account budget with no period: the user enters the amount and the day it was bought ("$50 bought on 10 Nov"), and the row shows what is left ("$31 left", or "≈ $31 left" when some of the spending was estimated). Gild counts the account's spending since that day. **Add credit** raises it; a new amount and day start a new count.
- Gild cannot read a provider's own balance and does not try: it holds no provider credentials (requirements, Comply with provider terms).
- Removing an account removes its budget.

### Seeing budget use and consumption

- A mission with a budget shows a ring per limit (cost, tokens) that fills as it is used: orange from 80%, red at 100%. A mission with no budget shows only its spending. Guildmaster shows the same, the global budget shows its rings at the top of the dashboard, and an account's budget shows on its row in the Charter and beside the account in the thread panel.
- Spending, with its estimated cost, shows on: the quest card; the information of each quest and each side-quest (the quest panel's and the thread panel's rows for what a thread alone spent, and the quest's total); the dashboard row; the rail beside the reserves as one figure for the global period ("≈ $12 this month"); and the budget window.
- Selecting a ring opens a budget window, like a context window: what is used out of the limit, the split by thread, by harness, by account, and by model, with each part's tokens by kind, billing kind, and cost (reported or estimated), and for the global budget when the period starts over.
- **Under each agent reply**, a small line such as `1,240 tokens · ≈ $0.02` shows what the model call behind it used, where the harness reports usage per model call. Where it reports only per turn, the turn's line shows once, under the turn's last reply. Where it reports nothing, no line shows. The lines of a turn always add up to the turn's total. Provisional until a live probe shows which harnesses report per call.
- The ring turning orange or red is the warning; no message is sent at 80%.
- Each thread's starting context and the start of each turn carry one line on the budget, for example "Budget: $8.40 of $10 used (84%), global: 61% of this month, account Work: 40% of this month's tokens", so an agent can choose cheaper work as it gets close. With no budget at all, the line is left out. Estimated costs are not in the line.

### Plan limits

- For each account on a subscription, the owner sees each **plan limit** its harness reports (for example a 5-hour and a weekly window): how much is used and when it resets, with the time of the reading ("as of 14:02"). It shows on the account's row in the Charter, in the rail beside the reserves, and in the thread panel's Companion row. Orange from 80%, red at 100%, no message.
- The figures are the harness's own. **Codex** reports them through its app server, read at most one at a time, a reading standing for four minutes, and after a failed read the next waits 5 minutes, then 10, 20, and 40, up to an hour; the last reading stays shown meanwhile. **Claude Code** and **OpenCode** show what they report in their own streams once a live probe shows they do; until then they show "Limits not reported". Gild never reads a harness's token or credentials to ask a provider's usage endpoint (requirements, Comply with provider terms). Provisional for Claude Code and OpenCode until their probe is in.
- A limit never reported is never guessed. A reading goes stale when no turn runs, and the row says when it was read.
- Plan limits are shown only: the provider enforces them. A turn that fails at a provider's usage limit is handled as any failed turn, by the thread's backup Companions ([thread-panel](../thread-panel/specifications.md#backup-companions)).

### Reaching a limit

- When a mission's or Guildmaster's budget is reached partway through a turn, the turn stops at once and every running thread under that budget goes to Attention. The thread that reached it asks the user with **Raise budget** and **Stop**.
- When an account's budget is reached, every running thread on that account stops its turn and goes to Attention, across missions. The thread that reached it asks the user with **Raise budget**, **Switch to a backup Companion** (the thread is handed over to its next backup on another account or harness, [thread-handover](../thread-handover/specifications.md)), and **Stop**. Threads on other accounts keep running.
- When the global budget is reached, every running thread, Guildmaster included, stops its turn and goes to Attention, with one shared question at the top of the dashboard: **Raise budget** or **Stop all**.
- **Raise budget** opens a field with the current limit, quick raises (+25%, +50%, double), and an option to remove the limit; for credits, **Add credit**. The stopped threads then resume on their own. **Stop** leaves them stopped.
- At a reached limit, `open_thread` is refused with the reason shown in the thread (see [thread-tree](../thread-tree/specifications.md#limits)), and opening a new mission, from the dashboard or by Guildmaster, is refused with the reason and a **Raise budget** button. A thread opened on an account at its budget is refused with the reason.
- Lowering a budget below what is already spent stops its running threads the same way. Lowering never undoes spending.
- A harness that reports spending only at the end of a turn can go a little over a limit; the stop comes as soon as the spending is reported.

### Record

- Every budget change (set, raised, lowered, removed) and every stop at a limit appears as a short line in the mission's top thread, or in Guildmaster, for example "Budget raised to $15 · 14:02 · phone". Global budget events appear in Guildmaster. A stop at an account's budget appears as a line in each stopped thread's quest, for example "Account Work reached its budget · $50.00 · 14:02"; a change to an account's budget shows in the account's row.

## External contract

No thread tool: threads read their budget use from their context and cannot change a budget. `open_thread` and `open_mission` answer a reached budget with a refusal and its reason.

## Acceptance and validation

- **Automated, with a fake harness reporting spending and its billing kind**:
  - cost and token limits counted separately by billing kind, an Unknown turn counting as Subscription, a turn counting toward one unit only, and an empty limit never stopping;
  - an estimated cost never counting toward a limit, except for an API-key turn whose harness reported no cost;
  - a subscription turn with a reported cost counting tokens, not cost, so token budgets see Claude Code turns;
  - the estimated cost worked out from the price table by token kind, stamped with the model and the table's date, unchanged by a later table, unpriced with "no price for <model>" when the model is missing, and the harness's own figure standing when the table lacks the model;
  - turns recorded before the feature left unpriced, and totals saying how many;
  - the price table read at startup and daily, a failed read keeping the kept table, an offline start using the shipped snapshot, the Fetch prices switch off using only the snapshot, and the request carrying nothing about missions;
  - every thread in a mission drawing on the mission's budget, and spending counted toward the mission's, the account's, and the global budget;
  - the default mission budget applied to new missions, and a mission's budget changed from the mission;
  - the global budget starting over at the start of a day, week, and month in local time;
  - an account budget over a period and over no period, credits counted from the day entered, Add credit, and a removed account taking its budget;
  - a turn stopped at once when spending crosses a limit, the threads under it in Attention, and the question answered with Raise budget (threads resume) and Stop (they stay stopped);
  - an account's limit stopping its threads across missions and no others, Switch to a backup Companion handing the thread over, and a thread opened on that account refused;
  - the global limit stopping every running thread, Guildmaster included, with one shared question;
  - `open_thread` and opening a mission refused at a reached limit, with the reason;
  - lowering a budget below the spending stopping running threads;
  - the budget line in a thread's starting context and turns, with the account part, and left out with no budget;
  - no thread able to change a budget;
  - each change and stop recorded as a line in the mission's top thread or in Guildmaster, and the account's stop line in each stopped quest;
  - the figures of a turn's reply lines adding up to the turn's total, with a harness reporting per call, per turn only, and nothing;
  - plan limits read from a fake Codex report, paced as agreed, the last reading kept after a failed read, "Limits not reported" for a harness with none, and no read of any token or credential.
- **Live probes** (opt-in, each recorded before its provisional part is built): which of Claude Code, Codex, and OpenCode report usage per model call; whether Claude Code's stream carries its plan windows (`rate_limit_event`) and OpenCode reports any; how each reports its billing kind (Claude Code's `apiKeySource`, Codex's sign-in mode, OpenCode's provider); whether Claude Code's `total_cost_usd` is a running total per process.
- **Human acceptance**: on the desktop and on the phone web app, the user sets a $2 budget on a mission, watches its ring turn orange then red, opens the budget window to see which thread, harness, and model spent most, gets the stop question, raises the budget by 50%, and sees the threads carry on. The user then reads `≈` figures on a quest card, on a side-quest's information, and under agent replies, turns Fetch prices off and sees the snapshot line, enters $5 of credit on an API-key account and sees what is left, and reads a Codex account's plan limits.

## Requirements

- [Bring your own provider](../../requirements.md): budgets bound the user's own provider use, in each provider's own unit.
- [End-to-end encrypted phone traffic](../../requirements.md): a notification for a stop at a limit carries no content.
- [Comply with provider terms](../../requirements.md): plan limits and credits are never read with a provider's credentials or session token.
- [Price table read carries no owner data](../../requirements.md): the price table's request carries nothing about missions, workspaces, or accounts, and can be switched off.

## Dependencies

- [mission-tracking](../mission-tracking/specifications.md): spending per provider unit, and the dashboard where the rings and estimates appear.
- [thread-tree](../thread-tree/specifications.md): `open_thread` refusals and the Attention state.
- [mission-coordination](../mission-coordination/specifications.md): Guildmaster, its own budget, and `open_mission` refusals.
- [action-approval](../action-approval/specifications.md): the question with buttons and the line format for recorded answers.
- [provider-accounts](../provider-accounts/specifications.md): the accounts that carry budgets, credits, and plan limits, and the sign-in a billing kind is read from.
- [thread-panel](../thread-panel/specifications.md): the rows that show a thread's spending, and the backup Companions a stop at an account's budget hands over to.
- **thread-handover**: a thread handed over to another provider keeps drawing on the same mission budget, and its later turns draw on the new account's.

## Exclusions

- Budgets on single threads, or split between threads.
- One limit per harness or per model.
- A thread raising a budget, or asking for a raise through a tool.
- An estimated cost counting toward a limit, apart from the API-key case above.
- Enforcing a subscription's own limits: the provider does. Gild shows them.
- Reading a provider's own balance, or any call to a provider's usage or billing endpoint with the user's credentials.
- Currencies other than US dollars.
- Pricing turns recorded before the feature, and re-pricing any turn.
- Switching from a harness's command-line tool to a vendor SDK: [decision record 0008](../../architecture-decision-record/0008-drive-harness-tools-directly.md) stands for Claude Code and Codex; OpenCode's HTTP server is a probe in the [backlog](../../backlog.md).

## Technical notes

- The proposed design is the [blueprint](blueprint.md); its decision record for the price read is [0014](../../architecture-decision-record/0014-model-prices-from-a-public-table.md) (proposed).

- Harness adapters report spending events as they arrive in the harness's stream; the local service totals them per mission, Guildmaster, account, and global period, and stops a turn through the adapter when a limit is crossed.
- `spending.ts` counts tokens only when a row has no cost (`CASE WHEN u.cost IS NULL`), and Claude Code turns record `total_cost_usd` as `cost` (CHG-0077), so a subscription Claude turn leaves every token budget today. The billing kind must replace that test: the budget selects by kind. The design records the billing kind, the reported cost, and the estimated cost as separate fields.
- The price table fits models.dev's `api.json` (about 6 MB); only the models the harnesses offer need to be kept.
- OpenBot's usage-read pacing (one read at a time, a 4-minute reading, 5 to 60 minute back-off) is the model for the plan-limit reads; its direct calls to vendor endpoints with a CLI's token are not.
- Whether the budget window is grouped with the context gauge is left to the thread panel and context gauge item in the [backlog](../../backlog.md).
