# Budget control

## Problem and outcome

Threads open threads on their own, many at once, on the user's own provider accounts. Without limits, one mission can spend far more than the user meant. Budgets on each mission, on Guildmaster, and on all spending over a period stop new spending at a limit the user chose, and show at a glance how close each one is, so the user pays for the work knowingly.

## Agreed behavior

Version 1 serves the installation's owner. In future hosted missions, guest-triggered work uses the host's provider account and counts toward the mission and global budgets. Only the host changes budgets (CHG-0017). See the [hosted agreements](../../architecture.md#future-multiplayer-open-architecture-questions).

### Budgets

- A budget holds two optional limits: a **cost** limit for all API-key spending and a **token** limit for all subscription spending, matching the units in [mission-tracking](../mission-tracking/specifications.md#spending). An empty limit means no limit. Tokens are never converted into a price.
- Budgets exist on missions, on Guildmaster, and as one **global budget**. Single threads have no budget of their own: every thread in a mission draws on the mission's budget.
- A mission's budget and Guildmaster's budget cover their whole life and have no period.
- The global budget covers the spending of all missions and Guildmaster over a period the user chooses: **Day**, **Week**, or **Month** (the default). A period starts at local midnight, on Monday for a week and on the 1st for a month.
- Spending counts toward its mission's or Guildmaster's budget and toward the global budget; a thread stops at whichever limit it reaches first.

### Setting budgets

- Settings hold an optional default mission budget, empty at first, applied to each new mission, and the global budget with its period, also empty at first.
- The user sets, changes, or removes a mission's budget from the mission itself, and Guildmaster's from Settings or from Guildmaster. No budget is set on Guildmaster by default.
- Only the user sets or raises a budget. No thread can, and no thread gives part of a budget to another.

### Seeing budget use

- A mission with a budget shows a ring per limit (cost, tokens) that fills as it is used: orange from 80%, red at 100%. A mission with no budget shows only its spending. Guildmaster shows the same, and the global budget shows its rings at the top of the dashboard.
- Selecting a ring opens a budget window, like a context window: what is used out of the limit, the split by provider and by thread, and for the global budget when the period starts over.
- The ring turning orange or red is the warning; no message is sent at 80%.
- Each thread's starting context and the start of each turn carry one line on the budget, for example "Budget: $8.40 of $10 used (84%), global: 61% of this month", so an agent can choose cheaper work as it gets close. With no budget at all, the line is left out.

### Reaching a limit

- When a mission's or Guildmaster's budget is reached partway through a turn, the turn stops at once and every running thread under that budget goes to Attention. The thread that reached it asks the user with **Raise budget** and **Stop**.
- When the global budget is reached, every running thread, Guildmaster included, stops its turn and goes to Attention, with one shared question at the top of the dashboard: **Raise budget** or **Stop all**.
- **Raise budget** opens a field with the current limit, quick raises (+25%, +50%, double), and an option to remove the limit. The stopped threads then resume on their own. **Stop** leaves them stopped.
- At a reached limit, `open_thread` is refused with the reason shown in the thread (see [thread-tree](../thread-tree/specifications.md#limits)), and opening a new mission, from the dashboard or by Guildmaster, is refused with the reason and a **Raise budget** button.
- Lowering a budget below what is already spent stops its running threads the same way. Lowering never undoes spending.
- A harness that reports spending only at the end of a turn can go a little over a limit; the stop comes as soon as the spending is reported.

### Record

- Every budget change (set, raised, lowered, removed) and every stop at a limit appears as a short line in the mission's top thread, or in Guildmaster, for example "Budget raised to $15 · 14:02 · phone". Global budget events appear in Guildmaster.

## External contract

No thread tool: threads read their budget use from their context and cannot change a budget. `open_thread` and `open_mission` answer a reached budget with a refusal and its reason.

## Acceptance and validation

- **Automated, with a fake harness reporting spending**:
  - cost and token limits counted separately, with tokens never priced, and an empty limit never stopping;
  - every thread in a mission drawing on the mission's budget, and spending counted toward both the mission's and the global budget;
  - the default mission budget applied to new missions, and a mission's budget changed from the mission;
  - the global budget starting over at the start of a day, week, and month in local time;
  - a turn stopped at once when spending crosses a limit, the threads under it in Attention, and the question answered with Raise budget (threads resume) and Stop (they stay stopped);
  - the global limit stopping every running thread, Guildmaster included, with one shared question;
  - `open_thread` and opening a mission refused at a reached limit, with the reason;
  - lowering a budget below the spending stopping running threads;
  - the budget line in a thread's starting context and turns, and left out with no budget;
  - no thread able to change a budget;
  - each change and stop recorded as a line in the mission's top thread or in Guildmaster.
- **Human acceptance**: on the desktop and on the phone web app, the user sets a $2 budget on a mission, watches its ring turn orange then red, opens the budget window to see which thread spent most, gets the stop question, raises the budget by 50%, and sees the threads carry on.

## Requirements

- [Bring your own provider](../../requirements.md): budgets bound the user's own provider use, in each provider's own unit.
- [End-to-end encrypted phone traffic](../../requirements.md): a notification for a stop at a limit carries no content.

## Dependencies

- [mission-tracking](../mission-tracking/specifications.md): spending per provider unit, and the dashboard where the rings appear.
- [thread-tree](../thread-tree/specifications.md): `open_thread` refusals and the Attention state.
- [mission-coordination](../mission-coordination/specifications.md): Guildmaster, its own budget, and `open_mission` refusals.
- [action-approval](../action-approval/specifications.md): the question with buttons and the line format for recorded answers.
- **thread-handover**: a thread handed over to another provider keeps drawing on the same mission budget.

## Exclusions

- Budgets on single threads, or split between threads.
- Converting tokens into a price, or one limit per provider.
- A thread raising a budget, or asking for a raise through a tool.
- Tracking a subscription's own usage caps; the provider enforces those.

## Technical notes

- Harness adapters report spending events as they arrive in the harness's stream; the local service totals them per mission, Guildmaster, and global period, and stops a turn through the adapter when a limit is crossed.
- Whether the budget window is grouped with the context gauge is left to the thread panel and context gauge item in the [backlog](../../backlog.md).
