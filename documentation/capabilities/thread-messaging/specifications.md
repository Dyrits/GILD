# Thread messaging

## Problem and outcome

Subagents in today's harnesses report once at the end and cannot be asked or redirected along the way. Threads in a mission talk in both directions while they work, and the user can write to any of them, so work can be asked about, corrected, and coordinated as it happens.

## Agreed behavior

### Who can message whom

- A thread can message its parent and the threads directly beneath it. Siblings reach each other through their parent.
- A thread, or the user writing in it, can also message any thread or mission it references explicitly with `@`, for example `@Read my emails › Triage`, in its own mission or another. A reference to a mission reaches its top thread. The reply comes straight back (see [mission-coordination](../mission-coordination/specifications.md#references-between-missions)).
- Without a reference, a thread reaches another mission only through `@Control`.
- The user can write to any open thread, including a subagent's (for mirrored subagents, see [thread-tree](../thread-tree/specifications.md#subagents)).
- Every message shows its sender: the user, or the sending thread.
- A message can ask for a reply.

### Delivery

- **Thread messages**, results included, are delivered into the receiving thread's current turn where its harness allows it; otherwise at its next turn. They are delivered whatever the receiving thread is doing.
- **The user's messages** either steer the current turn or are queued for the next turn. The user chooses on each message. Steer is the default, and a setting changes the default.
- A thread that is Waiting, Idle, or Done is woken by any message addressed to it, so two threads waiting on each other never stay stuck.
- A Stopped thread keeps its messages and is not woken (see [thread-tree](../thread-tree/specifications.md#stopping)).

### Interruptions

- The user can interrupt any thread.
- A thread can interrupt the threads directly beneath it.
- An interrupted thread ends its current turn and becomes Idle.

### Chatter guard

- When two threads exchange 20 messages with no message from the user and no result, both pause in the Attention state, and the user decides how they continue.
- The number is adjustable in settings.

## External contract

Threads use these thread tools (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `send_thread_message` | Send a message | Receiving thread (a parent, a thread directly beneath, a referenced thread or mission, or Control), text, whether a reply is wanted | The message's identifier, or a refusal and its reason (a thread outside its reach, a stopped thread) |
| `report_result` | Report the thread's result to its parent | — | — |
| `interrupt_thread` | Interrupt a thread directly beneath the caller | — | — |

## Acceptance and validation

- **Automated, with a fake harness**:
  - messages to the parent and to threads beneath, and the refusal for siblings and threads farther away unless referenced with `@`;
  - a referenced thread in another mission receiving a message and replying directly;
  - delivery into a running turn and at the next turn, for harnesses with and without mid-turn input;
  - steering and queuing user messages, and the default setting;
  - waking Waiting, Idle, and Done threads, and two threads waiting on each other;
  - keeping messages for a Stopped thread;
  - interruptions by the user and by a parent;
  - the chatter guard pausing both threads at the limit.
- **Human acceptance**: during the [thread-tree](../thread-tree/specifications.md#acceptance-and-validation) check, the user steers one running thread, queues a message to another, and sees a subagent ask its parent a question and get an answer.

## Requirements

- [Approval per action](../../requirements.md): a message never carries an approval.

## Dependencies

- [thread-tree](../thread-tree/specifications.md): defines threads, their states, and who is beneath whom.
- [action-approval](../action-approval/specifications.md): the Attention state for approvals.

## Exclusions

- Messages between threads in different missions without an explicit reference or Control.
- Attachments other than text.
- Editing or deleting a sent message.
