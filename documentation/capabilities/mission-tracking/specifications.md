# Mission tracking

Technical design: [proposed blueprint](blueprint.md), including the first slice's staged acceptance.

## Problem and outcome

When work runs in many threads across harnesses, the user loses track of which missions exist, which need them, and what they cost. The dashboard shows every mission with one state, its threads, and its spending, starts new missions in one message, and ends finished ones, so the user always knows where their work stands.

## Agreed behavior

### Missions

- A mission is its top thread and every thread beneath it (see [thread-tree](../thread-tree/specifications.md#threads-and-missions)). Deleting the top thread deletes the mission.

### Starting a mission

- The user starts a mission from the dashboard with a first message, a harness, agent, model, effort, and workspace (or none).
- All but the message are prefilled, so a mission starts with one message and Enter: the Companion is always the Workshop's default Companion (harness, model, effort, on the computer's own sign-in; CHG-0257, replacing the last mission's choices), and the folder is the last mission's.
- A new mission's top thread starts as **Open as new mission** does in [thread-tree](../thread-tree/specifications.md#off-topic-requests): with global skills and intel, and nothing from another mission.
- The owner can create a quest directly from a Realm or the Borderlands without going through Guildmaster.
  The quest belongs to that realm and receives its lore; a Realm tied to a workspace also supplies its workspace.
- A new-quest button beside each Realm and in the Borderlands heading (the former Realmless section's control, renamed) creates an empty quest there. It uses the last quest's harness and model and is named "New quest" until its first message names it.

Direct realm creation was agreed on 2026-11-10 (CHG-0133) and implemented in `f21e768`; its appearance awaits the owner.

### Quest placement and moves

Agreed on 2026-11-10 (CHG-0130). On 2026-11-11 (CHG-0161) the placements were reduced to Realms and the Borderlands, and that change is built (CHG-0164; storage in [0015](../../architecture-decision-record/0015-realms-tied-or-not-and-one-borderlands.md)): creation in a Realm, with or without a workspace, and in the Borderlands is implemented; moving existing quests by dragging is built (CHG-0172).

- A quest belongs to a Realm, which may be tied to a workspace or not and shares lore across its quests, or to the Borderlands, which have no workspace and no shared lore.
- Lore access follows [lore scopes](../scoped-intel/specifications.md#scopes).
- The owner can move an existing quest between any of these placements, including correcting a quest started in the wrong workspace.
- The sidebar supports dragging a quest from its current Realm or the Borderlands onto another placement.
- Before changing placement, Iskios asks for confirmation naming the source and destination and explaining that the available realm lore will change.
  Confirm applies the move; Cancel leaves the quest and its tree in their original placement.
  This confirmation applies to every placement-changing move, including moving a quest into the Borderlands, whichever interface initiates it.
- A move includes the quest and every side-quest at every depth, including threads explicitly attached to another workspace; no branch stays behind.
- A move is refused while any thread in the quest tree is running; it does not stop running threads automatically.
  The running-thread check applies when the owner confirms, even if no thread was running when the drag began.
- Moving into a Realm tied to a workspace changes the workspace of every thread in the tree to that Realm's workspace.
- Moving into the Borderlands, or into a Realm tied to no workspace, removes workspace attachments throughout the tree; its threads then use the quest's scratch folder.
  Threads keep their harness sessions; the journal gets an entry saying the quest moved, which each turn's note carries (CHG-0172).
- The conversation, journal, and thread-scoped lore stay with the quest; shared lore access follows the destination, without copying lore between realms.
- Earlier conversation content can still refer to the former realm or workspace; a move does not rewrite that history.
- A quest is independent of the artifacts it produces or modifies; moving it does not move, copy, or delete files, edits, branches, or existing own copies.
- Existing own copies remain accessible at their original locations, which the interface shows after a move.
- A move does not merge old own copies into the destination workspace or use them as its working folder.
- Moving changes future turns' workspace context; relocating a workspace's folder is a separate operation in [workspace attachment](../workspace-attachment/specifications.md#missing-folder).

Sidebar drag-and-drop and confirmation were agreed on 2026-11-10 (CHG-0133) and built on 2026-11-11 for the web build (CHG-0172, [verification](../../verification/2026-11-11-quest-moves.md)); the owner's review of the look is pending.

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
- After the owner's quest-archive action succeeds, the interface returns to that quest's realm overview, or the Borderlands for a quest with no realm. Cancel and failure leave the current view unchanged.

### Archiving and restoring a realm

Agreed on 2026-11-13 (CHG-0268), built; the quest and Ritual choices below were agreed on 2026-11-14 (CHG-0270). This replaces the older Hide and Delete permanently proposal for realm removal in [workspace attachment](../workspace-attachment/specifications.md#hiding-and-deleting-a-workspace).

- The owner removes a realm from active use by archiving it, not by permanently deleting it. This applies to realms tied to a folder and to realms tied to none.
- **Archive realm…** is available in the realm's panel and through the same top-right archive button used for quests, acting on the realm when its overview is shown. Right-click actions are deferred.
- Every realm archive asks for confirmation naming the realm and counting its quests. Nothing changes before confirmation; Cancel leaves the realm unchanged.
- The confirmation also counts running threads across its quests, including nested side-quests. When any are running, the confirming action says **Stop and archive realm** and stops them as part of archiving.
- Archiving hides the realm and all its quests from active lists, the sidebar, and the Realms overview. Its identity, name, crest, lore, conversations, journals, and folder association are preserved. It never deletes the workspace folder.
- Archived realms appear in the Archive with a Restore action. Restore brings back the realm and the quests that were active when it was archived; quests already individually archived stay archived.
- After a successful realm archive, the interface goes to the Realms overview. Cancel or failure leaves the current view unchanged.
- **Quests that stay active** (agreed 2026-11-14, CHG-0270): the confirmation lists the realm's active quests, each with a checkbox, all unchecked. A checked quest moves with its whole tree to the Borderlands instead of being archived; every other quest is archived with the realm. A moved quest keeps its conversation, journal, and its own lore, but loses access to the realm's lore, and a later restore of the realm does not bring it back. A quest at work cannot be checked: a move never stops threads, so it is stopped and archived like the rest unless the owner stops it first. A Ritual's quest is not listed here.
- **Rituals** (agreed 2026-11-14, CHG-0270): the confirmation names the realm's Rituals and says they will be switched off. Archiving switches them off, stops a run underway, and keeps each Ritual and its quest in the Rituals place with its instruction and history, marked **Realm archived**. While the realm is archived a Ritual cannot be switched on or run. Restore and Start afresh leave the Rituals off until the owner switches them on. Moving a Ritual to the Borderlands is not offered.

### Reusing an archived realm's folder

Agreed on 2026-11-13 (CHG-0268); not implemented.

- One resolved folder belongs to one realm, including while that realm is archived. Choosing its folder during new-realm creation must not silently reuse a hidden realm or create a second realm for the same folder.
- The owner chooses the folder and fills the new-realm form. If the folder belongs to an archived realm, the flow then offers **Restore**, **Start afresh**, and **Cancel**, showing the archived realm's name, archive date, and quest count. A realm tied to no folder has no folder match.
- Restore keeps the realm's lore and brings its previously active quests back as described above.
- Start afresh reactivates the same realm id with no realm-level lore in use. All its previous quests stay archived, attached to that realm and findable in the Archive, with their own lore, conversations, and journals unchanged. Global lore is unchanged.
- Starting afresh deletes the realm-level lore through the existing recoverable [lore deletion and history](../scoped-intel/specifications.md#history-and-undo), not a permanent purge. The owner can recover those entries through the lore panel's Deleted filter.
- For both Restore and Start afresh, a two-column comparison then shows the archived realm's name and crest beside the proposed name and crest. The owner chooses the name and crest independently, so either combination is possible.
- Each comparison row is omitted when its two values are exactly the same; if neither row remains, the comparison popup is skipped. Restore defaults to the archived values, and Start afresh to the proposed values.
- A blank name in the form resolves to the folder's name and is treated as the proposed name for comparison. The form starts with a randomly shuffled crest, which is a proposed value, not an absent choice. These rules supersede the earlier proposal to treat blank fields as no choice.
- Start afresh has a final confirmation after the comparison, naming the realm and counting the realm-level lore entries to delete. Its actions are **Wipe lore and start afresh** and **Cancel**, and it explains recovery through the Deleted filter.
- Cancelling any step makes no change to the stored realm, its quests, or its lore. Neither path creates a new realm id or changes files in the workspace folder.

### Realm names

Agreed on 2026-11-13 (CHG-0268); not implemented.

- Realm names are labels, not identities, and duplicate names are allowed. Realms have distinct ids; folder-tied realms are also distinguished by their resolved folders.
- Creating or renaming a realm to a name shared by another active realm warns the owner and lets them confirm rather than blocking. Archived realms do not count as collisions.
- Where active names collide, folder-tied realms show a parent-folder hint alongside their name in the sidebar, the Realms overview, and realm pickers, for example `app · client-a`.
- A colliding realm tied to no folder has no folder hint; the warning still asks for confirmation.

### Dashboard

- Each mission row shows its title, state, workspace, thread count with how many are running, spending with its budget rings when it has a budget, and last activity.
- Missions that need the user come first; the rest follow by latest activity.
- The user can filter by state and workspace, and search titles and briefings.
- Archived missions have their own view.
- The dashboard is a list, not a board.
- The phone web app shows the same dashboard, with the same filters and actions.

### Realms overview

Agreed on 2026-11-13 (CHG-0268); not implemented.

- The Realms destination becomes a compact quest-list overview grouped by active realm, using the existing overview's row presentation rather than a new card layout.
- Each realm group has its crest and name, links to that realm's overview, and lists its active quests with state, Companion, latest activity, and foldable nested side-quests.
- Realm grouping takes precedence over day grouping. Include empty active realms with a New quest action; leave archived realms out.
- The Borderlands retain their own page and are not another realm group.
- An overview button beside the sidebar's Realms heading opens this destination. Pressing the heading or its fold arrow keeps the existing fold behavior.

### Spending

- A mission's spending is the total of its threads' spending, in each provider's own unit: a cost for API-key turns, tokens for subscription turns, chosen by each turn's billing kind. What counts toward a limit, and the one case where an estimate does, is agreed in [budget-control](../budget-control/specifications.md#budgets).
- Beside them, every turn whose model has a price carries an estimated cost, shown as `≈ $1.20` on the mission's card, row, and information, and on each side-quest's. Estimates, billing kinds, and the price table are agreed in [budget-control](../budget-control/specifications.md#estimated-cost) (CHG-0126).

### Compact left navigation

- The owner agreed on 2026-11-10 to a narrower main left menu with smaller icons, tighter rows, readable labels, and the existing collapse and resize controls.
- The original compact proportions used a width around 220 px and 15 px labels. The sidebar's minimum width is 284 px: the Borderlands heading with its fold arrow and its two hover buttons measured 274 px in the web build, and the rest is room for wider system fonts; no heading title truncates at the minimum (CHG-0163).
- The owner can drag the sidebar up to one quarter of the window's width; on a window too narrow for its quarter to reach the minimum, the minimum wins. A remembered width is held to the quarter again whenever the window changes size or reopens (CHG-0163).
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
| 2 | Realms | Realms, tied to a workspace or not, each containing its quests and their nested side-quests |
| 3 | Borderlands | Autonomous quests with no workspace and no shared lore, each with its nested side-quests |
| 4 | Rituals | Routines |
| 5 | Craft | Workflows |
| 6 | The Keep | Library, Lore, Archive, in that order |
| 7 | Reserves | Compact usage summary leading to a detailed usage page |
| 8 | Charter | Placeholder page |
| 9 | Workshop | Application settings, accounts, permissions, and defaults (the former Charter; CHG-0146) |

The separate Workshop for MCP servers, connectors, and skills (position 8 of CHG-0134) is withdrawn for now; the owner will ask for a dedicated menu for them later.

- The Realms, Borderlands, and The Keep headings fold and unfold their contents the same way: pressing the heading or its fold arrow; each realm can expand or collapse its quests; each quest and side-quest can expand or collapse its children at every supported depth (CHG-0163).
- Under the Realms heading, each Realm (crest and name) and its quests stand 20 px in from the heading, so the names of the Realms do not line up with the title (the owner's choice, CHG-0167).
- The Borderlands section is the former Realmless section renamed, with the Borderlands mountain icon and the same new-quest button; it has no intermediate grouping.
- A realm tied to a folder shows a small line-drawn folder icon after its name, with the folder's full path on hover and as its accessible label; a realm tied to no folder shows none (CHG-0163; a scroll was tried and dropped, CHG-0170).
- The Realms section lists the realms tied to a folder first, then a thin hairline, then the realms tied to none, each group keeping its order; this reorders realms, tied before untied. The hairline shows only when both groups have realms (CHG-0170).
- Inside one block (between two diamond dividers) the categories are spaced identically, 36 px rows 1 px apart, in the scrolling part and the fixed foot alike; only the dividers separate blocks (CHG-0171).
- Hover marks (CHG-0163, after the Delta app): the fold arrow of the group headings, realm rows, quests, and side-quests, and the action buttons (realm overview, new quest, new realm) show only while the pointer is anywhere over the whole row, or while a keyboard focus (as `:focus-visible` would show it) is inside the row; the focus a mouse click leaves does not keep them. The quest count of a realm row and of the Archive row shows the same way, only on hover or keyboard focus (CHG-0171). They keep their place while unseen, so nothing moves or truncates when they appear. Always shown: titles, icons and crests, the folder icon, and state dots. The hover belongs to the whole row box, up to its edges, including the place of the hidden buttons (CHG-0171).
- The fold arrow is a bow arrow, fletching at the tail, pointing right when folded and down when open. On a group heading it stands right after the title; on a realm row after the name and its folder icon; on quest and side-quest rows in its former place before the title.
- Each Realm and the Borderlands show their three newest quests; the open quest remains visible beyond the cap. A "Show all N quests" link opens the corresponding full list, most recent first; N counts the quests, not their side-quests.
- The full list nests each quest's side-quests beneath it as the sidebar does, indented, each with its state, title, harness, model, and latest activity, and each quest and side-quest with children folds and unfolds; quests start unfolded there. Day groups and order follow each quest's own latest activity (CHG-0163; nesting rather than a flat list is an assumption the owner may overrule).
- A Realm's quest list offers its realm panel, including crest, lore, and rename controls, with or without a folder. The Borderlands panel content remains undecided.
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
- **Agent validation**: use quests in both placements, including a realm tied to no folder, with multiple side-quest depths; expand and collapse parents, open descendants, and check that selection reaches the intended conversation.
- **Human acceptance**: compare the nesting with the supplied reference in the running desktop app and judge readability at the compact sidebar width.
- **Agent validation**: in dark and light, hover marks hidden at rest, shown when the pointer is anywhere on the row (including its far right), hidden again after a click once the pointer leaves, shown on keyboard focus; no heading title truncated at the minimum width; the rail dragged to a quarter of two window widths.
- Agent validation includes more quests than the former recent-quests cutoff, an idle quest after reporting a result, archive and reopen, long titles, empty groups, and collapsed and narrow-screen navigation.

## External contract

Threads use this thread tool (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `set_mission_title` | Name the mission | A title | Done, or a refusal when the user has renamed the mission |

## Acceptance and validation

- **Automated, with a fake harness**:
  - direct creation from a Realm and the Borderlands without a Guildmaster turn, checking placement, lore and workspace, the last harness and model, the initial title, and naming on the first message;
  - dragging quests between sidebar placements opening the move confirmation, with no placement change before confirmation and none on Cancel;
  - confirming a move refused if any descendant starts running while confirmation is open;
  - quests in a Realm tied to a workspace, a Realm tied to none, and the Borderlands, with the correct shared lore;
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
- **Realm lifecycle batch (CHG-0268), automated with a fake harness and temporary data**:
  - realm archive through either entry point, with confirmation, quest and running-thread counts, no change on Cancel, and nested running threads stopped on confirm;
  - archive preserving realm identity, lore, conversations, journals, and folder association across a service restart, and never deleting the workspace folder;
  - restoring only the quests archived with the realm, while previously individually archived quests remain archived;
  - quest archive returning to its realm or the Borderlands, realm archive returning to Realms, and Cancel or failure not navigating;
  - matching an archived realm by resolved folder without creating a duplicate, and the Restore, Start afresh, and Cancel paths;
  - independently choosing old or proposed name and crest, defaults for both paths, equal-row and equal-popup skipping, folder-name fallback, and a shuffled crest participating in comparison;
  - Start afresh requiring its final counted confirmation, preserving the realm id, leaving all old quests archived, deleting only realm-level lore, and restoring a deleted entry through the existing history;
  - duplicate active names warning without blocking, archived names excluded from collisions, and parent-folder hints in the sidebar, overview, and pickers;
  - the Realms overview grouping active quests and nested side-quests by realm, including empty realms and excluding archived realms and the Borderlands.
- **Realm lifecycle batch, human acceptance**: judge the grouped overview, both archive entry points, confirmation wording and counts, Archive restoration, and the independent name/crest comparison in the running desktop app.
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
- Guildmaster, which proposes missions for the user, belongs to mission-coordination.
