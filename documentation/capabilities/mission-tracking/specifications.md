# Mission tracking

## Problem and outcome

When work runs in many threads across harnesses, the user loses track of which missions exist, which need them, and what they cost. The mission dashboard shows every mission with one state, its threads, and its spending, starts new missions in one message, and ends finished ones, so the user always knows where their work stands.

## Agreed behavior

### Missions

- A mission is its top thread and every thread beneath it (see [thread-tree](../thread-tree/specifications.md#threads-and-missions)). Deleting the top thread deletes the mission.

### Starting a mission

- The user starts a mission from the dashboard with a first message, a harness, agent, model, effort, and workspace (or none).
- All but the message are prefilled from the user's last choices, so a mission starts with one message and Enter.
- A new mission's top thread starts as **Open as new mission** does in [thread-tree](../thread-tree/specifications.md#off-topic-requests): with global skills and intel, and nothing from another mission.

### Title

- The top thread proposes a title on its first turn with `set_mission_title`.
- The user can rename a mission at any time. Once the user has renamed it, `set_mission_title` is refused.

### Mission state

- While a mission is not ended, its state is the most urgent state among its threads, in this order: Needs you, Failed, Running, Waiting, Idle.
- Done and Archived are set only when the mission ends, never worked out from its threads.
- When the top thread reports its result, the dashboard asks "Mark as done?". The mission does not become Done on its own.

### Ending a mission

- The user marks a mission Done by hand.
- After 14 days without activity, the dashboard asks of a mission "Archive it or mark it as done?". The question is not sent as a phone notification.
- Activity is any turn or message in any of the mission's threads, by the user or by an agent. A dismissed question comes back after another 14 days without activity.
- Marking Done or archiving a mission with running threads asks one confirmation that names them, for example "2 threads are still running. Stop them and mark as done?", then stops them.
- An auto-archive setting, off by default, archives a Done mission 30 days after it was marked Done.
- Both durations are adjustable in settings.
- An archived mission leaves the main list and appears in the Archived view, from which the user can reopen it.
- Writing in a thread of a Done or archived mission brings the mission back to the state worked out from its threads.
- Ending a mission adds an entry to its journal (see [mission-journal](../mission-journal/specifications.md#when-a-mission-ends)), and `find_missions` still matches Done and archived missions.

### Dashboard

- Each mission row shows its title, state, workspace, thread count with how many are running, spending, and last activity.
- Missions that need the user come first; the rest follow by latest activity.
- The user can filter by state and workspace, and search titles and journal summaries.
- Archived missions have their own view.
- The dashboard is a list, not a board.
- The phone web app shows the same dashboard, with the same filters and actions.

### Spending

- A mission's spending is the total of its threads' spending, in each provider's own unit: a cost for API-key providers, tokens for subscriptions, which report no price. Tokens are never converted into a price.

## External contract

Threads use this thread tool (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `set_mission_title` | Name the mission | A title | Done, or a refusal when the user has renamed the mission |

## Acceptance and validation

- **Automated, with a fake harness**:
  - a mission's state worked out from its threads, in the order of urgency;
  - the top thread's result asking "Mark as done?" without ending the mission;
  - the inactivity question after the set duration, agent activity resetting it, and a dismissed question coming back;
  - the confirmation naming running threads before Done or archiving, and those threads stopped;
  - spending totalled per provider unit, with subscription tokens never priced;
  - auto-archive off by default, and archiving a Done mission after the set duration when on;
  - writing in a Done or archived mission bringing it back;
  - reopening from the Archived view;
  - the proposed title, the user's rename, and `set_mission_title` refused afterwards;
  - prefilled choices when starting a mission;
  - dashboard order, filters, and search.
- **Human acceptance**: on the desktop and on the phone web app, the user starts 3 missions, sees the one that needs them first, marks one Done, archives one, and reopens it.

## Requirements

- [Local data](../../requirements.md): missions stay on the user's computer.
- [Single user](../../requirements.md): the dashboard shows one user's missions.

## Dependencies

- [thread-tree](../thread-tree/specifications.md): threads, their states, and deleting a mission.
- [mission-journal](../mission-journal/specifications.md): the entry added when a mission ends, and the summaries searched.
- **budget-control**: budgets behind the spending shown.

## Exclusions

- Budgets and their limits belong to budget-control.
- Control, which opens missions for the user, belongs to mission-coordination.
