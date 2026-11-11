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
- A new-quest button beside each Realm and Free Realm creates an empty quest there; Realmless also has one. It uses the last quest's harness and model and is named "New quest" until its first message names it.

Direct realm creation was agreed on 2026-11-10 (CHG-0133) and implemented in `f21e768`; its appearance awaits the owner.

### Quest placement and moves

Agreed on 2026-11-10 (CHG-0130). Creation in a Free Realm is implemented; moving existing quests remains pending.

- A quest belongs to a Realm tied to a workspace, to a Free Realm with no workspace, or to no realm (realmless).
- Lore access follows [lore scopes](../scoped-intel/specifications.md#scopes).
- The owner can move an existing quest between any of these placements, including correcting a quest started in the wrong workspace.
- The sidebar supports dragging a quest from its current Realm, Free Realm, or realmless group onto another placement.
- Before changing placement, Iskios asks for confirmation naming the source and destination and explaining that the available realm lore will change.
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

- A non-archived quest is idle, running, or asking for the user (Summons).
- Done, Finished, and Fulfilled are no longer quest or side-quest statuses (CHG-0135 and CHG-0136, agreed on 2026-11-11; implementation pending).
- Reporting a result does not finish or archive a quest, and there is no "Mark as done?" prompt.
- A quest whose work is complete remains available until the owner archives it.
- A quest shows Summons if any thread needs the owner; otherwise it shows running while any thread has a turn in progress, and idle otherwise.
- A failure requiring owner intervention produces Summons with its reason.
  Waiting and stopped remain visible thread details, and stopped threads require explicit resume.
- Reporting a side-quest's result still informs its parent, then leaves it idle unless it has more work or needs the owner.
- No migration of existing Done quests or side-quests is required: the product is unshipped, and the owner accepts resetting development data instead (CHG-0137).
  This specification does not perform a reset.

### Ending a mission

- The user archives a quest when it is no longer needed in the active list; marking a quest Done is removed.
- After 14 days without activity, the dashboard asks whether to archive the quest; it no longer offers Mark as done.
  The question is not sent as a phone notification.
- Activity is any turn or message in any of the mission's threads, by the user or by an agent. A dismissed question comes back after another 14 days without activity.
- Archiving a mission with running threads asks one confirmation that names them, for example "2 threads are still running. Stop them and archive?", then stops them.
- The previous auto-archive rule based on time since Done no longer applies; no replacement automatic archiving rule is agreed.
- The inactivity duration is adjustable in settings.
- An archived mission leaves the main list and appears in the Archived view, from which the user can reopen it.
- Writing in a thread of an archived mission brings the mission back to the active list and the state worked out from its threads.
- Archiving a mission adds an entry to its journal (see [mission-journal](../mission-journal/specifications.md#when-a-mission-ends)), and `find_missions` still matches archived missions.

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
- The original compact proportions used a width around 220 px and 15 px labels. The current sidebar minimum is 236 px, an estimate intended to keep “Free Realms” on one line; its appearance awaits the owner.
- The owner judges the final proportions in the running app.
- The quest tree lives within the main sidebar, following [quest tree visibility](../thread-tree/specifications.md#quest-tree-visibility).
- Agent validation checks navigation, collapse, resizing, and readable access to long labels at the reduced width; human acceptance checks the proportions in the running app.

### Left navigation structure

Agreed on 2026-11-11 (CHG-0134). The owner then asked for the sidebar to be built (CHG-0143); direct creation is built (`f21e768`); confirmed quest moves and lifecycle changes remain to build.
This navigation scope is specified; [related capability work](draft.md) is deferred to the relevant capability's implementation preparation.

The expanded left sidebar uses this order:

| Position | Entry | Contents or destination |
| --- | --- | --- |
| 1 | Guild Hall | The place where the owner talks with Guildmaster |
| 2 | Realms | Workspace-backed Realms, each containing its quests and their nested side-quests |
| 3 | Free Realms | Workspace-free Realms, each containing its quests and their nested side-quests |
| 4 | Realmless | Quests outside any realm, each with its nested side-quests |
| 5 | Rituals | Routines |
| 6 | Craft | Workflows |
| 7 | The Keep | Library, Lore, Archive, in that order |
| 8 | Reserves | Compact usage summary leading to a detailed usage page |
| 9 | Charter | Placeholder page |
| 10 | Workshop | Application settings, accounts, permissions, and defaults (the former Charter; CHG-0146) |

The separate Workshop for MCP servers, connectors, and skills (position 8 of CHG-0134) is withdrawn for now; the owner will ask for a dedicated menu for them later.

- Each Realm and Free Realm can expand or collapse its quests; each quest and side-quest can expand or collapse its children at every supported depth.
- Realmless has no intermediate realm grouping.
- Each Realm and Free Realm shows its three newest quests, and Realmless its five newest; the open quest remains visible beyond the cap. A "Show all N quests" link opens the corresponding full list, most recent first. The Realmless cap awaits confirmation.
- A workspace-backed Realm's quest list offers its realm panel, including crest, lore, and rename controls. Free Realm and Realmless panel content remains undecided.
- The sidebar is the only left quest tree; the conversation retains its details sidebar on the right, following [quest tree visibility](../thread-tree/specifications.md#quest-tree-visibility).
- The owner's supplied Guild Hall image is the reference for the nested quest presentation: visible parent-child relationships, indentation, branch guides, expansion controls, and state indicators.
  The image does not authorize its other Guild Hall contents, footer, wording, or new actions.
- Library holds generated and uploaded artifacts, especially artifacts from quests without a workspace; it is not limited to workspace-free quests.
  Artifact collection, supported types, storage, retention, and file actions need a separate Library specification before implementation.
- A separate future resource-management destination is intended for MCP servers, connectors, and skills.
  Resource scope, inheritance, loading, and failures remain governed by [tool and skill loading](../tool-and-skill-loading/specifications.md).
  Additional Workshop categories and connector behavior are not settled by this navigation agreement.
- Reserves opens the [detailed usage page](../budget-control/specifications.md#reserves-usage-page); its name is retained.
- Quest placement, direct creation, and confirmed moves follow the existing agreements above.

Navigation acceptance, once the draft decisions are settled:

- **Agent validation**: check the ten entries and their order; the three Keep destinations; and Reserves access to the usage page.
- **Agent validation**: use quests in all three placements with multiple side-quest depths; expand and collapse parents, open descendants, and check that selection reaches the intended conversation.
- **Human acceptance**: compare the nesting with the supplied reference in the running desktop app and judge readability at the compact sidebar width.
- Agent validation includes more quests than the former recent-quests cutoff, an idle quest after reporting a result, archive and reopen, long titles, empty groups, and collapsed and narrow-screen navigation.

## External contract

Threads use this thread tool (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `set_mission_title` | Name the mission | A title | Done, or a refusal when the user has renamed the mission |

## Acceptance and validation

- **Automated, with a fake harness**:
  - direct creation from a Realm, Free Realm, and Realmless without a Guildmaster turn, checking placement, lore and workspace, the last harness and model, the initial title, and naming on the first message;
  - dragging quests between sidebar placements opening the move confirmation, with no placement change before confirmation and none on Cancel;
  - confirming a move refused if any descendant starts running while confirmation is open;
  - quests in a workspace-backed Realm, a Free Realm, and no realm, with the correct shared lore;
  - moving the entire quest tree between each placement, including nested threads with a different prior workspace;
  - refusing the move without changing any placement or attachment when any thread in the tree is running;
  - preserving conversations, journals, and thread lore while changing workspace attachments and shared lore access;
  - leaving files, edits, branches, and own copies at their original locations after a move, with old own-copy locations still accessible;
  - a mission's three active states, with Summons taking precedence over running and running over idle, including nested descendants;
  - a side-quest reporting its result to its parent and returning to idle, with no Mark as done action;
  - failures needing the owner producing Summons, waiting and stopped shown as details, and stopped threads staying stopped until explicitly resumed;
  - the top thread's result leaving the quest available without a Done state or Mark as done prompt;
  - the inactivity question after the set duration, agent activity resetting it, and a dismissed question coming back;
  - the confirmation naming running threads before archiving, and those threads stopped;
  - spending totalled per provider unit by billing kind, with an estimated cost beside it that never counts toward a limit (budget-control);
  - absence of the old Done-based auto-archive and finished-quest visibility controls;
  - writing in an archived mission bringing it back;
  - reopening from the Archived view;
  - the proposed title, the user's rename, and `set_mission_title` refused afterwards;
  - prefilled choices when starting a mission;
  - dashboard order, filters, and search.
- **Human acceptance**: on the desktop and on the phone web app, the user starts 3 missions, sees the one that needs them first, leaves a completed quest idle, archives one, and reopens it.

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
