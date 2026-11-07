# Mission coordination

## Problem and outcome

A user who is new to agents does not know which harness, model, or mission fits a request, and loses track of what is running. Control is one permanent chat that takes any request, opens or continues the right mission for it, and reports how missions stand, so the user can work through one conversation.

## Agreed behavior

### Place

- Control is one permanent thread outside every mission. It is pinned at the top of the dashboard, on the desktop and on the phone, and cannot be deleted, archived, or ended.
- A setting hides Control. Control is shown by default. Its spending appears on the dashboard like a mission's, and it can have its own [budget](../budget-control/specifications.md).

### What Control does itself

- Control answers only questions about missions and about using Canopy. It opens a mission for anything else, even a quick question.
- Control opens no threads beneath itself; its work goes into missions. Since it belongs to no mission, the off-topic suggestion never appears in Control.
- Control acts on missions (stopping threads, marking Done, archiving, renaming) only when the user asks in Control, with the same confirmations as on the dashboard, and never on its own.

### Opening a mission

- Control first looks for missions that fit the request with `find_missions` and offers **Continue in** for up to 3 matches, as the [off-topic suggestion](../thread-tree/specifications.md#off-topic-requests) does. When nothing matches, it opens a new mission directly.
- Settings hold a default model and up to three optional tiers (Light, Balanced, Heavy), each a harness, model, and effort. Control picks a tier from how complex the request is, or the default when no tiers are set.
- Control picks the workspace the request implies, for example "fix the login bug in Canopy" picks the Canopy workspace, or none. Given a repository link, it clones the repository with `clone_repository`, or reuses its earlier clone, and opens the mission there (see [workspace-attachment](../workspace-attachment/specifications.md#cloning-a-repository)).
- Its reply links to the mission and names the tier, harness, model, effort, and workspace it chose, for example "Opened on Balanced: Codex, GPT-5, medium". The user can change the harness, agent, model, and effort afterwards through a handover; the workspace stays.
- The new mission's top thread starts as **Open as new mission** does: with the request, global skills and intel, and nothing from another mission.

### Hearing back

- A mission that Control opened tells Control when it reports its result, enters Attention, or fails, and Control relays that to the user.
- Control reads the state of other missions only when the user asks.

### References between missions

- A thread, or the user writing in it, can message any thread or mission it references with `@`, for example `@Read my emails › Triage`. A reference to a mission reaches its top thread. The message goes straight to it and the reply comes straight back, without Control (see [thread-messaging](../thread-messaging/specifications.md#who-can-message-whom)).
- Without a reference, a thread, or the user writing in a mission's thread, can write to `@Control`. Control finds the mission that fits with `find_missions` and forwards the message there, or answers that none fits.
- Every message between missions shows in both threads as a normal message labelled with the sender's mission. Control shows it as a compact event line, not a chat bubble, for example "Release notes › Draft → Read my emails › Triage", and it stays out of Control's context.
- The [chatter guard](../thread-messaging/specifications.md#chatter-guard) applies to each pair of threads, across missions too.

### Context

- Control has no journal.
- Each turn, Control starts with its instructions, global intel, the dashboard as text, and its 20 latest messages. The local service summarizes older messages.
- The dashboard as text lists each mission that is not archived on one line: title, state, workspace, the first sentence of its briefing, and last activity. The local service builds it from stored data; Control never maintains it.
- Control reads a mission's full journal with `read_journal`, and its own older messages only when the user asks, for example "Remember what we did about X?".

### Intel

- Control reads and saves global intel only. Each save needs the user's approval, as for any thread.

### Control's own settings

- The user chooses Control's harness, agent, model, and effort like any thread's. They are prefilled with the cheapest model available on the first installed harness, and the user can hand Control over at any time.

## External contract

Control uses these thread tools in addition to `find_missions`, `suggest_mission`, `send_thread_message`, the intel tools, and `read_journal`, which for Control takes the mission to read (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `open_mission` | Open a new mission | The request; optionally a tier, harness, agent, model, effort, and workspace | The new mission's identifier and the choices it started with, or a refusal and its reason |
| `act_on_mission` | Stop threads, mark Done, archive, or rename, at the user's request | A mission, an action, and for renaming a title | Done, or the confirmation the user must give first |
| `read_control_history` | Read Control's older messages | A query or a starting point | The matching messages |

Only Control can call these three tools. Any thread can address Control with `send_thread_message`.

## Acceptance and validation

- **Automated, with a fake harness**:
  - Control pinned, never deletable or archivable, and hidden by the setting;
  - a question about missions answered in Control, and any other request opening a mission;
  - matching missions offered as Continue in before a new mission opens;
  - the tier picked from the request's complexity, the default when no tiers are set, and the choice shown in the reply;
  - the result, Attention, and Failed of a mission Control opened reaching Control, and nothing from missions it did not open;
  - Control acting on a mission only at the user's request, with the dashboard's confirmations;
  - a referenced thread in another mission receiving a message and replying directly, a mission reference reaching its top thread, and a message to another mission without a reference refused unless sent to Control;
  - `@Control` forwarding a message to the matching mission, or answering that none fits;
  - cross-mission messages labelled in both threads, shown as event lines in Control, and kept out of its context;
  - the chatter guard pausing two threads in different missions;
  - Control's starting context: the dashboard as text, global intel, and its 20 latest messages, with older ones summarized and read only on request;
  - Control saving global intel only after approval.
- **Human acceptance**: on the desktop and on the phone web app, the user asks Control for 3 different tasks, sees one continue an existing mission and two open new ones on different tiers, gets told in Control when one needs them, and has a thread in one mission ask a thread in another a question with `@`.

## Requirements

- [Approval per action](../../requirements.md): Control's global intel saves and its actions on missions each need the user, and an approval never carries over.
- [Single user](../../requirements.md): one Control per installation.
- [Local data](../../requirements.md): Control's history stays on the user's computer.

## Dependencies

- [mission-tracking](../mission-tracking/specifications.md): the dashboard, mission states, and ending missions.
- [thread-tree](../thread-tree/specifications.md): `find_missions`, Continue in, and how a new mission starts.
- [thread-messaging](../thread-messaging/specifications.md): messages, references, and the chatter guard.
- [mission-journal](../mission-journal/specifications.md): the briefings Control reads.
- [scoped-intel](../scoped-intel/specifications.md): global intel and its approvals.
- **thread-handover**: changing a mission's or Control's harness and model.

## Exclusions

- Control doing the work of a mission itself.
- Control acting on missions on its own initiative.
- More than one Control.
