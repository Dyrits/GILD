# Action approval

## Problem and outcome

Threads run on their own, many at once, and some of their actions cannot be undone or reach other people: deleting files, sending a message, pushing code, paying. The user decides each of these from any device, in plain language, and can grant standing permissions so that threads run autonomously on what the user already trusts them with.

## Agreed behavior

Version 1 serves the installation's owner. In future hosted missions, only the host approves risky actions and grants standing permissions (CHG-0017). A guest's request to trigger work carries no approval. See the [hosted agreements](../../architecture.md#future-multiplayer-open-architecture-questions).

### Asking

- At the default level a thread works on its own and asks only before a **sensitive action**: one that leaves the computer or cannot be undone (CHG-0035). Sensitive actions are pushing code, publishing, deploying, sending a message to a person, submitting a form, paying, deleting anything outside the workspace or discarding uncommitted work, changing the system or its settings, and reaching passwords, keys, or other secrets. Everything else runs without a question, including reading, editing inside the workspace, local git, installing dependencies, and running the project's checks; the thread's instructions carry this list.
- A thread asks through `request_approval`, as a question in its own conversation. Each harness runs in its sandbox where one exists. When the harness itself asks for permission, OpenMission decides: a prompt matching the action just allowed in that thread, or a standing permission's pattern, runs; a prompt that OpenMission's own list of sensitive commands recognizes becomes a question; any other prompt runs without a question and leaves a line in the thread saying what ran. This holds with or without a sandbox (CHG-0035).
- Each question covers exactly one action. A thread that needs three actions asks three questions.
- A thread does not ask when the action is already approved:
  - the user's message names it, for example "push it" or "send this to Alice", which approves that one action in that thread;
  - a routine's instruction, written by the user, names it, which approves it in each run of that routine; actions the instruction does not name still ask;
  - a standing permission covers it.
- A thread message never carries an approval, and no thread can answer another thread's question.

### The question

- A question is written for someone who does not read code. It leads with what the thread wants to do and what that affects, in plain words, for example "Push today's 3 commits to GitHub. This sends your changes off this computer, where everyone with access to the repository sees them." **Show details** reveals the exact command, file changes, or recipient and text.
- Outside its thread, a question also shows its mission and thread.
- The buttons are **Allow**, **Always allow**, and **Deny**. An optional message beside Deny tells the thread why or what to do instead (CHG-0035).
- On a denial, the thread carries on with the refusal.

### Waiting

- A thread with an open question is in the **Attention** state, shown prominently and sent as a phone notification with no content.
- A question waits with no time limit while the rest of the mission keeps running.
- A question is withdrawn when the user interrupts or stops its thread.

### Where to answer

- In the question's thread, and from the list of open questions at the top of the dashboard, on the desktop and on the phone. The phone notification opens that list.

### Standing permissions

- **Always allow** approves the action and grants a standing permission for the same kind of action, written as one short sentence such as "Push code to GitHub" or "Send emails to Alice".
- A standing permission applies in the thread's workspace, or in its mission when the thread has no workspace, to every thread there. The user can widen it to everywhere from the Permissions page.
- Every thread knows the standing permissions that apply to it and does not ask for an action they cover.

### Approval level

- One approval setting has two levels: **Sensitive actions only** (the default) and **Also commands and edits**, which turns the harnesses' own permission prompts back on, each one answered with the same buttons.
- At **Also commands and edits**, OpenMission follows the allow and deny rules the user set in each harness's own settings.

### Permissions page

- Settings has a **Permissions** row showing the current level, for example "Permissions · Sensitive actions only". It opens a page with:
  - the approval level;
  - the standing permissions, each with its scope, widenable to everywhere and removable;
  - the history of every answer across threads, filterable by mission.
- Each answered question also stays in its thread as a short line with the action, the answer, the time, and the device, for example "Allowed `git push` · 14:02 · phone". Withdrawn questions, and harness prompts run without a question, are recorded the same way.

## External contract

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `request_approval` | Ask the user before one sensitive action | A plain sentence saying what and what it affects, and the exact details | Allowed; Allowed, with the standing permission granted; or Denied, with the user's message if any |

A withdrawn question gets no answer, since its turn has ended.

## Acceptance and validation

- **Automated, with a fake harness**:
  - a sensitive action asked about once, and nothing asked for reading, editing inside the workspace, or other harness prompts the sensitive list does not recognize, each of which leaves a line;
  - one question per action, never bundled;
  - each answer reaching the thread: Allow, Always allow, Deny, and Deny with a message;
  - an action named in the user's message, or in a routine's instruction, run without a question, and an unnamed one asked;
  - a standing permission sparing the question in its workspace or mission, still asking in another, and asking again once removed;
  - a thread message claiming an approval, and another thread trying to answer, both having no effect;
  - the thread in Attention until the question is answered, with no time limit, and the question withdrawn on interrupt or stop;
  - answering from the dashboard's list and from the thread, on both the desktop and the phone web app;
  - the notification carrying no content;
  - at **Also commands and edits**, harness permission prompts shown with the same buttons, and the harness's own allow and deny rules followed;
  - every answer recorded in its thread and in the Permissions page history.
- **Human acceptance**: on the phone web app, the user gets a notification, reads a question in plain language, opens its details, and allows it; chooses Always allow for a push, then sees a later push in the same workspace run without asking and removes that permission from the Permissions page.

## Requirements

- [Approval per action](../../requirements.md): a single approval covers one action in one thread; standing permissions are the user's own and visible on the Permissions page.
- [End-to-end encrypted phone traffic](../../requirements.md): notifications carry no content.

## Dependencies

- [thread-tree](../thread-tree/specifications.md): the Attention state, and the thread's instructions.
- [thread-messaging](../thread-messaging/specifications.md): interruptions, and messages carrying no approval.
- [mission-tracking](../mission-tracking/specifications.md): the dashboard where open questions are listed.
- [scoped-intel](../scoped-intel/specifications.md): approvals for global intel.
- [mission-coordination](../mission-coordination/specifications.md): Control's global intel saves.
- **routine-running**: routine instructions that name actions.
- [workspace-attachment](../workspace-attachment/specifications.md): the workspace a standing permission applies to.
- **device-pairing**: answering from the phone.

## Exclusions

- Approving by time limit or by default.
- One answer covering several actions.
- A thread approving on the user's behalf.
- Blocking actions that neither the thread nor the sensitive list recognizes at the default level; the stricter level exists for that.

## Technical notes

- At **Also commands and edits**, a standing permission could also be written as a harness allow rule where the harness supports one.
