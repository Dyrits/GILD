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

## CHG-0010 · 2026-11-04 · Action approval specified

Type: Documentation
Event: Agreement
Scope: Action approval, requirements, glossary

Summary: Agreed the observable behavior and acceptance of action-approval:
- a thread asks for an approval as a question in its conversation through `request_approval`, in one natural-language sentence with the exact action behind Show details; the harnesses' own permission prompts are off;
- at the default level it asks before deleting what it did not create, editing outside its workspace, pushing code, publishing, sending to a person, submitting a form, paying, or anything else that cannot be undone or leaves the computer; one question per action;
- the buttons are Allow, Always allow, Deny, and Deny with a message; Always allow grants a standing permission for that kind of action in the workspace, or the mission without one, widenable to everywhere;
- an action named in the user's message, or in a routine's instruction, needs no question;
- questions wait with no time limit, can be discarded, are withdrawn on interrupt or stop, and are answered in the thread or from a list on the dashboard, on every device;
- one setting, Risky actions only (default) or Also commands and edits, which turns the harness prompts back on and follows the harnesses' own allow and deny rules;
- a Permissions page in Settings with the level, the standing permissions, and the history of every answer, which also stays as a line in its thread.
Also relaxed by the user: the requirement Approval per action now allows standing permissions the user granted; a single approval still never carries over.
Also agreed for the glossary and renamed throughout, except in this changelog's history: the thread state Needs you becomes Attention; the journal's summary becomes the Briefing, and "brief" leaves the Journal's avoided words. New terms: Briefing, Standing permission, Attention.
Also made consistent: the architecture's Approval flow and requirement row, thread-tree's and scoped-intel's notes on Approval per action, and links to action-approval from the specifications that depend on it.
Reason: Threads must run autonomously on what the user trusts, and ask in plain words before anything that cannot be undone.
References: documentation/capabilities/action-approval/specifications.md, documentation/requirements.md, documentation/glossary.md, documentation/architecture.md, documentation/outline.md, documentation/capabilities/thread-tree/specifications.md, documentation/capabilities/thread-messaging/specifications.md, documentation/capabilities/mission-journal/specifications.md, documentation/capabilities/mission-tracking/specifications.md, documentation/capabilities/mission-coordination/specifications.md, documentation/capabilities/scoped-intel/specifications.md
Validation: Authorized by the user in the action-approval interview, rounds 1 to 5, on 2026-11-04, including relaxing the requirement Approval per action (Q15).
Evidence: The user's answers to Q1 to Q22; Q1 and Q7 were replaced by Q10, and the name Attention was chosen from offered options.

## CHG-0011 · 2026-11-04 · Budget control specified

Type: Documentation
Event: Agreement
Scope: Budget control, glossary

Summary: Agreed the observable behavior and acceptance of budget-control:
- a budget holds an optional cost limit for API-key spending and an optional token limit for subscription spending, never converted into each other;
- budgets exist on missions, on Control, and as one global budget over a day, week, or month (default); single threads have no budget and draw on their mission's;
- Settings hold a default mission budget and the global budget, both empty at first; a mission's budget is changed from the mission; only the user sets or raises a budget;
- rings per limit fill as a budget is used, orange from 80% and red at 100%, and open a budget window with the split by provider and thread; no message at 80%; threads carry one budget line in their context;
- at a limit the turn stops at once, the threads go to Attention, and the user chooses Raise budget (threads resume) or Stop; the global limit stops every thread, Control included, with one shared question; opening threads and missions is refused at a reached limit; lowering below the spending stops threads the same way;
- each budget change and stop is recorded as a line in the mission's top thread or in Control.
Also agreed for the glossary: Budget now covers missions and Control only; new terms Global budget; Attention includes a budget reached.
Also made consistent: the outline's capability line, thread-tree's Attention state and dependency, mission-tracking's dashboard row and dependency, mission-coordination's Control budget, an architecture Budget flow, and a backlog note on grouping the budget window with the context gauge.
Reason: The user pays for delegated work knowingly, and no mission or agent spends past a limit the user chose.
References: documentation/capabilities/budget-control/specifications.md, documentation/glossary.md, documentation/outline.md, documentation/architecture.md, documentation/backlog.md, documentation/capabilities/thread-tree/specifications.md, documentation/capabilities/mission-tracking/specifications.md, documentation/capabilities/mission-coordination/specifications.md
Validation: Authorized by the user in the budget-control interview, rounds 1 to 4, on 2026-11-04.
Evidence: The user's answers to Q1 to Q19; Q3 and Q4 replaced thread budgets with mission, default, and global budgets, confirmed in Q6.

## CHG-0012 · 2026-11-04 · Workspace attachment specified

Type: Documentation
Event: Agreement
Scope: Workspace attachment, glossary

Summary: Agreed the observable behavior and acceptance of workspace-attachment:
- a mission's or thread's workspace is chosen before it starts, by browsing folders under the browsable roots (home folder by default, from the desktop or the phone, with New folder), by giving a repository link cloned into the clone location, or none; a folder becomes a workspace when first chosen, and a repository already cloned is reused;
- Control clones a repository link it is given and opens the mission there; threads choose or clone workspaces without asking inside the roots and the clone location, and are refused elsewhere (`list_workspaces`, `clone_repository`);
- a workspace is identified by its path and never changes after a thread starts, except by relocating a moved folder; a missing folder sends the thread to Attention with Retry, Relocate, and Clone again for a cloned workspace;
- threads with no workspace work in their mission's scratch folder;
- a thread belongs only to the workspace chosen for it; instructions, skills, and MCP servers come from the folder's own `AGENTS.md`, `CLAUDE.md`, `.agents`, and `.claude`; intel and standing permissions stay in OpenMission's data; no `.openmission` folder;
- the Workspaces page offers Hide (restored by choosing the folder again) and Delete permanently, neither touching the folder;
- Own copy, off by default, gives a thread in a git workspace its own worktree and branch, shared by the threads beneath it and merged back with one button.
Also agreed for the glossary: Workspace now says it is chosen before the thread starts; new terms Browsable root, Scratch folder, Own copy; Attention includes a missing workspace folder.
Also made consistent: the outline's capability line, thread-tree's Attention state and `open_thread` arguments, mission-coordination's cloning and its handover note (the workspace stays), links from scoped-intel and action-approval, an architecture Workspace flow and Git integration, and the backlog (thread worktrees settled; terminal and DeltaDB added).
Reason: Every thread must work in the right folder with that folder's context, and never in a folder the user did not offer.
References: documentation/capabilities/workspace-attachment/specifications.md, documentation/glossary.md, documentation/outline.md, documentation/architecture.md, documentation/backlog.md, documentation/capabilities/thread-tree/specifications.md, documentation/capabilities/mission-coordination/specifications.md, documentation/capabilities/scoped-intel/specifications.md, documentation/capabilities/action-approval/specifications.md
Validation: Authorized by the user in the workspace-attachment interview, rounds 1 to 4, on 2026-11-04.
Evidence: The user's answers to Q1 to Q22; Q20 read as keeping Own copy in version 1 with a simple merge, and Q21 as keeping workspace intel in OpenMission's data rather than a `.openmission` folder.

## CHG-0013 · 2026-11-04 · Future multiplayer required

Type: Documentation
Event: Agreement
Scope: Product scope and architecture

Summary: Multiplayer is a future OpenMission goal, covering both people joining one host's missions and collaboration across their own installations. Single-user scope applies to the first build, and architectural assumptions that could block either form must be reviewed beforehand. Data sharing and authority remain open.
Reason: Avoid building permanent single-owner assumptions into the first implementation.
References: documentation/requirements.md, documentation/outline.md, documentation/architecture.md, documentation/backlog.md
Validation: The user explicitly stated the future multiplayer goal and requested consideration of blockers before building.
Evidence: The user stated the multiplayer goal and selected "Eventually both" when asked about hosted participation and collaboration across installations.

## CHG-0014 · 2026-11-04 · Provisional shared mission ownership

Type: Documentation
Event: Agreement
Scope: Multiplayer architecture

Summary: For now, each shared mission has one host installation owning its authoritative state. Collaborators join from a browser or their own installation; collaboration pauses while the host is offline. This choice is subject to evolution. Execution ownership, participant authority, and private versus shared context remain open.
Reason: Preserve the local service and SQLite design without requiring replicated state and offline conflict rules before the first build.
References: documentation/architecture.md
Validation: The user accepted the recommendation in multiplayer Q1 on 2026-11-04.
Evidence: "Yes for now, but subject to evolve."

## CHG-0015 · 2026-11-04 · Vite+ removed from the stack

Type: Documentation
Event: Agreement
Scope: Toolchain

Summary: Removed Vite+ from the chosen stack. The app uses Expo CLI with Metro. Tooling for other packages, tests, linting, and formatting remains open; the alternatives suggested in the discussion were not adopted.
Reason: Expo already supplies the app's bundler, and the other packages do not yet justify a unified Vite+ toolchain.
References: documentation/architecture.md
Validation: The user explicitly requested removal of Vite+ and a committed, pushed handoff.
Evidence: "Remove Vite+ from our choice."

## CHG-0016 · 2026-11-05 · Hosted execution and guest discussions agreed

Type: Documentation
Event: Agreement
Scope: Multiplayer architecture

Summary: In the first hosted multiplayer version, all agents run on the mission host. Each guest may either trigger agents or only discuss. Discussion-only guests write in discussions beneath messages; their messages enter agent context only when the host explicitly submits selected messages. The host may instead write their own conclusion. Approval authority, standing permissions, spending, private context, and revocation remain open.
Reason: Keep execution and workspace access on one computer, and let the host choose which guest discussion reaches agents.
References: documentation/architecture.md
Validation: The user accepted both recommendations in the resumed multiplayer interview on 2026-11-05.
Evidence: Q1, "Yes, host execution and two guest permissions"; Q2, "Yes, only explicitly submitted messages".

## CHG-0017 · 2026-11-05 · Host authority and spending agreed

Type: Documentation
Event: Agreement
Scope: Multiplayer architecture

Summary: Only the host approves risky actions, grants standing permissions, and changes budgets. Guest-triggered work uses the host's provider account and counts toward the mission and global budgets. Access to host resources and guest visibility remain open; the proposed sharing toggle has no agreed scope or default yet.
Reason: Guests may request work within the host's budgets while the host retains authority over risky actions and spending limits.
References: documentation/architecture.md
Validation: The user accepted the recommendations in multiplayer Q3 and Q4 on 2026-11-05.
Evidence: Q3, "Yes, only the host"; Q4, "Yes, host pays within existing budgets".

## CHG-0018 · 2026-11-05 · Shared mission resource access and visibility agreed

Type: Documentation
Event: Agreement
Scope: Multiplayer architecture

Summary: A toggle when sharing a mission lets its agents retain access to the host's selected MCP connections, skills, and intel, regardless of who triggers a turn. It is on by default. Turning it off restricts all turns in that shared mission to resources explicitly selected by the host. Guests see shared conversations and agent results; resource settings, credentials, and unshared intel remain hidden. Replies may reveal information obtained through enabled resources.
Reason: Preserve agent capabilities when a guest triggers work while keeping host resource configuration private.
References: documentation/architecture.md
Validation: The user accepted the recommendations in multiplayer Q6 and Q7 on 2026-11-05.
Evidence: Q6, "Yes, on by default"; Q7, "Yes, show conversations and results".

## CHG-0019 · 2026-11-05 · Guest identities and mission invitations agreed

Type: Documentation
Event: Agreement
Scope: Multiplayer architecture

Summary: Guests use a separate identity approved by the host, without a required central OpenMission account. A single-use invitation grants access to one mission, with discussion-only permission by default. The host may grant permission to trigger agents when inviting or later. Identity verification, invitation expiry, history access, and revocation remain open.
Reason: Keep guest access separate from owner device pairing and make mission and spending permissions explicit.
References: documentation/architecture.md
Validation: The user accepted both recommendations in the resumed interview on 2026-11-05.
Evidence: Q1, "Host-approved guest identity (recommended)"; Q2, "Single-use, one mission (recommended)".

## CHG-0020 · 2026-11-05 · Guest history access and permission changes agreed

Type: Documentation
Event: Agreement
Scope: Multiplayer architecture

Summary: Guests see the whole mission, including past conversations, all threads, and results; the host sees this scope before sharing. Removing a guest immediately blocks access, cancels their queued requests, and stops their running turns. Completed results remain, and actions already performed cannot be undone by removal. Downgrading a guest to discussion-only cancels their queued requests but lets running turns finish; discussion access remains.
Reason: Give guests the context to participate and define how permission changes affect access and spending already initiated.
References: documentation/architecture.md
Validation: The user accepted all three recommendations in the resumed interview on 2026-11-05.
Evidence: Q1, "Whole mission history (recommended)"; Q2, "Revoke access and stop work (recommended)"; Q3, "Cancel queued; finish running (recommended)".

## CHG-0021 · 2026-11-05 · Guest verification, invitation expiry, and data location agreed

Type: Documentation
Event: Agreement
Scope: Multiplayer architecture

Summary: Opening an invitation creates a pending request with the guest's chosen name. The host verifies the person through a trusted channel before approving access. Unused invitations expire after 24 hours; the host can cancel or replace them. The first hosted version keeps mission documents and data on the host while guests receive shared conversations and results. Guest local copies are a future direction, with scope, synchronization, and retention still open.
Reason: Require host verification before guest access and preserve host-held data for the first hosted version without excluding future local copies.
References: documentation/architecture.md, documentation/requirements.md, documentation/backlog.md
Validation: The user accepted the identity and expiry recommendations and clarified the intended progression of data storage.
Evidence: Q1, "Host verifies and approves (recommended)"; Q2, "After 24 hours (recommended)"; Q3, "I think, first, everything is on the host, but in future version, they would probably get a local copy of the mission documents and data."

## CHG-0022 · 2026-11-05 · Tool and skill loading scope and acceptance agreed

Type: Documentation
Event: Agreement
Scope: Tool and skill loading

Summary: Finalized the single-user first-build scope: existing skill folders, OpenMission-managed global and workspace MCP servers, per-thread selection and inheritance, skill names, descriptions, and locations at turn start, and full instructions loaded when used. Hosted resource access follows CHG-0018. Skill installation through the app, MCP import, and synchronization across installations remain deferred. Accepted automated checks and the desktop and phone walkthrough, including the agent additions that loading grants no action approval and this capability adds no new thread tool contract. Reconciled current documentation with the hosted agreements; unresolved invitation, reconnect, and delegated-work behavior remains in the backlog.
Reason: Complete the capability's behavior agreement before designing the first slice.
References: documentation/capabilities/tool-and-skill-loading/specifications.md, documentation/capabilities/tool-and-skill-loading/draft.md, documentation/architecture.md, documentation/requirements.md, documentation/outline.md, documentation/backlog.md, documentation/capabilities/action-approval/specifications.md, documentation/capabilities/budget-control/specifications.md, documentation/capabilities/scoped-intel/specifications.md
Validation: The user accepted both recommendations in the continuation interview on 2026-11-05. Documentation diff reviewed; acceptance checks await implementation.
Evidence: Q1, "Yes, finalize this scope (recommended)"; Q2, "Yes, accept these checks and additions (recommended)".

## CHG-0023 · 2026-11-05 · First slice boundary and harness agreed

Type: Documentation
Event: Agreement
Scope: First slice technical design

Summary: Selected Claude Code as the first harness, with a fake harness for automated checks. The first slice covers starting a mission, opening threads, messaging, results, stopping, and reopening. Dependencies and remaining acceptance criteria are staged explicitly. Messages to Stopped threads are accepted and retained until the user explicitly resumes the thread; corrected the conflicting refusal in the messaging tool contract. Added a proposed shared technical design and three capability blueprints, with acceptance coverage. Their technical choices remain under review; production implementation is not authorized.
Reason: Establish a bounded first design without claiming completion of the full capabilities.
References: documentation/first-slice-design.md, documentation/capabilities/mission-tracking/blueprint.md, documentation/capabilities/thread-tree/blueprint.md, documentation/capabilities/thread-messaging/blueprint.md, documentation/capabilities/thread-messaging/specifications.md
Validation: The user selected the first-harness and staged-scope recommendations and confirmed stopped-thread delivery. Documentation checks are recorded separately from implementation acceptance, which has not run.
Evidence: Q1, "Yes, Claude Code"; Q2, "Yes, stage the remaining behavior"; follow-up, "Keep stopped until resumed".

## CHG-0024 · 2026-11-05 · First slice code boundaries and continuation scope agreed

Type: Documentation
Event: Agreement
Scope: First slice technical design

Summary: Accepted apps/app for the Expo UI, apps/desktop for Electron, packages/service for missions, threads, messaging, execution, context, and SQLite, and packages/contracts for shared transport records and validation. Continuing Done threads and explicitly resuming Stopped threads are included; reopening Done or Archived missions waits for mission-ending behavior. Workspace attachment is immutable after first start. Changes to harness, agent, model, and effort remain part of the later handover capability. Detailed command contracts, recovery, dependency gates, and tooling remain under review; this agreement does not authorize production implementation.
Reason: Set code ownership and clarify the slice without restricting future handover.
References: documentation/first-slice-design.md, documentation/capabilities/thread-tree/blueprint.md, documentation/capabilities/mission-tracking/blueprint.md
Validation: The user accepted all three recommendations in the resumed design review. No implementation acceptance checks have run.
Evidence: Q1, "Yes, accept these boundaries (recommended)"; Q2, "Yes, clarify this scope (recommended)"; Q3, "Yes, correct the blueprint (recommended)".

## CHG-0025 · 2026-11-05 · Iterative delivery, first batch, and toolchain agreed

Type: Documentation
Event: Agreement
Scope: First slice delivery and toolchain

Summary: The slice is built iteratively, one runnable and verified batch at a time, with decisions settled just in time; it is not prototyped. Batch 1 is a thin end-to-end path with the fake harness, recorded in documentation/work-in-progress.md. Electron runs the local service in a utilityProcess on its bundled Node (Electron 45.2.3 ships Node 24.22.2), and SQLite is reached through Effect's Node driver over the built-in `node:sqlite`. `packages/contracts` defines records with Effect Schema; the app may import Schema decode and encode functions but no Effect-style code. The app talks to the service over one authenticated loopback WebSocket carrying commands, queries, and the sequenced change subscription. Tests use Vitest with `@effect/vitest` on Node; Biome lints and formats. Recovery, chatter-guard resets, dependency gates, and the Idle fallback stay open until a batch needs them.
Reason: Get a working application early and let each batch decide the next.
References: documentation/work-in-progress.md, documentation/architecture.md, documentation/architecture-decision-record/0010-effect-in-the-service-and-relay.md, documentation/first-slice-design.md
Validation: The user chose each recommendation one question at a time on 2026-11-05.
Evidence: "we'll not prototype but iterate"; first batch, "Thin end-to-end (Recommended)"; service host, "Electron utilityProcess (Recommended)"; contracts, "Effect Schema (Recommended)"; transport, "One loopback WebSocket (Recommended)"; tests, "Vitest + @effect/vitest (Recommended)"; lint and format, "Biome (Recommended)"; batch scope, "Yes, build it (Recommended)".

## CHG-0026 · 2026-11-05 · First batch delivered: thin end-to-end with the fake harness

Type: Feature
Event: Delivery
Scope: First slice, batch 1

Summary: `bun run dev` opens the Electron app, which runs the local service in a utilityProcess and loads the Expo web app. The owner starts a mission with one message, sees the fake harness's echo with Running then Idle, sends follow-ups, and finds missions and conversations again after a restart. The loopback WebSocket accepts only the per-launch owner token.
References: commit 649e232, packages/service/test/, documentation/work-in-progress.md
Validation: 11 Vitest checks pass on Electron's Node 24.22.2; typecheck and Biome pass; the flow was driven in the Electron window, including relaunch persistence and a refused tokenless connection. The user ran the app and accepted it.
Evidence: User, after the run-through with a screenshot of a two-message conversation: "Seems okay to me."

## CHG-0027 · 2026-11-05 · Batch 2 agreed: Claude Code chat without tools

Type: Documentation
Event: Agreement
Scope: First slice, batch 2

Summary: Batch 2 replaces the echo with the installed Claude Code for chat only: no tools, every permission prompt denied, no MCP servers, skills, or user and project Claude settings, so no action needs approval yet; the approval prompt is batch 3. Each thread runs one long-lived `claude -p` stream-json process, closed after 10 idle minutes and resumed from its stored session. A mission starts with a model and effort chosen in the start box and prefilled from saved defaults; the thread keeps them. Token usage is totalled per mission and never shown as dollars. Replies can appear word by word, controlled by a setting. Details and checks are in documentation/work-in-progress.md.
Reason: Settle the largest unknown, the harness protocol, in the smallest safe step.
References: documentation/work-in-progress.md, documentation/first-slice-design.md, documentation/capabilities/mission-tracking/specifications.md
Validation: The user chose each recommendation one question at a time on 2026-11-05. Evidence from Claude Code 2.1.302: `claude --help` lists stream-json input and output, `--session-id`, `--resume`, `--tools`, `--permission-prompts host|none`, `--permission-prompt-tool`, `--model`, `--effort` (low to max), and `--include-partial-messages`; one stream-json process answered two consecutive messages with one result each, per-turn token usage, and a stable session identifier.
Evidence: batch, "Real Claude Code (Recommended)"; approvals, "Chat only now (Recommended)"; process, "One process per thread (Recommended)"; model, "Picker at start (Recommended)"; scope, "A and B (B being in option in the settings)".

## CHG-0028 · 2026-11-05 · Code conventions agreed and applied

Type: Documentation
Event: Agreement
Scope: Code conventions

Summary: documentation/conventions.md records how code is written: naming (boolean prefixes), size and extraction, `null` for deliberate absence with `undefined` only from outside (`void 0` where an API needs it), casts, Effect-style errors with no `throw`, side effects, comments, tests with fakes, named exports, and dependencies. Biome now sorts imports, keys, attributes, interface members, and package.json fields, except where key order carries meaning (opencode.json, package.json, skills-lock.json). The code was brought in line: the app screens split into one module per screen, `Schema.TaggedError` errors yielded directly, configuration read through `Config`, desktop startup failures shown and the app quit, booleans renamed, and the saved setting `streamReplies` renamed `shouldStreamReplies` by migration 0003, which keeps the saved value.
Reason: Give reviewers and agents written rules with their reasons instead of inferring them from the code.
References: documentation/conventions.md, biome.json, packages/service/src/store.ts
Validation: The user answered the codify interview on 2026-11-05. `bun run test` passes 19 checks with 1 skipped; typecheck and Biome pass; the built service entry starts with its variables, stops when `OPENMISSION_TOKEN` is missing, and runs migration 0003; the migration's SQL keeps a saved `false`.
Evidence: Q1 "Ok. It is not my personal convention but it fits more global standards."; Q2 "I would prefer to have a prefix, showing directly it is a boolean value."; Q3 "Yes and do the split."; Q4 "Avoid assignement to undefined. It should only comes from side effect. Rest can be null. If we really need to assign undefined, use void 0 instead."; Q5 "A"; Q6 "Check effect convention, but the idea is to not throw, no?"; Q8 "Yes, and try to comments often when necessary."; Q7, Q9 to Q11 yes; Biome "I'd like Biome to have all the options to sort keys, properties, attributes, etc..."

## CHG-0029 · 2026-11-05 · Owner conventions merged into the code conventions

Type: Documentation
Event: Agreement
Scope: Code conventions

Summary: documentation/conventions.md adds one-word local names with nesting only for real groups, test doubles named by a word or their location instead of a `$` prefix, and branching without `switch`: typed keyed objects, `Match.valueTags` for tagged unions, and `Object.hasOwn` for outside keys. The service's request dispatch now uses `Match.valueTags`.
Reason: Keep the owner's own conventions where they help readability, and drop the parts that conflict with flat contracts or common meanings of `$`.
References: documentation/conventions.md, packages/service/src/service.ts
Validation: The owner listed their usual conventions and accepted each recommendation on 2026-11-05. Removing one handler from the dispatch fails `tsc`; `bun run test`, typecheck, and Biome pass.
Evidence: "I agree with your recommandations. So, as you said."

## CHG-0030 · 2026-11-05 · Batch 2 delivered: Claude Code chat without tools

Type: Feature
Event: Delivery
Scope: First slice, batch 2

Summary: Missions now run on the installed Claude Code in chat-only mode, as agreed in CHG-0027: model and effort picked at start from saved defaults, one long-lived process per thread resumed by session after idle close or restart, replies streamed word by word behind a setting, token usage per mission, and Failed with a reason and retry. Later in the batch, code conventions (CHG-0028, CHG-0029) and the setup's checks and guards were applied without changing behavior.
References: commits ddb888d, baaf1eb, d62a904; documentation/work-in-progress.md; packages/service/src/claude.ts
Validation: `bun run test` passes 19 checks with 1 skipped (the opt-in live check, which passed against Claude Code 2.1.302 earlier in the batch); typecheck and Biome pass; the flow was driven in the Electron window with real Claude Code before the conventions refactor. The user ran the app and accepted it.
Evidence: User, after the run-through: "Seems good to me."
