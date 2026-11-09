# Thread panel

## Problem and outcome

A thread's header shows its state and a few links, but not what it runs with, what it costs, or how full its context window is. The owner cannot tell when a long thread is about to lose its early context, or what filled it. The thread panel shows all of that for the selected thread, beside its conversation, and a context gauge says how full the window is and what fills it.

Status: agreed by the owner's instruction to build the backlog entry "Thread panel and context gauge" unattended (2026-11-09). Everything below that the owner did not decide is **provisional** until the owner reviews it (changelog CHG-0079).

## Agreed behavior

### The panel

- Every thread has a panel, a 300px column beside its conversation, shown or hidden by a "Thread panel" link in the thread's header; it is hidden at first, and below 820px wide there is no panel. It shows, for the selected thread:
  - **Companion**: the harness (with the account when it is not this computer's), the model, and the effort.
  - **Realm**: the workspace name and folder, or the quest's scratch folder.
  - **State**: the thread's state.
  - **Context**: the context gauge (below).
  - **Lore**: how many intels are in scope and the share of the context window they take, with a link that opens the lore panel.
  - **Skills**: the skills the owner can name in a message in this thread's folder, by name.
  - **Budget**: the quest's budget limits and what the quest spent, as the quest panel shows them.
  - **Spending**: what this thread alone spent: turns, API cost, and tokens counted as subscription use.
- The panel changes with the selected thread and with the thread's work; it is read-only. Changing a model, effort, or budget stays where it is today.
- The owner's choice to show or hide the panel is remembered in the browser storage, as the rail's is; there is no terminal.

### The context gauge

- The gauge shows how many tokens the thread's context holds and the chosen model's context window, as a bar and a percentage.
- **Used** is what the harness reported for the thread's latest model call in its latest turn: input, cached input, and output tokens together. A thread that has not finished a turn, or whose harness reported no usage, shows "Not measured yet"; a number is never guessed.
- The bar is split into parts: **Instructions** (what every thread receives, the workspace line, the approval rules, and the thread's position), **Lore** (the intel in scope), **Journal** (the quest's briefing and entries), **Messages** (this thread's conversation), and **Tools and results** (everything else the harness reported: tool definitions, tool calls, and their results). The first four are counted from what Gild sends, about four characters to a token; the last is the remainder of the reported total, never below zero.
- The bar is orange from 80% and red from 95% of the window. No message is sent at either.
- The window is the chosen model's, 200,000 tokens until each harness reports its own (see the lore gauge in [scoped-intel](../scoped-intel/specifications.md)).

## Edge cases

- A thread that ended a turn by interrupt keeps the last reported measure if the harness gave one, else "Not measured yet".
- A new thread opened beneath another starts at "Not measured yet", not at its parent's measure.
- Restarting the harness's process or resuming its session does not reset the measure; the next turn replaces it.
- A model change shows the measure against the new model's window straight away; the used count stays the last reported.
- Skills read from the thread's folder at the time the panel is read; a folder that is gone shows the skills from the owner's home only.

## Acceptance

- A thread that reported usage shows its context gauge with parts whose sum equals the reported total, and the remainder never negative.
- A thread with no usage shows "Not measured yet" and no parts.
- The panel's Spending for a thread counts only that thread's turns, while Budget shows the quest's.
- The panel lists the thread's harness, model, effort, and realm as the header does.
- Over 80% and 95% the gauge reads orange and red.

## Not built

- A budget window joined with the gauge (the backlog entry asked whether they should join; for now they stay apart).
- Skills as a part of the gauge: threads do not load skills into their context yet; only the owner's slash names reach them.
- Each model's real window per harness; and a breakdown reported by the harness itself.

## Related

[mission-tracking](../mission-tracking/specifications.md), [budget-control](../budget-control/specifications.md), [scoped-intel](../scoped-intel/specifications.md), [thread-tree](../thread-tree/specifications.md), [tool-and-skill-loading](../tool-and-skill-loading/specifications.md).
