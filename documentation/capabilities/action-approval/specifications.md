# Action approval

## Problem and outcome

Threads run on their own, many at once, and some of their actions cannot be undone or reach other people: deleting files, sending a message, pushing code, paying. The user decides each of these from any device, in plain language, and can grant standing permissions so that threads run autonomously on what the user already trusts them with.

## Agreed behavior

Version 1 serves the installation's owner. In future hosted missions, only the host approves risky actions and grants standing permissions (CHG-0017). A guest's request to trigger work carries no approval. See the [hosted agreements](../../architecture.md#future-multiplayer-open-architecture-questions).

### Asking

- **Sandbox-first autonomy** (CHG-0208, replacing CHG-0035's sensitive-command list). Each harness runs its commands inside a sandbox: Claude Code and Codex their own, OpenCode inside the host's (Seatbelt on macOS, bubblewrap on Linux), started by Iskios. The sandbox contains damage to this computer's files and processes; it does **not** contain data: its network reaches many hosts (Codex and OpenCode any host, Claude Code a broad allowlist of registries, code hosts, release hosts, and CDNs, plus any other host it asks about while sandboxed, which Iskios allows: that one ask only, never a sandbox escape), so whatever a command sends can leave the computer, a push to an allowed host included. Iskios judges no command by its words. Before OpenCode runs anything unasked, Iskios confirms in the process table that its executor (`serve --stdio`) runs below the wrapped process; if it cannot, every action asks as for an escape. A wrapped OpenCode never writes a folder that OpenCode runs outside the sandbox read: its data folder is the service's own copy per account, which holds the account's sign-ins, copied one way from the account's real data folder at each start (a changed or revoked sign-in follows; nothing flows back, and no file of the real folder is copied), and its configuration folder holds a read-only copy of the owner's OpenCode settings and Markdown agents, commands and modes, made at each start, never its plugins or tools. Settings that point at paths on this computer, or plugins the settings name, may behave differently inside the sandbox. A thread's earlier OpenCode session kept in the real data folder cannot be loaded inside the sandbox: OpenCode then starts a new session for the thread, which replaces the earlier one for later starts; its first message carries the thread's handover notes (its conversation so far, as after a change of harness, thread-handover), and the thread shows a line saying OpenCode could not pick up its earlier conversation and that the new one was given those notes; the messages stay. Outside the sandbox, a session that cannot load still fails the turn. A sign-in OpenCode exports without an integration id is not copied, so the providers behind such sign-ins are unavailable to sandboxed OpenCode; OpenCode's own `auth list`, run outside Iskios, shows which they are, and signing in to that provider again gives the sign-in an integration id. If a provider makes refresh tokens single-use, a refresh inside the sandbox's copy can invalidate the real folder's sign-in; signing in again outside Iskios restores it. This is accepted as an annoyance, not a boundary failure: the copy stays, OpenCode never falls back to the real folder, and sign-ins are not restricted. Every sandboxed OpenCode process carries the service's marker in its environment; one left running after its `acp` ended, or by an earlier run of the service, is ended when the service starts and whenever a wrapped OpenCode starts or ends, and only a process carrying that exact marker is ever ended this way.
- **A thread's folder that points elsewhere** (CHG-0208). Before starting any harness, Iskios checks the thread's folder by its real path: the folder must not be a link and must lie in its root (the workspace's own folder, or the scratch folder for a thread without a workspace), and that root must not be a link, nor, for a workspace, resolve anywhere other than the folder added as the workspace. Otherwise a sandbox would write where the link points, outside the workspace, so the harness is not started there: the owner is asked one question naming the folder, where it really points, and what the sandbox could then write. The question is a one-time confirmation of that start: it offers **Allow** and **Deny** only, never **Always allow**; the service refuses an Always allow answer to it and never saves a standing permission for it, and no standing permission answers it. A later start in a folder that is still, or again, a link asks again. **Deny** fails the turn with the reason. **Allow** differs by harness. OpenCode, whose sandbox Iskios provides, runs without a sandbox for that thread, every command asking as "Run without a sandbox" and every file change as "Change a file outside the workspace"; its sandbox is never widened to the link's target. Claude Code and Codex keep their own sandbox and are started in the folder's real path (as their process folder, and as Codex's thread folder), so the folder their sandbox writes is where the link really points, and the thread shows a line saying its folder is a link and where it points. A changed link restarts their process, so the next start checks it again. The shared edit check counts a file in a link's target as outside the thread's folder, unless the owner allowed a start there and the folder still points there.
- At the default level a thread works on its own. It judges for itself which actions are consequential, those that reach people or systems outside the computer or cannot be undone, and asks before them through `request_approval`, as a question in its own conversation; its instructions name examples, not a rule Iskios enforces.
- When a harness itself asks for permission, Iskios decides from where the action runs, never from its words: inside an active sandbox it runs without a question and leaves a line; an escape from the sandbox (Claude Code's `dangerouslyDisableSandbox`, any escalation Codex asks for), a file change the harness makes outside the thread's folder, and any action of a harness with no sandbox on this computer (the host's sandbox cannot start, or OpenCode's sandbox tool is missing) ask, with the exact command or target and the capability it needs ("Run outside the sandbox", "Change a file outside the workspace", "Widen the sandbox", "Run without a sandbox"), and nothing broader. A prompt matching the escape just allowed in that turn, or a standing permission for that exact action and capability, runs.
- Each question covers exactly one action. A thread that needs three actions asks three questions.
- Words never approve a command (CHG-0208): neither the owner's message quoted by a thread, nor a Ritual's instruction, nor anything a thread writes. A command question is spared only by a standing permission for that exact action. Structural actions on the app (acting on quests, settings, realms, Rituals) follow their own provenance rule in [mission-coordination](../mission-coordination/specifications.md).
- A thread message never carries an approval, and no thread can answer another thread's question.

### The question

- A question is written for someone who does not read code. It leads with what the thread wants to do and what that affects, in plain words, for example "Push today's 3 commits to GitHub. This sends your changes off this computer, where everyone with access to the repository sees them." **Show details** reveals the exact command, file changes, or recipient and text.
- Outside its thread, a question also shows its mission and thread.
- The buttons are **Allow**, **Always allow**, and **Deny**. An optional message beside Deny tells the thread why or what to do instead (CHG-0035). A question with no permission to save (a one-time confirmation: a structural action, or a thread folder that is a link) shows only Allow and Deny (CHG-0208).
- On a denial, the thread carries on with the refusal.

### Waiting

- A thread with an open question is in the **Attention** state, shown prominently and sent as a phone notification with no content.
- A question waits with no time limit while the rest of the mission keeps running.
- A question is withdrawn when the user interrupts or stops its thread.

### Where to answer

- In the question's thread, and from the list of open questions at the top of the dashboard, on the desktop and on the phone. The phone notification opens that list.

### Standing permissions

- **Always allow** approves the action and grants a standing permission for that exact command or target (CHG-0208: never a pattern the thread proposed), under the capability its question named. A permission for an ordinary action never covers the same command's escape from the sandbox.
- A standing permission applies in the thread's workspace, or in its mission when the thread has no workspace, to every thread there. The user can widen it to everywhere from the Permissions page.
- Every thread knows the standing permissions that apply to it and does not ask for an action they cover.

### Approval level

- One approval setting has two levels: **Sensitive actions only** (the default; since CHG-0208 it means escapes from the sandbox and unprotected actions) and **Also commands and edits**, which turns the harnesses' own permission prompts back on, each one answered with the same buttons.
- At **Also commands and edits**, Iskios follows the allow and deny rules the user set in each harness's own settings.

### Permissions page

- Settings has a **Permissions** row showing the current level, for example "Permissions · Sensitive actions only". It opens a page with:
  - the approval level;
  - the standing permissions, each with its scope, widenable to everywhere and removable;
  - the history of every answer across threads, filterable by mission.
- Each answered question also stays in its thread as a short line with the action, the answer, the time, and the device, for example "Allowed `git push` · 14:02 · phone". Withdrawn questions, and harness prompts run without a question, are recorded the same way.

## External contract

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `request_approval` | Ask the user before one action the thread judges consequential, or before one exact command outside the sandbox | A plain sentence saying what and what it affects, the exact details, and `outsideSandbox` when asking to leave the sandbox | Allowed; Allowed, with the standing permission granted; or Denied, with the user's message if any |

A withdrawn question gets no answer, since its turn has ended.

## Acceptance and validation

- **Automated, with a fake harness**:
  - a sandboxed command run without a question whatever it does, leaving a line; an escape from the sandbox, a file change outside the thread's folder, and any prompt of a harness with no sandbox asked about once, with the exact command and capability;
  - one question per action, never bundled;
  - each answer reaching the thread: Allow, Always allow, Deny, and Deny with a message;
  - an action named in the user's message and quoted by the thread, or in a Ritual's instruction, still asked;
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
- Judging commands by their words; the sandbox, and the thread's own judgment, take that place (CHG-0208).
- Containing data: with the network open, the sandbox cannot keep data on this computer.

## Technical notes

- At **Also commands and edits**, a standing permission could also be written as a harness allow rule where the harness supports one.
