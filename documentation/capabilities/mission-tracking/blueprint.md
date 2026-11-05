# Mission tracking blueprint

Status: proposed. Uses the local-service modules and records in the [first slice design](../../first-slice-design.md). The user accepted the staged slice, not these technical interfaces. No acceptance check has run.

## Modules and data

Missions owns mission metadata through `start`, `rename`, `list`, `read`, and `continue`. It stores title ownership separately from generated titles. `set_mission_title` accepts only the mission's top thread and refuses after a user rename. Thread creation and the first message commit with the mission before Execution starts.

Missions queries Threads for state and Usage for spending. The active mission projection uses Attention, Failed, Running, Waiting, then Idle in that order; Done and Stopped threads contribute no greater urgency. Ending a mission is a separate lifecycle change. The proposal uses Idle when no thread has one of the urgent states, without marking the mission Done automatically.

SQLite is the production persistence adapter; temporary SQLite is the test adapter. A fake clock replaces wall time. Journal and budget behavior remains with its owning capability; Missions does not duplicate it.

## Acceptance

| Specification check | Module and test interface; stage |
| --- | --- |
| State urgency | Missions `list`, driven by fake Execution events through Threads; included. |
| Top result asks Mark as done without ending | Messaging `reportResult`, then Missions `read`; included. |
| Inactivity prompt, agent activity, dismissal interval | Missions query with fake clock; staged with mission ending. |
| Confirmation names running threads before Done/archive and stops them | Proposed Missions ending command through Threads; staged with journal integration. |
| Spending totals by provider unit; no subscription token price | Missions `read` after fake usage reports; included. Unknown usage remains unknown. |
| Auto-archive default and configured delay | Missions lifecycle scheduling with fake clock; staged. |
| Writing in Done/Archived reopens | Messaging `send` plus Missions lifecycle; staged until those lifecycle actions exist. |
| Reopen Archived view | Proposed Missions reopen command and list query; staged. |
| Proposed title, user rename, later tool refusal | Missions `rename` and MCP `set_mission_title`; included. |
| Prefilled starting choices | Missions `start` and defaults query; included for the slice's supported settings. |
| Dashboard order, filters, title and briefing search | Missions `list`; state order, workspace filter, and title search included; briefing search staged with journal. |
| Desktop and phone: three missions, attention first, Done, archive, reopen | App driving Missions; initial desktop start/order covered, full walkthrough staged until ending and phone transport exist. |

## Requirements

| Requirement | Design |
| --- | --- |
| Local data | Store keeps missions on the host computer; app receives projections over authenticated local transport. |
| Single user | Only the owner can call initial app commands. |
| Future multiplayer | Host and actor identifiers remain separate; guest access is staged as described in the shared design. |

## Open

Review the interfaces and dependency gates in the shared design. Completion of this slice does not establish completion of mission-tracking.
