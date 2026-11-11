# Thread panel

## Problem and outcome

A thread's header shows its state and a few links, but not what it runs with, what it costs, or how full its context window is. The owner cannot tell when a long thread is about to lose its early context, or what filled it. The thread panel shows all of that for the selected thread, beside its conversation, and a context gauge says how full the window is and what fills it.

Status: agreed by the owner's instruction to build the backlog entry "Thread panel and context gauge" unattended (2026-11-09). Everything below that the owner did not decide is **provisional** until the owner reviews it (changelog CHG-0079).

## Agreed behavior

### The panel

- The thread's groups live in the quest panel, the window's one side panel, at any width (the owner asked for one side panel instead of two, 2026-11-10, CHG-0109). The panel has no tabs and no link in the thread's header. Each group is a small label above a card of rows; a row has an icon, a name, a short value, and a chevron when pressing it opens something. Under the quest's heading come **Companions**, **Knows**, and **Does** (the grouping follows OpenBot's agent panel, at the owner's request, CHG-0111). It shows, for the selected thread:
  - **Companions**: the harness (with the account when it is not this computer's; for any account, including this computer's, its plan limits and budget when it has them, [budget-control](../budget-control/specifications.md#plan-limits)); the model and the effort; **Backup companions**, with how many there are, which opens their menu (below); and the context gauge (below).
  - **Knows**: the quest's journal; the realm (workspace name and folder, or the quest's scratch folder); **Lore** (how many intels are in scope and the share of the context window they take, which opens the lore panel); and **Skills**, one row with how many the owner can name in a message in this thread's folder, which shows their names in a block when pressed.
  - **Does**: what this thread alone spent (turns, API cost, tokens counted as subscription use, and the estimated cost as `≈ $1.20`, agreed in [budget-control](../budget-control/specifications.md#estimated-cost), CHG-0126), the quest's budget and usage, as the quest panel shows them, and Archive (none on a Ritual).
- **A side-quest's panel** is headed with the side-quest's own title, and a **Quest** row that names its quest and opens it.
  Mark as done is removed from both the quest and side-quest panels (CHG-0135 and CHG-0136).
  The quest's Archive action is in the quest's own panel.

### Backup companions

- A thread has an ordered list of backup Companions, at most five, each a harness, an account, a model, and an effort, as a Ritual's fallbacks have (rituals). It is empty at first, or holds the Charter's list when the thread starts (below).
- The **Backup companions** row opens in place, under itself in the panel (the owner: the choice should be directly in the sidebar, not a full screen, CHG-0115): what the list does, then the order, each entry with a header of its number, a move up, a move down, and Remove, and its harness, account, model, and effort pickers beneath, then **+ Add a backup Companion**. Every change is saved at once.
- When a turn of the thread fails, the thread is handed over to the next backup that differs from its current Companion, the conversation so far carried over and the line saying why (thread-handover, ADR 0006: "Fell back to Codex · gpt-6.1-sol · default effort · Usage limit reached"), and the turn runs again. A backup that cannot be taken, such as one on a removed account, is passed over. When the list is used up the thread stays Failed. The count starts over when a turn completes, when the owner changes the Companion or the list.
- A Ritual's thread falls back through the Ritual's own list first (rituals); this list is empty there.
- The Charter has a **Backup companions** card, under the default harness, model, and effort, with the same list: up to five, each with harness, account, model, and effort, a move up and a move down, Remove, and **+ Add a backup Companion**, saved at once. It is empty at first. A quest's top thread starts with a copy of it, and a side-quest starts with a copy of its parent's list. Changing the Charter's list later leaves quests that began already as they were; each quest changes its own from its panel.

- The panel changes with the selected thread and with the thread's work; it is read-only apart from the backups and the quest actions described above.
  Changing a model, effort, or budget stays where it is today.
- The panel is shown or hidden with the quest panel's icon in the top bar.

### The context gauge

- The gauge shows how many tokens the thread's context holds and the chosen model's context window, as a bar and a percentage.
- **Used** is what the harness reported for the thread's latest model call in its latest turn: input, cached input, and output tokens together. A thread that has not finished a turn, or whose harness reported no usage, shows "Not measured yet"; a number is never guessed.
- The bar is split into parts: **Instructions** (what every thread receives, the workspace line, the approval rules, and the thread's position), **Lore** (the intel in scope), **Journal** (the quest's briefing and entries), **Messages** (this thread's conversation), and **Tools and results** (everything else the harness reported: tool definitions, tool calls, and their results). The first four are counted from what Iskios sends, about four characters to a token; the last is the remainder of the reported total, never below zero.
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
