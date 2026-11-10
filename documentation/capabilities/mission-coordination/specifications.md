# Quest coordination

## Problem and outcome

A user who is new to agents does not know which harness, model, or quest fits a request, and loses track of what is running. Guildmaster is one permanent chat that takes any request, opens or continues the right quest for it, and reports how quests stand, so the user can work through one conversation.

## Agreed behavior

### Place

- Guildmaster is one permanent thread outside every quest. It is pinned at the top of the dashboard, on the desktop and on the phone, and cannot be deleted, archived, or ended.
- Guildmaster is the place the rail's first entry leads to: its conversation fills the screen, with the message box at the foot. The realms show as tiles in the right side panel, and the owner can pick one for the next message. Every action it takes shows in the conversation as a card: the quest or Ritual it opened, created, or continued, with a link, and the Companion it chose. The link is a button on the right of the Guildmaster's own confirmation of it, naming what happened and the quest or Ritual; it wraps beneath the confirmation where the window is too narrow, and it stands on its own only until the confirmation is written. Each report from a quest it opened (a result, a Summons, a failure) likewise puts a button that opens that quest on the right of the Guildmaster's reply to it.
- A setting hides Guildmaster. Guildmaster is shown by default. Its spending appears on the dashboard like a quest's, and it can have its own [budget](../budget-control/specifications.md).

### What Guildmaster does itself

- Guildmaster answers only questions about quests and about using Gild. It opens a quest for anything else, even a quick question.
- Guildmaster opens no threads beneath itself; its work goes into quests. Since it belongs to no quest, the off-topic suggestion never appears in Guildmaster.
- Guildmaster acts on quests (stopping threads, marking Done, archiving, renaming) only when the user asks in Guildmaster, with the same confirmations as on the dashboard, and never on its own.

### Rituals

- A request to do something repeatedly on a schedule (every hour, every morning) is a [Ritual](../rituals/specifications.md), not a quest. Guildmaster creates it with `create_ritual`, on a preset schedule, and its reply says what it will do and when. It lists the existing Rituals in its context so it does not make one twice. A Ritual's quest stays in the Rituals place, and Guildmaster does not hear back from its runs.

### Opening a quest

- Every way of starting a quest goes through Guildmaster; no box starts a quest directly. At the foot of a realm's page, the message box sends the message to Guildmaster with that realm attached. Guildmaster still checks for matching quests, and opens any new quest in that realm; the realm is fixed, not a suggestion.

- Guildmaster first looks for quests that fit the request with `find_missions`, which searches each quest's title, briefing, and opening request, and weighs an exact ticket key or link above plain words, so two requests about one ticket meet and offers **Continue in** for up to 3 matches, as the [off-topic suggestion](../thread-tree/specifications.md#off-topic-requests) does. When nothing matches, it opens a new quest directly.
- Settings hold a default model and up to three optional tiers (Light, Balanced, Heavy), each a harness, model, and effort. Guildmaster picks a tier from how complex the request is, or the default when no tiers are set.
- Guildmaster picks the workspace the request implies, for example "fix the login bug in Gild" picks the Gild workspace, or none. Given a repository link, it clones the repository with `clone_repository`, or reuses its earlier clone, and opens the quest there (see [workspace-attachment](../workspace-attachment/specifications.md#cloning-a-repository)).
- Its reply links to the quest and names the tier, harness, model, effort, and workspace it chose, for example "Opened on Balanced: Codex, GPT-5, medium". The user can change the harness, agent, model, and effort afterwards through a handover; the workspace stays.
- The new quest's top thread starts as **Open as new quest** does: with the request, global skills and intel, and nothing from another quest.

### Hearing back

- A quest that Guildmaster opened tells Guildmaster when it reports its result, enters Attention, or fails, and Guildmaster relays that to the user.
- Guildmaster reads the state of other quests only when the user asks.

### References between quests

- A thread, or the user writing in it, can message any thread or quest it references with `@`, for example `@Read my emails › Triage`. A reference to a quest reaches its top thread. The message goes straight to it and the reply comes straight back, without Guildmaster (see [thread-messaging](../thread-messaging/specifications.md#who-can-message-whom)).
- Without a reference, a thread, or the user writing in a quest's thread, can write to `@Guildmaster`. Guildmaster finds the quest that fits with `find_missions` and forwards the message there, or answers that none fits.
- Every message between quests shows in both threads as a normal message labelled with the sender's quest. Guildmaster shows it as a compact event line, not a chat bubble, for example "Release notes › Draft → Read my emails › Triage", and it stays out of Guildmaster's context.
- The [chatter guard](../thread-messaging/specifications.md#chatter-guard) applies to each pair of threads, across quests too.

### Context

- Guildmaster has no journal.
- Each turn, Guildmaster starts with its instructions, global intel, the dashboard as text, and its 20 latest messages. The local service summarizes older messages.
- The dashboard as text lists each quest that is not archived on one line: title, state, workspace, the first sentence of its briefing, and last activity. The local service builds it from stored data; Guildmaster never maintains it.
- Guildmaster reads a quest's full journal with `read_journal`, and its own older messages only when the user asks, for example "Remember what we did about X?".

### Intel

- Guildmaster reads and saves global intel only. Each save needs the user's approval, as for any thread.

### Guildmaster's own settings

- The user chooses Guildmaster's harness, agent, model, and effort like any thread's. They are prefilled with the cheapest model available on the first installed harness, and the user can hand Guildmaster over at any time.

## External contract

Guildmaster uses these thread tools in addition to `find_missions`, `suggest_mission`, `send_thread_message`, the intel tools, and `read_journal`, which for Guildmaster takes the quest to read (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `open_mission` | Open a new quest | The request; optionally a tier, harness, agent, model, effort, and workspace | The new quest's identifier and the choices it started with, or a refusal and its reason |
| `create_ritual` | Create a [Ritual](../rituals/specifications.md) for a repeating request | The instruction, a title, a schedule preset; optionally a tier, harness, model, effort, and realm | The Ritual's title, schedule, and Companion, or a refusal and its reason |
| `act_on_mission` | Stop threads, mark Done, archive, or rename, at the user's request | A quest, an action, the user's exact words asking for it as `quote`, for renaming a title, and for a confirmed ending the snapshot it was given | Done, or the confirmation the user must give first, or a refusal |
| `read_control_history` | Read Guildmaster's older messages | A query or a starting point | The matching messages |

Only Guildmaster can call these four tools. Any thread can address Guildmaster with `send_thread_message`.

## Acceptance and validation

- **Automated, with a fake harness**:
  - Guildmaster pinned, never deletable or archivable, and hidden by the setting;
  - a question about quests answered in Guildmaster, and any other request opening a quest;
  - matching quests offered as Continue in before a new quest opens;
  - the tier picked from the request's complexity, the default when no tiers are set, and the choice shown in the reply;
  - the result, Attention, and Failed of a quest Guildmaster opened reaching Guildmaster, and nothing from quests it did not open;
  - Guildmaster acting on a quest only at the user's request, with the dashboard's confirmations;
  - a referenced thread in another quest receiving a message and replying directly, a quest reference reaching its top thread, and a message to another quest without a reference refused unless sent to Guildmaster;
  - `@Guildmaster` forwarding a message to the matching quest, or answering that none fits;
  - cross-quest messages labelled in both threads, shown as event lines in Guildmaster, and kept out of its context;
  - the chatter guard pausing two threads in different quests;
  - Guildmaster's starting context: the dashboard as text, global intel, and its 20 latest messages, with older ones summarized and read only on request;
  - Guildmaster saving global intel only after approval.
- **Human acceptance**: on the desktop and on the phone web app, the user asks Guildmaster for 3 different tasks, sees one continue an existing quest and two open new ones on different tiers, gets told in Guildmaster when one needs them, and has a thread in one quest ask a thread in another a question with `@`.

## Requirements

- [Approval per action](../../requirements.md): Guildmaster's global intel saves and its actions on quests each need the user, and an approval never carries over.
- [Single user](../../requirements.md): one Guildmaster per installation.
- [Local data](../../requirements.md): Guildmaster's history stays on the user's computer.

## Dependencies

- [quest-tracking](../mission-tracking/specifications.md): the dashboard, quest states, and ending quests.
- [thread-tree](../thread-tree/specifications.md): `find_missions`, Continue in, and how a new quest starts.
- [thread-messaging](../thread-messaging/specifications.md): messages, references, and the chatter guard.
- [quest-journal](../mission-journal/specifications.md): the briefings Guildmaster reads.
- [scoped-intel](../scoped-intel/specifications.md): global intel and its approvals.
- **thread-handover**: changing a quest's or Guildmaster's harness and model.

## Exclusions

- Guildmaster doing the work of a quest itself.
- Guildmaster acting on quests on its own initiative.
- More than one Guildmaster.

## Provisional choices to review

- **The owner's words authorize an action.** `act_on_mission` is refused unless the `quote` appears in the owner's message that started Guildmaster's current turn; a Done or archive with threads at work first answers with the dashboard's question and goes ahead only with that question's snapshot and the owner's agreement quoted in a later message. A quote cannot prove that the owner meant it for this action.
- **Stop** takes no confirmation, as the dashboard's Stop does not.
- **A quest reports once its turn has ended**, so its closing reply travels with the report; a quest that stands in the same report is not told twice, and one that leaves it is told again later.
- **Hiding Guildmaster** removes its rail entry and opens the window on the quests; the screen is still where a realm page's message goes.
- **Tiers** are optional Companions; a tier not set, or no tier, starts on the Settings default, never on Guildmaster's own cheap Companion. Guildmaster's own Companion starts on Claude Code's cheapest model (Haiku) when the default harness is Claude Code, and on the harness's own default otherwise.
- **Not built**: the 20-message window with older messages summarized (the harness session carries the conversation); messages between quests by `@` reference with their event lines in Guildmaster; Guildmaster's spending on the quests' dashboard (it shows on its own screen).
