# Mission tracking

Technical design: [proposed blueprint](blueprint.md), including the first slice's staged acceptance.

## Problem and outcome

When work runs in many threads across harnesses, the user loses track of which missions exist, which need them, and what they cost. The dashboard shows every mission with one state, its threads, and its spending, starts new missions in one message, and ends finished ones, so the user always knows where their work stands.

## Agreed behavior

### Missions

- A mission is its top thread and every thread beneath it (see [thread-tree](../thread-tree/specifications.md#threads-and-missions)). Deleting the top thread deletes the mission.

### Starting a mission

- The user starts a mission from the dashboard with a first message, a harness, agent, model, effort, and workspace (or none).
- All but the message are prefilled from the user's last choices, so a mission starts with one message and Enter.
- A new mission's top thread starts as **Open as new mission** does in [thread-tree](../thread-tree/specifications.md#off-topic-requests): with global skills and intel, and nothing from another mission.
- The owner can create a quest directly from a Realm or Free Realm without going through Guildmaster.
  The quest belongs to that realm and receives its lore; a workspace-backed Realm also supplies its workspace.
- Proposed sidebar control: a `+` button beside each Realm and Free Realm opens a new quest there.
  The owner suggested this placement; its final appearance remains to be decided.

Direct realm creation was agreed on 2026-11-10 (CHG-0133); implementation and verification remain pending.

### Quest placement and moves

Agreed on 2026-11-10 (CHG-0130); implementation and verification remain pending.

- A quest belongs to a Realm tied to a workspace, to a Free Realm with no workspace, or to no realm (realmless).
- Lore access follows [lore scopes](../scoped-intel/specifications.md#scopes).
- The owner can move an existing quest between any of these placements, including correcting a quest started in the wrong workspace.
- The sidebar supports dragging a quest from its current Realm, Free Realm, or realmless group onto another placement.
- Before changing placement, Gild asks for confirmation naming the source and destination and explaining that the available realm lore will change.
  Confirm applies the move; Cancel leaves the quest and its tree in their original placement.
  This confirmation applies to every placement-changing move, including making a quest realmless, whichever interface initiates it.
- A move includes the quest and every side-quest at every depth, including threads explicitly attached to another workspace; no branch stays behind.
- A move is refused while any thread in the quest tree is running; it does not stop running threads automatically.
  The running-thread check applies when the owner confirms, even if no thread was running when the drag began.
- Moving into a workspace-backed Realm changes the workspace of every thread in the tree to that Realm's workspace.
- Moving into a Free Realm or making a quest realmless removes workspace attachments throughout the tree; its threads then use the quest's scratch folder.
- The conversation, journal, and thread-scoped lore stay with the quest; shared lore access follows the destination, without copying lore between realms.
- Earlier conversation content can still refer to the former realm or workspace; a move does not rewrite that history.
- A quest is independent of the artifacts it produces or modifies; moving it does not move, copy, or delete files, edits, branches, or existing own copies.
- Existing own copies remain accessible at their original locations, which the interface shows after a move.
- A move does not merge old own copies into the destination workspace or use them as its working folder.
- Moving changes future turns' workspace context; relocating a workspace's folder is a separate operation in [workspace attachment](../workspace-attachment/specifications.md#missing-folder).

Sidebar drag-and-drop and confirmation were agreed on 2026-11-10 (CHG-0133); implementation and verification remain pending.

### Title

- The top thread proposes a title on its first turn with `set_mission_title`.
- The user can rename a mission at any time. Once the user has renamed it, `set_mission_title` is refused.

### Mission state

- While a mission is not ended, its state is the most urgent state among its threads, in this order: Attention, Failed, Running, Waiting, Idle.
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

- Each mission row shows its title, state, workspace, thread count with how many are running, spending with its budget rings when it has a budget, and last activity.
- Missions that need the user come first; the rest follow by latest activity.
- The user can filter by state and workspace, and search titles and briefings.
- Archived missions have their own view.
- The dashboard is a list, not a board.
- The phone web app shows the same dashboard, with the same filters and actions.

### Spending

- A mission's spending is the total of its threads' spending, in each provider's own unit: a cost for API-key turns, tokens for subscription turns, chosen by each turn's billing kind. What counts toward a limit, and the one case where an estimate does, is agreed in [budget-control](../budget-control/specifications.md#budgets).
- Beside them, every turn whose model has a price carries an estimated cost, shown as `≈ $1.20` on the mission's card, row, and information, and on each side-quest's. Estimates, billing kinds, and the price table are agreed in [budget-control](../budget-control/specifications.md#estimated-cost) (CHG-0126).

### Compact left navigation

- The owner agreed on 2026-11-10 to a narrower main left menu with smaller icons, tighter rows, readable labels, and the existing collapse and resize controls.
- The starting proportions are about 220px wide and 15px labels instead of 17px, with less space around crests and the Guild styling retained.
- The owner judges the final proportions in the running app.
- The quest tree's separate column follows [quest tree visibility](../thread-tree/specifications.md#quest-tree-visibility).
- Agent validation checks navigation, collapse, resizing, and readable access to long labels at the reduced width; human acceptance checks the proportions in the running app.

## External contract

Threads use this thread tool (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `set_mission_title` | Name the mission | A title | Done, or a refusal when the user has renamed the mission |

## Acceptance and validation

- **Automated, with a fake harness**:
  - direct creation from a Realm or Free Realm placing the quest there with the correct lore and workspace, without a Guildmaster turn;
  - dragging quests between sidebar placements opening the move confirmation, with no placement change before confirmation and none on Cancel;
  - confirming a move refused if any descendant starts running while confirmation is open;
  - quests in a workspace-backed Realm, a Free Realm, and no realm, with the correct shared lore;
  - moving the entire quest tree between each placement, including nested threads with a different prior workspace;
  - refusing the move without changing any placement or attachment when any thread in the tree is running;
  - preserving conversations, journals, and thread lore while changing workspace attachments and shared lore access;
  - leaving files, edits, branches, and own copies at their original locations after a move, with old own-copy locations still accessible;
  - a mission's state worked out from its threads, in the order of urgency;
  - the top thread's result asking "Mark as done?" without ending the mission;
  - the inactivity question after the set duration, agent activity resetting it, and a dismissed question coming back;
  - the confirmation naming running threads before Done or archiving, and those threads stopped;
  - spending totalled per provider unit by billing kind, with an estimated cost beside it that never counts toward a limit (budget-control);
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
- [mission-journal](../mission-journal/specifications.md): the entry added when a mission ends, and the briefings searched.
- [budget-control](../budget-control/specifications.md): budgets and their rings beside the spending shown.

## Exclusions

- Budgets and their limits belong to budget-control.
- Guildmaster, which opens missions for the user, belongs to mission-coordination.
