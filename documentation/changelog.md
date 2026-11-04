# Changelog

## CHG-0001 · 2026-11-04 · Thread tree and thread messaging specified

Type: Documentation
Event: Agreement
Scope: Thread tree and thread messaging

Summary: Agreed the observable behavior and acceptance of thread-tree and thread-messaging:
- opening threads, with copied and editable defaults;
- the starting context, including the opener's messages since the last journal entry;
- subagents as threads;
- the seven thread states;
- results that reach the parent whenever they come;
- stopping without cascade, and deleting with confirmation;
- user-only depth limit, running-thread cap, and budget guard;
- tree-bound messaging, with delivery into the current turn where possible;
- steer or queue for user messages;
- interruptions and the chatter guard.
Reason: Every other capability builds on threads and their messages.
References: documentation/capabilities/thread-tree/specifications.md, documentation/capabilities/thread-messaging/specifications.md
Validation: Authorized by the user in the specification interview, rounds 1 and 2, on 2026-11-04.
Evidence: The user's answers in that interview.

## CHG-0002 · 2026-11-04 · Off-topic requests become missions or asides

Type: Documentation
Event: Agreement
Scope: Thread tree

Summary: When a user's message clearly shares nothing with the mission's journal summary, the thread suggests a new mission instead of answering. Declining opens an aside beneath the thread, kept out of the mission journal. Both start fresh with only the off-topic part of the message, and the original thread keeps a link to where it went. A setting can skip the suggestion. The thread tool for this is `suggest_mission`.
Reason: Missions stay focused, and their journals free of unrelated work.
References: documentation/capabilities/thread-tree/specifications.md#off-topic-requests
Validation: Authorized by the user on 2026-11-04.
Evidence: The user's answers to the off-topic request questions.

## CHG-0003 · 2026-11-04 · Asides stay aware of their mission

Type: Documentation
Event: Agreement
Scope: Thread tree

Summary: Changes how an aside starts and what it may do, replacing that part of CHG-0002. It starts with:
- the off-topic part of the message;
- the mission journal's summary;
- a note that the message was put aside;
- the rule to inform its parent with a thread message whenever the conversation comes back to the mission.
It still does not update the journal itself. A new mission opened from an off-topic request still starts fresh.
Reason: The user can drift back to the mission inside an aside, and the mission must hear about it.
References: documentation/capabilities/thread-tree/specifications.md#off-topic-requests
Validation: Authorized by the user on 2026-11-04.
Evidence: The user's message correcting the aside's starting context.

## CHG-0004 · 2026-11-04 · Off-topic requests can continue another mission

Type: Documentation
Event: Agreement
Scope: Thread tree

Summary: Before suggesting a new mission for an off-topic request, the thread looks for missions that fit it, using `find_missions`. The search covers titles and journal summaries only, and includes every mission that is not deleted. The suggestion lists up to 3 matching missions first, as Continue in choices. Continue in sends the off-topic part to that mission's top thread as the user's message, waking it if it is Done or Idle. The setting that skips the suggestion applies only when no mission matches.
Reason: Requests that belong to an existing mission should continue it rather than start a duplicate.
References: documentation/capabilities/thread-tree/specifications.md#off-topic-requests
Validation: Authorized by the user on 2026-11-04.
Evidence: The user's answers to the mission discovery questions.

## CHG-0005 · 2026-11-04 · Threads opened by agents can be folded

Type: Documentation
Event: Agreement
Scope: Thread tree

Summary: The setting Show threads opened by agents is on by default. When it is off, threads an agent opened fold into their opener as a count the user can unfold. A folded thread still appears when it becomes Needs you or Failed. Folding changes only the view.
Reason: Less technical users can keep a simple tree, while every piece of work stays visible on demand.
References: documentation/capabilities/thread-tree/specifications.md#threads-opened-by-agents
Validation: Authorized by the user in the mission-journal interview, round 1, on 2026-11-04.
Evidence: The user's answer to Q1.

## CHG-0006 · 2026-11-04 · Mission journal specified

Type: Documentation
Event: Agreement
Scope: Mission journal

Summary: Agreed the observable behavior and acceptance of mission-journal:
- a summary and an add-only change log, each entry with its author and time, never edited or deleted;
- a summary limit of 2,000 tokens, adjustable, estimated the same way on every harness;
- new threads start with the summary and the 20 latest entries, which changes the starting context in thread-tree;
- threads add an entry on a decision, a change of direction, or finished work, and `report_result` asks for one;
- summary rewrites name the version they were based on, and a stale one is refused;
- the user's edits are recorded as entries by the user;
- ending a mission adds an entry, and the journal stays readable and searchable;
- the thread tools `read_journal` and `update_journal`.
Reason: Threads on different harnesses share where the mission stands without sharing their histories.
References: documentation/capabilities/mission-journal/specifications.md, documentation/capabilities/thread-tree/specifications.md#opening-a-thread
Validation: Authorized by the user in the mission-journal interview, rounds 1 and 2, on 2026-11-04.
Evidence: The user's answers to Q2 to Q9.

## CHG-0007 · 2026-11-04 · Scoped intel specified

Type: Documentation
Event: Agreement
Scope: Scoped intel

Summary: Agreed the observable behavior and acceptance of scoped-intel:
- thread, workspace, and global scopes, searched from the thread outward, the most specific intel winning;
- every new thread starts with all the intel in scope;
- threads save and change thread and workspace intel on their own, and global intel only with the user's approval;
- a rule given in a chat is saved as an intel, and instructions stay what the user writes in settings;
- widening to a wider scope needs approval;
- one intel holds at most 200 tokens, and nothing limits the amount of intel;
- the intel icon turns red past 10% of the chosen model's context window, and opens the intel panel;
- Tidy up intel, started from the panel, proposes changes the user approves;
- the thread tools `search_intel`, `save_intel`, `update_intel`, and `forget_intel`;
- "an intel" and "intels" replace "intel entry" in the glossary.
Also agreed for thread-tree: the user is warned before a thread starts when its starting context would take more than 25% of the chosen model's context window. Recorded in the backlog: Control, ending missions, and a thread panel with a context gauge.
Reason: Threads recall what they learned without carrying unrelated facts, and the user sees what intel costs.
References: documentation/capabilities/scoped-intel/specifications.md, documentation/capabilities/thread-tree/specifications.md#opening-a-thread, documentation/glossary.md, documentation/backlog.md
Validation: Authorized by the user in the scoped-intel interview, rounds 3 to 7, on 2026-11-04.
Evidence: The user's answers to Q12 to Q27, and the Hermes Agent memory documentation (https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) consulted for Q18.

## CHG-0008 · 2026-11-04 · Mission tracking specified

Type: Documentation
Event: Agreement
Scope: Mission tracking

Summary: Agreed the observable behavior and acceptance of mission-tracking:
- a mission's state is the most urgent among its threads (Needs you, Failed, Running, Waiting, Idle), and Done and Archived are set only when it ends;
- the top thread's result asks "Mark as done?" and never ends the mission on its own;
- after 14 days without activity by the user or an agent, the dashboard asks "Archive it or mark it as done?", and asks again after another 14 days if dismissed;
- auto-archive, off by default, archives Done missions after 30 days; both durations are adjustable;
- ending a mission with running threads confirms once, naming them, then stops them;
- writing in a Done or archived mission brings it back, and archived missions can be reopened from their own view;
- the top thread proposes the title with `set_mission_title`, and the user's rename wins;
- the dashboard lists title, state, workspace, threads, spending, and last activity, missions needing the user first, with filters and search, the same on the phone;
- spending totals the threads' spending in each provider's own unit, never pricing subscription tokens;
- starting a mission takes one message, with the other choices prefilled.
Also agreed: the workspace uses Bun, not pnpm, for package management (`documentation/architecture.md`). The backlog item on ending missions is now specified and removed.
Reason: The user sees where every mission stands, what needs them, and what it costs, and ends finished work without losing it.
References: documentation/capabilities/mission-tracking/specifications.md, documentation/architecture.md, documentation/backlog.md, documentation/outline.md
Validation: Authorized by the user in the mission-tracking interview, rounds 1 to 3, on 2026-11-04.
Evidence: The user's answers to Q1 to Q12.

## CHG-0009 · 2026-11-04 · Mission coordination specified

Type: Documentation
Event: Agreement
Scope: Mission coordination, thread messaging, glossary

Summary: Agreed the observable behavior and acceptance of mission-coordination:
- Control is pinned at the top of the dashboard on every device, cannot be deleted or ended, and can be hidden by a setting;
- it answers only questions about missions and OpenMission, and opens a mission for anything else, after offering up to 3 matching missions as Continue in;
- it picks a new mission's tier (Light, Balanced, Heavy, from settings) by the request's complexity, or the default model, and shows the choice;
- missions it opened tell it their result, Needs you, and Failed; it reads other missions only when asked;
- it acts on missions only at the user's request, with the dashboard's confirmations;
- it has no journal, starts each turn with the dashboard as text, global intel, and its 20 latest messages, and reads older ones only when asked;
- it uses global intel only, each save approved;
- the thread tools `open_mission`, `act_on_mission`, and `read_control_history`.
Also agreed for thread-messaging: a thread or the user can message any thread or mission referenced with `@`, across missions, with the reply coming straight back; without a reference, `@Control` forwards the message. Cross-mission messages are labelled in both threads, shown as event lines in Control, and covered by the chatter guard.
Also agreed for the glossary: "Mission journal" becomes Journal and "Mission dashboard" becomes Dashboard, renamed throughout; the list Control reads is the dashboard as text, with no term of its own.
Also made consistent with Control: a mission is a top thread other than Control (glossary, thread-tree); the architecture's thread message flow now matches thread-messaging and gains a Control flow; decision record 0005 notes the new cross-mission reach.
Recorded in the backlog: comparing Electron with Tauri and a Bun-compiled service, through a prototype. The Control backlog item is now specified and removed.
Reason: A less experienced user works through one chat, and missions reach each other explicitly without breaking the tree.
References: documentation/capabilities/mission-coordination/specifications.md, documentation/capabilities/thread-messaging/specifications.md, documentation/capabilities/thread-tree/specifications.md, documentation/architecture.md, documentation/architecture-decision-record/0005-thread-tools-over-mcp.md, documentation/glossary.md, documentation/outline.md, documentation/backlog.md
Validation: Authorized by the user in the mission-coordination interview, rounds 1 to 3, on 2026-11-04.
Evidence: The user's answers to Q1 to Q22.
