# Thread messaging

Technical design: [proposed blueprint](blueprint.md), including the first slice's staged acceptance.

## Problem and outcome

Subagents in today's harnesses report once at the end and cannot be asked or redirected along the way. Threads in a mission talk in both directions while they work, and the user can write to any of them, so work can be asked about, corrected, and coordinated as it happens.

## Agreed behavior

### Who can message whom

- A thread can message its parent and the threads directly beneath it. Siblings reach each other through their parent.
- When the owner mentions a quest or side-quest with `@` in a message, the thread that receives it may, for the turn that message reaches, read that quest's journal (`read_journal` with `mission`) and message the quest's top thread, or the side-quest itself (CHG-0181). The receiving thread decides from the owner's words whether to do either. The quest that receives such a message may answer its sender in the turn the message reaches, so the reply comes straight back (see [mission-coordination](../mission-coordination/specifications.md#references-between-quests)).
- Without a mention, a thread reaches another quest only through Iskios (formerly Guildmaster). A thread cannot widen its own reach by writing an `@` reference: only the owner's messages count.
- The user can write to any open thread, including a subagent's (for mirrored subagents, see [thread-tree](../thread-tree/specifications.md#subagents)).
- Every message shows its sender: the user, or the sending thread.
- A message can ask for a reply.

### Mentions with @

Agreed 2026-11-11 (CHG-0181); built in CHG-0182.

- In any message box (a quest's, a side-quest's, Iskios's), a bare `@` lists three categories with their icons: Quests, Realms, and Files & Directories, the last only when the message box has a linked folder. Arrow keys and Enter open a category; Backspace right after the `@` returns to the categories. As soon as text follows the `@`, the list mixes the matches of every category, each under its heading. The `/` skills list is unchanged.
- Quests lists every quest not archived and, beneath each, its side-quests shown as `Quest › Side-quest`; Iskios's own conversation is never offered. Realms lists every realm, tied to a folder or not. Archived quests and their side-quests are left out entirely.
- A chosen quest, side-quest, or realm becomes a chip with its icon (a pennant for a quest or side-quest, a keep for a realm) and its name, in the message box and in the sent message. The message holds a one-word token with the id: `@quest:<quest id>`, `@side-quest:<thread id>`, or `@realm:<realm id>`. File and folder paths keep their `@path` form. A token naming a quest since archived or deleted shows as "quest no longer open".
- A mention is context only. The owner's text reaches the thread unchanged, followed by a block the service adds as it delivers the message, one line per mention with its ids, for example `Quest "Fix login" (id …, state Running, realm Iskios, top thread id …)` and `Realm "Iskios" (id …, folder …)`. The receiving thread decides from the owner's words whether to read the quest's journal, write to it, or neither.
- The widened reach (above) holds only for quests and side-quests the owner named, only in the turn the message reaches, and never for an archived quest. A realm mention opens nothing: it only says which realm is meant.
- On the phone and other builds that cannot draw chips inside the text, the chosen token is written into the text as typed; the categories still show.

### Delivery

- **Thread messages**, results included, are delivered into the receiving thread's current turn where its harness allows it; otherwise at its next turn. They are delivered whatever the receiving thread is doing.
- **The user's messages** either steer the current turn or are queued for the next turn. The user chooses on each message. Steer is the default, and a setting changes the default.
- A thread that is Waiting, Idle, or Done is woken by any message addressed to it, so two threads waiting on each other never stay stuck.
- A Stopped thread keeps its messages and is not woken (see [thread-tree](../thread-tree/specifications.md#stopping)).

### Interruptions

- The user can interrupt any thread.
- A thread can interrupt the threads directly beneath it.
- An interrupted thread ends its current turn and becomes Idle, or Waiting while threads beneath it are Running or Waiting (CHG-0039). Messages that had not yet reached the turn stay undelivered and start its next turn.

### Chatter guard

- When two threads exchange 20 messages with no message from the user and no result, both pause in the Attention state, and the user decides how they continue.
- The number is adjustable in settings.

## External contract

Threads use these thread tools (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `send_thread_message` | Send a message | Receiving thread (a parent, a thread directly beneath, Iskios, the top thread of a quest or a side-quest the owner mentioned in this turn, or a thread that wrote to the caller in this turn), text, whether a reply is wanted | The message's identifier, queued until explicit resume when the receiver is Stopped; or a refusal and its reason when the target is outside its reach |
| `report_result` | Report the thread's result to its parent | The result | — |
| `interrupt_thread` | Interrupt a thread directly beneath the caller | The thread | Done, or a refusal and its reason when the thread is not directly beneath the caller or is not running |

## Acceptance and validation

- **Automated, with a fake harness**:
  - messages to the parent and to threads beneath, and the refusal for siblings and threads farther away unless the owner mentioned them with `@` in the current turn;
  - a mentioned quest in another mission receiving a message and replying directly; the access ending with the turn; no access for an archived quest (built, `packages/service/test/work/mentions.test.ts`);
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

- Messages between threads in different missions without the owner's mention or Iskios.
- A thread's own `@` reference in a message to another thread: it opens nothing (CHG-0181).
- Attachments other than text between threads. The owner's images are in [message-attachments](../message-attachments/specifications.md).
- Editing or deleting a sent message.
