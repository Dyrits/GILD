# Thread tree

## Problem and outcome

Work with AI agents spreads across disconnected chats, and subagents run out of sight. A mission's work forms one tree of threads that the user and agents grow, so the user can see, follow, and steer every piece of work, whichever harness, agent, model, and effort carries it.

## Agreed behavior

### Threads and missions

- Every thread has its own identifier and at most one parent thread. A thread with no parent is a mission's top thread; the mission is that thread and every thread beneath it.
- The user can open a thread beneath any thread, or a new mission. A thread can open threads only beneath itself.
- Each thread shows its harness, agent (when one is chosen), model, effort, workspace (or none), state, and spending.

### Opening a thread

- A new thread copies its opener's harness, agent, model, effort, and workspace, unless the opener chooses otherwise, including no workspace.
- When the user opens a thread, these settings are shown and can be changed until the user sends its first message.
- A new thread starts with:
  - the opener's request;
  - the mission journal;
  - the intel and skills in scope for it;
  - the opener's messages since the mission journal's last change log entry.
  None of the opener's earlier history is included. When this exceeds the new model's context window, the oldest part is summarized.

### Subagents

- Every subagent a harness starts appears as a thread beneath the thread that started it.
- Where the harness allows it, subagents are opened as full threads (see [0007](../../architecture-decision-record/0007-subagents-become-threads.md)).
- Otherwise the subagent is mirrored: its thread shows everything it does. A message the user writes there is queued; when the subagent finishes, the thread continues as a full thread from its history with that message. The user can instead choose to interrupt it and continue it at once.

### Thread states

| State | Meaning |
| --- | --- |
| Running | A turn is in progress. |
| Waiting | It waits for a reply or for a thread beneath it. |
| Needs you | It waits for an approval or an answer from the user. Shown prominently and sent as a phone notification. |
| Idle | No turn in progress and nothing awaited. |
| Done | It reported its result. |
| Failed | Its harness failed; the user can hand it over to another. |
| Stopped | The user stopped it; it stays stopped until the user resumes it. |

### Off-topic requests

- When a message from the user clearly shares nothing with the mission, judged by the thread's agent against the mission journal's summary, the thread does not answer it. It shows a suggestion: "This looks like a new mission", with **Open as new mission** and **Keep as aside**. Merely unexpected messages do not count.
- A setting lets the thread open the new mission without asking.
- **Open as new mission** opens a new mission whose top thread starts fresh with only the off-topic part of the message. Nothing from the current mission is preloaded: no journal, no messages, no workspace. Global skills and intel stay available to it, as to any thread. Its harness, agent, model, and effort copy the current thread's, and the user can change them before it starts.
- **Keep as aside** opens an aside beneath the current thread, starting fresh the same way. An aside, and every thread beneath it, neither reads nor updates the mission journal.
- Either way, the original thread keeps the message with a link to where it went (for example "Moved to mission: Read my emails") and carries on as if the message had not been sent to it.

### Results

- A thread reports a result when its work is done. The result goes to its parent as a thread message (see [thread-messaging](../thread-messaging/specifications.md)), whatever the parent is doing, and the thread becomes Done.
- A thread can report its result while threads beneath it still run; their results reach it whenever they come.
- Writing in a Done thread continues it.

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
| `open_thread` | Open a thread beneath the caller | A request; optionally a harness, agent, model, effort, and workspace | The new thread's identifier, or a refusal and its reason |
| `suggest_mission` | Show the off-topic suggestion for a user's message | The off-topic part of the message, and a proposed mission title | The user's choice, and the identifier of the new mission or aside |

## Acceptance and validation

- **Automated, with a fake harness**:
  - opening by the user and by a thread;
  - copied defaults and their overrides;
  - the starting context, including summarizing when it is too long;
  - each state change;
  - results reaching the parent;
  - continuing a Done thread;
  - stopping without cascade, and keeping messages for a stopped thread;
  - deleting with its count;
  - each limit's refusal;
  - mirrored subagents with queued messages;
  - the off-topic suggestion and both choices: the fresh start, the link left behind, and the setting that skips the suggestion.
- **Human acceptance**: on the desktop and on the phone web app, the user follows a mission with at least 3 levels of threads on 2 different harnesses, writes to one of the subagents, and stops one branch.

## Requirements

- [Approval per action](../../requirements.md): an approval in a thread never covers the threads beneath it.
- [Nearly free to run](../../requirements.md) and [Bring your own provider](../../requirements.md): spending is the user's own provider use, bounded by budgets.

## Dependencies

- [thread-messaging](../thread-messaging/specifications.md): carries results and messages.
- **mission-journal**, **scoped-intel**, **tool-and-skill-loading**: provide a new thread's starting context.
- **budget-control**: provides budgets.
- **thread-handover**: continues mirrored subagents and failed threads.

## Exclusions

- Whether a thread gets its own git worktree (see the [backlog](../../backlog.md)).
- Moving a thread to another parent.
- Sharing threads with other people.
