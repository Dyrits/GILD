# Thread tree

Technical design: [proposed blueprint](blueprint.md), including the first slice's staged acceptance.

## Problem and outcome

Work with AI agents spreads across disconnected chats, and subagents run out of sight. A mission's work forms one tree of threads that the user and agents grow, so the user can see, follow, and steer every piece of work, whichever harness, agent, model, and effort carries it.

## Agreed behavior

### Threads and missions

- Every thread has its own identifier and at most one parent thread. A thread with no parent is a mission's top thread, except Guildmaster (see [mission-coordination](../mission-coordination/specifications.md)); the mission is that thread and every thread beneath it.
- The user can open a thread beneath any thread, or a new mission. A thread can open threads only beneath itself.
- Each thread shows its harness, agent (when one is chosen), model, effort, workspace (or none), state, and spending.
- Moving a quest moves every thread beneath it together, only while none is running; the destination changes every thread's workspace and shared realm lore as specified in [mission tracking](../mission-tracking/specifications.md#quest-placement-and-moves) (CHG-0130, agreed; implementation pending).

### Quest tree visibility

- The main left sidebar contains the quest tree, nested beneath Realms, Free Realms, or Realmless as defined in [mission tracking](../mission-tracking/specifications.md#left-navigation-structure).
- There is one navigation sidebar on the left and one details sidebar on the right; no second quest-tree sidebar sits beside the left navigation (CHG-0135, agreed on 2026-11-11; implementation pending).
- Creating the first side-quest or deleting the last changes the nested sidebar tree without adding or removing another column.
- The main quest remains accessible from the sidebar when viewing a side-quest.
- Thread navigation stays accessible when the sidebar is collapsed or hidden on a narrow screen, and the Back to quests link remains available.
- The right details panel keeps its existing behavior without new tabs.
- Agent validation covers quests with no children, creating and deleting children, folded children, selecting a child and returning to its quest, collapsed navigation, the narrow-screen back link, and the absence of a duplicate left tree column.
- Human acceptance checks the appearance and conversation space in the running app.

### Opening a thread

- A new thread copies its opener's harness, agent, model, effort, and workspace, unless the opener chooses otherwise, including no workspace.
- When the user opens a thread, these settings are shown and can be changed until the user sends its first message.
- A new thread starts with:
  - the opener's request;
  - the briefing and its 20 latest entries (see [mission-journal](../mission-journal/specifications.md#reading));
  - the intel and skills in scope for it;
  - the opener's messages since the journal's last change log entry.
  None of the opener's earlier history is included. When this exceeds the new model's context window, the oldest part is summarized.
- When this starting context would take more than 25% of the chosen model's context window, the user is warned before the thread starts, with the choice of a model with a larger window or trimming intel.

### Subagents

- Every subagent a harness starts appears as a thread beneath the thread that started it.
- Where the harness allows it, subagents are opened as full threads (see [0007](../../architecture-decision-record/0007-subagents-become-threads.md)).
- Otherwise the subagent is mirrored: its thread shows everything it does. A message the user writes there is queued; when the subagent finishes, the thread continues as a full thread from its history with that message. The user can instead choose to interrupt it and continue it at once.

### Threads opened by agents

- The setting **Show threads opened by agents** is on by default.
- When it is off, the threads an agent opened fold into the thread that opened them, which shows their count, for example "+3 threads". The user can unfold them.
- A folded thread still appears when it enters Attention or Failed.
- Folding changes only the view. Folded threads still exist, run, and receive messages.

### Thread states

CHG-0135 and CHG-0136 remove Done from quests and side-quests, as defined in [mission tracking](../mission-tracking/specifications.md#mission-state).
The interface presents idle, running, or Summons; waiting, failure, and stopped conditions remain visible details, and a failure needing the owner produces Summons.

| State | Meaning |
| --- | --- |
| Running | A turn is in progress. |
| Waiting | It waits for a reply or for a thread beneath it. |
| Attention | It waits for an approval, an answer, a raised budget, a missing workspace folder, or a tool or skill loading problem that prevents a turn. Shown prominently and sent as a phone notification. |
| Idle | No turn in progress and nothing awaited. |
| Failed | Its harness failed; the user can hand it over to another. |
| Stopped | The user stopped it; it stays stopped until the user resumes it. |

### Off-topic requests

- When a message from the user clearly shares nothing with the mission, judged by the thread's agent against the briefing, the thread does not answer it. Merely unexpected messages do not count.
- The thread first looks for other missions that fit the request, by their titles and briefings only. Every mission that is not deleted counts, whatever its state.
- It then shows a suggestion with these choices:
  - **Continue in "mission title"**: one for each matching mission, best match first, at most 3, each showing that mission's state;
  - **Open as new mission**;
  - **Keep as aside**.
- **Continue in** sends the off-topic part to that mission's top thread as the user's message, steering or queued as the user's default sets.
  As with any message, it continues an idle quest or reopens an archived quest.
- A setting lets the thread open a new mission without asking when no other mission matches.
- **Open as new mission** opens a new mission whose top thread starts fresh with only the off-topic part of the message. Nothing from the current mission is preloaded: no journal, no messages, no workspace. Global skills and intel stay available to it, as to any thread. Its harness, agent, model, and effort copy the current thread's, and the user can change them before it starts.
- **Keep as aside** opens an aside beneath the current thread. It starts with:
  - the off-topic part of the message;
  - the briefing;
  - a note that the message went off the mission's topic and was put aside;
  - the rule that whenever the conversation comes back to the mission, the aside informs its parent with a thread message saying what is relevant.
  An aside does not update the journal itself; its parent decides what to record.
- Either way, the original thread keeps the message with a link to where it went (for example "Moved to mission: Read my emails") and carries on as if the message had not been sent to it.

### Results

- A thread reports a result when its work is done.
  A side-quest's result goes to its parent as a thread message (see [thread-messaging](../thread-messaging/specifications.md)), whatever the parent is doing.
  Reporting a result leaves the thread idle unless it has further work or needs the owner; it does not archive the quest.
- A thread can report its result while threads beneath it still run; their results reach it whenever they come.
- Writing in an idle thread continues it; an explicitly stopped thread still requires resume.

### Stopping

- Stopping a thread stops only that thread. Threads beneath it keep running and can still message it.
- Messages that reach a stopped thread are kept, and it stays stopped until the user resumes it. The tree shows how many messages wait, for example "3 messages waiting".

### Deleting

- Deleting a thread deletes every thread beneath it. One confirmation names the count and the running ones, for example "Delete this thread and 5 threads beneath it (2 running)?". Running threads among them are stopped first.
- Deleting a mission's top thread deletes the mission.

### Limits

- The user can open threads down to 4 levels deep; agents can open threads at any depth.
- At most 8 threads run at once in a mission, and threads draw on the mission's budget.
- When a limit or the budget is reached, `open_thread` is refused with the reason shown in the thread, and the thread can wait or ask the user.
- All three limits are adjustable in settings.

## External contract

Threads use these thread tools (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `open_thread` | Open a thread beneath the caller | A request; optionally a short title, a harness, agent, model, effort, workspace, and Own copy (see [workspace-attachment](../workspace-attachment/specifications.md)) | The new thread's identifier, or a refusal and its reason |
| `find_missions` | Find missions that fit a request | The request | Up to 3 matching missions, each with its title, briefing, and state |
| `suggest_mission` | Show the off-topic suggestion for a user's message | The off-topic part of the message, a proposed mission title, and the matching missions | The user's choice, and the identifier of the mission or aside the message went to |

## Acceptance and validation

- **Automated, with a fake harness**:
  - opening by the user and by a thread;
  - copied defaults and their overrides;
  - the starting context, including summarizing when it is too long;
  - each state change;
  - results reaching the parent;
  - reporting a result without a Done state and continuing an idle thread;
  - stopping without cascade, and keeping messages for a stopped thread;
  - deleting with its count;
  - each limit's refusal;
  - mirrored subagents with queued messages;
  - folding threads opened by agents, with their count, and a folded thread appearing when it enters Attention or Failed;
  - the off-topic suggestion and both choices: the new mission's fresh start, the aside's starting context, the link left behind, and the setting that skips the suggestion;
  - an aside informing its parent when the conversation comes back to the mission;
  - matching missions offered first, including idle and archived ones, deleted ones never offered, and Continue in waking the chosen mission.
- **Human acceptance**: on the desktop and on the phone web app, the user follows a mission with at least 3 levels of threads on 2 different harnesses, writes to one of the subagents, and stops one branch.

## Requirements

- [Approval per action](../../requirements.md): an approval in a thread never covers the threads beneath it; only a standing permission, granted for a workspace, a mission, or everywhere, applies to every thread there.
- [Nearly free to run](../../requirements.md) and [Bring your own provider](../../requirements.md): spending is the user's own provider use, bounded by budgets.

## Dependencies

- [thread-messaging](../thread-messaging/specifications.md): carries results and messages.
- [mission-journal](../mission-journal/specifications.md), **scoped-intel**, **tool-and-skill-loading**: provide a new thread's starting context.
- [budget-control](../budget-control/specifications.md): the mission budget threads draw on.
- **thread-handover**: continues mirrored subagents and failed threads.

## Exclusions

- Whether a thread gets its own git worktree (see the [backlog](../../backlog.md)).
- Moving a thread to another parent.
- Sharing threads with other people.
