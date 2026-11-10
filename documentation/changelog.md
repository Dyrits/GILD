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

## CHG-0031 · 2026-11-05 · Batch 3 agreed: tools behind action approval

Type: Documentation
Event: Agreement
Scope: First slice, batch 3; Action approval

Summary: Batch 3 turns on Claude Code's built-in tools behind both approval levels, standing permissions, and the Permissions page. At **Risky actions only** (the default) Claude Code runs in its sandbox with in-workspace edits and sandboxed commands unasked; threads ask through `request_approval` on a local OpenMission MCP server, which also answers Claude Code's own prompts through `--permission-prompt-tool`. A Claude Code prompt matching the action just allowed in that thread runs once without a second question; any other prompt becomes a question. Without a sandbox (native Windows, Linux without bubblewrap and socat) the default level asks for every prompt and Settings says why. Answers are Allow, Always allow, Deny, Deny with a message, and Discard. An action named in the owner's latest message is allowed without a question when the thread's quoted words appear verbatim in it. Always allow saves a sentence and a command pattern, scoped to the mission and widenable to everywhere; workspace scope follows workspace attachment. Questions are answered in the thread or the dashboard's open-questions list, with a content-free desktop notification on macOS, Linux, and Windows; phone answering waits for device pairing. A Stop button stops one thread and withdraws its question; on startup, open questions are withdrawn and their thread becomes Idle. Routines, thread messages, and Interrupt are out of this batch. Details and checks are in documentation/work-in-progress.md.
Reason: Let threads act, with every risky action decided by the owner, while keeping the service able to verify what an approval covers.
References: documentation/work-in-progress.md, documentation/capabilities/action-approval/specifications.md, documentation/architecture-decision-record/0005-thread-tools-over-mcp.md, documentation/first-slice-design.md
Also made consistent: action-approval's Asking rule now says which harness prompts remain at the default level and how they are answered.
Validation: The user chose one question at a time on 2026-11-05. Evidence from Claude Code documentation (code.claude.com, via Context7): `--permission-prompt-tool` takes an MCP tool of a loaded server; `sandbox.autoAllowBashIfSandboxed` and `sandbox.network.allowedDomains` settings; sandbox on macOS (Seatbelt), Linux and WSL2 (bubblewrap, socat), not native Windows. The prompt tool's message format is not yet verified against the installed 2.1.302.
Evidence: path, "Both in one batch"; after Allow, "Match, else ask (Recommended)"; answers, "Everything"; where, "Desktop + macOS notice. Note that OpenMission should work on Linux and Windows as well if possible."; no sandbox, "Fall back to ask (Recommended)"; named action, "Quote check (Recommended)"; standing match, "Sentence + pattern (Recommended)"; scope, "Mission scope for now, but will be extended to workspace folder."; withdrawal, "Add Stop + restart rule (Recommended)"; confirmation, "Yes, build it (Recommended)".

## CHG-0032 · 2026-11-05 · Local git runs without a question at the default level

Type: Feature
Event: Agreement
Scope: First slice, batch 3; Action approval

Summary: At **Risky actions only**, when Claude Code's sandbox runs, OpenMission answers Claude Code's prompts for local git on the workspace's own repository itself: `init` inside the workspace, `add`, `commit`, `branch` and `tag` without deleting or forcing, `switch` without discarding or forcing, and the reading commands `status`, `log`, `diff`, `show`, `rev-parse`. Only git commands joined by `&&` qualify; other commands, redirections, substitutions, inline settings other than the author's name and address, and options that point git elsewhere (`-C`, `--git-dir`, paths outside the workspace) still ask. Pushes, pulls, fetches, remotes, resets, cleans, and checkouts still ask. These prompts leave no record line, like other edits inside the workspace. The thread's instructions tell it to run local git alone and outside the sandbox. At **Also commands and edits**, and without a sandbox, every prompt still asks.
Reason: The sandbox refuses writes under `.git`, and its write settings cannot lift a protected path, so every local commit became a question. Local git only changes the workspace, which the default level never asks about; casual owners should not be asked for it.
References: documentation/capabilities/action-approval/specifications.md (Asking), documentation/work-in-progress.md (Drive findings), packages/service/src/patterns.ts (`isLocalGit`), packages/service/src/approvals.ts, packages/service/src/instructions.ts
Validation: Claude Code's settings reference (code.claude.com, via Context7): sandbox `allowWrite` "entries cannot lift a protected path"; auto mode reviews actions with a classifier model. Checks: `bun run test` passes 45 with 2 skipped, live checks pass; typecheck and Biome pass. In the Electron window, a Haiku thread created a repository, committed, and branched with no question.
Evidence: The owner asked how OpenBot and other assistants handle permissions and leaned toward fewer questions for casual users; offered built-in safe git, an auto mode level, loosening the risky list, or no change, they chose "Built-in safe git (Recommended)".

## CHG-0033 · 2026-11-05 · Batch 3 delivered: tools behind action approval

Type: Feature
Event: Delivery
Scope: First slice, batch 3; Action approval

Summary: Threads run Claude Code's built-in tools behind action approval as agreed in CHG-0031 and CHG-0032: both approval levels, the sandboxed default, `request_approval` and the permission prompt tool on a per-thread local MCP endpoint, the one-time match, the quote check, standing permissions with the Permissions page, questions in the thread and on the dashboard, a content-free desktop notification, Stop, and withdrawal on restart. Fixed while driving the window: Claude Code's 300-second abort of silent MCP calls (the server entry now sets `timeout`), a question opened while a stopped thread's harness was exiting, questions left open by an abandoned call, harness questions without a reason, chained commands defeating the one-time match, and long history lines and filter chips.
References: documentation/work-in-progress.md (Batch 3, Drive findings); packages/service/src/approvals.ts, mcp.ts, patterns.ts, instructions.ts; apps/app/src/questions.tsx, permissions.tsx, notifications.ts
Validation: `OPENMISSION_LIVE_CLAUDE=1 bun run test` passes 47 of 47; typecheck and Biome pass. Driven in the Electron window with Claude Code and Haiku: a question answered after 5 min 51 s was accepted; quote check, one-time match, Always allow, a later push allowed by the standing permission, Remove, and Stop behaved as specified; local git ran without a question. Not verified: the desktop notification, and the owner's own run-through, which the owner skipped.
Evidence: "Anyway, when finished, let's hand-off ... Commit and push."

## CHG-0034 · 2026-11-06 · Batch 4 agreed: workspace attachment, first step

Type: Documentation
Event: Agreement
Scope: First slice, batch 4; Workspace attachment; Action approval
Summary: The owner agrees batch 4 as drafted in documentation/work-in-progress.md (Batch 4), with three changes. The folder browser gains a **Show hidden** toggle that also lists folders whose names start with a dot; they stay hidden by default. A thread about to start a turn in a workspace whose folder is gone goes to Attention with **Retry**, as workspace-attachment's Missing folder rule says, instead of failing the turn; Relocate and Clone again stay staged. Sandboxed threads in a workspace may reach the package registry and the GitHub release download hosts without a question, so a thread can install dependencies and run the project's checks; threads with no workspace keep the closed network. The rest of the draft stands: hidden folders out by default, instruction files cut at 50,000 characters with `@` imports not followed, no root removal, and Claude Code still run with `--setting-sources ""`.
Reason: Let a mission build OpenMission itself in its own repository, and match the specification's Missing folder behavior.
References: documentation/work-in-progress.md (Batch 4), documentation/capabilities/workspace-attachment/specifications.md, documentation/first-slice-design.md (Workspace row)
Validation: The user answered four questions on 2026-11-06.
Evidence: scope, "Agree as built (Recommended)"; hidden folders, "Add 'Show hidden' toggle"; missing folder, "Build Retry now (Recommended)"; sandbox, "Allow those hosts".

## CHG-0035 · 2026-11-06 · Autonomous threads, plain questions, and the native folder dialog

Type: Documentation
Event: Agreement
Scope: First slice, batch 4; Action approval; Workspace attachment
Summary: At the default level, now named **Sensitive actions only**, threads work autonomously. They ask only before a sensitive action, one that leaves the computer or cannot be undone: push, publish, deploy, send a message, submit a form, pay, delete outside the workspace or discard uncommitted work, change the system, or reach secrets. When Claude Code asks for permission, OpenMission decides. A prompt matching OpenMission's built-in list of sensitive commands becomes a question. Any other prompt runs without a question, sandboxed or not, and leaves a line in the thread. The thread flags any other sensitive action through `request_approval`. A question says in plain words what will happen and what it affects, for users who do not read code. Its buttons are Allow, Always allow, and Deny with an optional message. Discard is gone, and the command stays under Show details. On the desktop, Choose folder… opens the system's own folder dialog (Finder, Explorer). The in-app folder browser, the browsable roots, and Show hidden stay built and checked for phone browsing, but the desktop no longer shows them (owner: "keep that aside and not totally delete it"). This supersedes parts of CHG-0031 (risky-action list, harness prompts as questions, Discard, Deny with a message as a separate button) and CHG-0032 (local git as a special case, now ordinary).
Reason: The owner: users are either casual, and need explanations in natural language rather than prompts, or advanced, and want to be asked only for really sensitive operations; a thread that asks all the time cannot do anything by itself. A read-only command ("Show all source files") had raised a question. The native dialog is simpler than an in-app browser.
References: documentation/capabilities/action-approval/specifications.md, documentation/capabilities/workspace-attachment/specifications.md, documentation/work-in-progress.md (Batch 4)
Validation: The user answered four questions on 2026-11-06, after seeing a harness question for a read-only `for … cat` loop inside the workspace.
Evidence: "Maybe we should avoid asking too much permissions … The assistant needs to be autonomous in OpenMission, and if they ask permissions all the time, they can't really do anything by themselves."; "we could just open Finder or Explorer to browser the files in order to open a workspace"; autonomy, "Autonomous, ask sensitive (Recommended)"; judge, "Built-in list + thread (Recommended)"; wording, "Plain consequence + 3 buttons (Recommended)"; folder pick, "Native dialog, drop browser (Recommended)".

## CHG-0036 · 2026-11-06 · Batch 4 delivered: workspace attachment, first step, with autonomous threads

Type: Code
Event: Delivery
Scope: First slice, batch 4; Workspace attachment; Action approval

Summary: Missions start on a folder chosen with the system's dialog, and their thread works there with the folder's `AGENTS.md` and `CLAUDE.md`, the widened workspace sandbox, workspace-scoped standing permissions, and Retry when the folder goes missing (CHG-0034). Threads work autonomously and ask in plain words only before sensitive actions (CHG-0035). Fixed during the run-through: the conversation now keeps the newest entry in view unless the owner has scrolled up; Always allow saves the sensitive list's label ("Push code") for a command the list recognizes, rather than the thread's; the Permissions history shows each mission's title on one line.
References: documentation/work-in-progress.md (Batch 4); documentation/verification/2026-11-06-batch-4-drive.md; documentation/verification/2026-11-06-autonomous-threads.md; apps/app/src/conversation.tsx, permissions.tsx; packages/service/src/approvals.ts, mcp.ts
Validation: `OPENMISSION_LIVE_CLAUDE=1 bun run test` passes 74 of 74; typecheck, Biome, and the desktop build pass. An agent ran the owner's run-through in the Electron window at the owner's request, with Claude Code and Sonnet on a clone of this repository: the thread followed `AGENTS.md`, ran the checks, and committed without a question; a named push ran, an unnamed push asked in plain words; Always allow saved a workspace permission; Retry held and then delivered; a non-sensitive unsandboxed command left a "Ran" line. Not verified: operating the Finder dialog itself (no accessibility access for the agent), and the desktop notification.
Evidence: "I want you to directly use the app and try it. … continue building the app."

## CHG-0037 · 2026-11-06 · Batch 5 agreed: thread tree core

Type: Documentation
Event: Agreement
Scope: First slice, batch 5; Thread tree; Thread messaging
Summary: Threads open threads beneath themselves with `open_thread`, which copies the opener's model, effort, and workspace unless overridden; report their result to their parent with `report_result`, becoming Done; and message their parent and the threads directly beneath them with `send_thread_message`, delivered at the receiver's next turn. A thread whose turn ends while threads beneath it run is Waiting; a message wakes Waiting, Idle, and Done threads. Stop does not cascade; a Stopped thread keeps its messages, the tree shows "N messages waiting", and Resume continues it. At most 8 threads run at once in a mission. The owner can write to any thread and open a thread beneath any thread, down to 4 levels. The conversation screen gets a side tree of the mission's threads with their states; the selected thread's conversation shows on the right. Thread instructions also tell a thread to re-run a setup step outside the sandbox when it fails only on a protected Git file. Staged: folding agent-opened threads, deleting, off-topic routing, interrupts, steering mid-turn, the chatter guard, the journal and intel in starting context, and references across missions.
Reason: The first slice's boundary is a mission with threads beneath it that report results and can be stopped and continued; the run-through showed a fresh clone's commits skipping the pre-commit hook.
References: documentation/work-in-progress.md (Batch 5), documentation/capabilities/thread-tree/specifications.md, documentation/capabilities/thread-messaging/specifications.md, documentation/first-slice-design.md
Validation: The owner answered three questions on 2026-11-06.
Evidence: scope, "Tree core (Recommended)"; view, "Side tree + chat (Recommended)"; hooks, "Tell threads (Recommended)".

## CHG-0038 · 2026-11-06 · Batch 5 delivered: thread tree core

Type: Code
Event: Delivery
Scope: First slice, batch 5; Thread tree; Thread messaging

Summary: Threads open threads beneath themselves (`open_thread`, with an optional short title), report results to their parent and become Done (`report_result`), and message their parent and the threads directly beneath them (`send_thread_message`), delivered at the receiver's next turn (CHG-0037). Waiting, the running limit of 8, the owner's depth limit of 4, Stop without cascade with kept messages, and Resume are in place. The conversation screen shows the side tree of the mission's threads. Provisional until decided: Waiting threads become Idle on startup; the top thread's result only marks it Done; no mid-turn delivery; no phone layout for the tree.
References: documentation/work-in-progress.md (Batch 5); documentation/verification/2026-11-06-thread-tree.md; packages/service/src/tree.ts, waker.ts, threads.ts, mcp.ts, store.ts; apps/app/src/threadTree.tsx, conversation.tsx
Validation: `OPENMISSION_LIVE_CLAUDE=1 bun run test` passed 89 of 89; typecheck, Biome, and the desktop build passed; eight mutations each failed at least one check. The owner looked at the side tree in the desktop window and accepted it on 2026-11-06. Not verified: the Finder dialog itself and the desktop notification.
Evidence: The owner's answer "Accept" to the batch 5 acceptance question.

## CHG-0039 · 2026-11-06 · Batch 6 agreed: interrupts and steering

Type: Documentation
Event: Agreement
Scope: First slice, batch 6; Thread messaging

Summary: A message to a running thread, from the owner or from another thread, joins its current turn (steering) instead of waiting for the next one. While a thread runs, the composer's Send uses the owner's default (Steer unless changed in Settings) and a smaller second button does the other one, Queue or Steer, for that message. A queued message starts the thread's next turn. The owner can interrupt any running thread with an Interrupt button next to Send; a thread can interrupt a running thread directly beneath it with `interrupt_thread`, which takes the thread and refuses others with the reason. An interrupted thread's turn ends, its open questions are withdrawn, and it becomes Idle, or Waiting while threads beneath it are Running or Waiting; this amends the specification's "becomes Idle". Messages that had not yet reached the turn stay undelivered and start the next turn. Stop is unchanged. Mechanism, probed on Claude Code 2.1.302: a user message written to a running `-p` stream-json process joins the turn after the current tool call; `--replay-user-messages` echoes each message when the turn takes it in, so OpenMission knows which ones were delivered; a message that arrives after the turn's result starts a new turn in the same process; the `interrupt` control request ends the turn with `error_during_execution` and keeps the process usable.
Reason: Today a parent cannot redirect a busy child, and the owner can only wait or Stop.
References: documentation/capabilities/thread-messaging/specifications.md#delivery, documentation/capabilities/thread-messaging/specifications.md#interruptions, documentation/work-in-progress.md (Batch 6)
Validation: The owner chose batch 6 and answered three questions on 2026-11-06.
Evidence: batch, "Interrupts + steering (Recommended)"; composer, "Send + Queue button (Recommended)"; interrupt, "Composer button (Recommended)"; state, "Waiting (Recommended)".

## CHG-0040 · 2026-11-06 · Batch 6 delivered: interrupts and steering

Type: Code
Event: Delivery
Scope: First slice, batch 6; Thread messaging

Summary: Messages to a running thread join its current turn: thread messages and results always, the owner's when steered; Claude Code takes them in after the current tool call and echoes their identifier, which records them as delivered (CHG-0039). An owner message sent as Queue waits for the next turn and shows "Queued for the next turn". While a thread runs, the composer shows Interrupt, the other delivery, and Send, which follows the owner's default in Settings (Steer unless changed). The owner interrupts any running thread, and a thread interrupts a running thread directly beneath it with `interrupt_thread`; the turn ends, open questions are withdrawn, the thread becomes Done, Waiting, or Idle, and undelivered messages start its next turn. Provisional until decided: a message not taken in by a turn's end closes the Claude Code process and is sent again at the next turn; an unconfirmed interrupt closes the process after 10 seconds.
References: documentation/work-in-progress.md (Batch 6); documentation/verification/2026-11-06-steering.md; packages/service/src/claude.ts, execution.ts, threads.ts, mcp.ts, tree.ts, waker.ts, settings.ts, store.ts; apps/app/src/controls.tsx, conversation.tsx, settings.tsx
Validation: `OPENMISSION_LIVE_CLAUDE=1 bun run test` passed 107 of 107; typecheck, Biome, and the desktop build passed; eight mutations each failed at least one check. Driven in the window on the fake harness after Claude Code's session limit stopped the live drive. The owner accepted the composer on 2026-11-06. Not verified: a real Claude Code turn steered or interrupted in the window.
Evidence: The owner's answer "Accept, hand-off (skill), commit and push." to the batch 6 acceptance question.

## CHG-0041 · 2026-11-06 · Batch 7 agreed: folding, deleting, chatter guard

Type: Documentation
Event: Agreement
Scope: First slice, batch 7; Thread tree; Thread messaging

Summary: Three staged items of the thread tree and thread messaging. Folding: the setting **Show threads opened by agents** (on by default) in Settings; when off, threads an agent opened fold into the thread that opened them, which shows "+N threads" and unfolds on selection; a folded thread still appears when it enters Attention or Failed; folding changes only the view. Deleting: deleting a thread deletes every thread beneath it after one confirmation naming the count and the running ones ("Delete this thread and 5 threads beneath it (2 running)?"); running threads among them are stopped first and their open questions withdrawn; deleting a mission's top thread deletes the mission. Deletion is permanent: threads, turns, messages, and questions are erased from the database; a deleted mission also loses its scratch folder and its mission-scoped standing permissions; a workspace folder is never touched. Chatter guard: when two threads exchange 20 messages with no message from the owner to either of them and no result between them, both enter Attention, and their further messages to each other are kept undelivered; a message from the owner to either thread, or a result reported between them, resets the pair's count. In Attention the owner chooses **Let them continue** (resets the count and delivers the kept messages) or **Stop both** (both become Stopped, messages kept). The threshold is adjustable in Settings, default 20.
Reason: Agent-opened threads crowd the tree, threads cannot be removed, and two threads can talk to each other without end.
References: documentation/capabilities/thread-tree/specifications.md#threads-opened-by-agents, documentation/capabilities/thread-tree/specifications.md#deleting, documentation/capabilities/thread-messaging/specifications.md#chatter-guard, documentation/work-in-progress.md (Batch 7)
Validation: The owner chose batch 7 and answered three questions on 2026-11-06. The journal in a new thread's starting context (needs mission-journal) and `@` references (need mission-coordination's reference resolver) stay staged.
Evidence: scope, "Pliage+suppr.+chatter (Recommandé)"; chatter, "Continuer / Arrêter (Recommandé)"; deletion, "Effacement définitif (Recommandé)".

## CHG-0042 · 2026-11-06 · Batch 7 delivered: folding, deleting, chatter guard

Type: Code
Event: Delivery
Scope: First slice, batch 7; Thread tree; Thread messaging

Summary: Folding, deleting, and the chatter guard as agreed in CHG-0041. With **Show threads opened by agents** off, agent-opened threads fold into their opener, which shows "+N threads" and unfolds on selection; Attention and Failed threads stay visible. Deleting a thread deletes its subtree after one confirmation naming the count and the running ones, stopping running threads first; deleting the top thread deletes the mission with its scratch folder and mission-scoped standing permissions, never a workspace folder. Two threads that exchange the threshold's number of messages (default 20) without the owner or a result between them both enter Attention; further messages between them are kept; **Let them continue** resets the count and delivers them, **Stop both** stops both. The owner kept the pause ending both threads' running turns. Codex's implementation choices beyond the agreement are listed in the proof.
References: documentation/work-in-progress.md (Batch 7); documentation/verification/2026-11-06-batch-7.md; packages/service/src/chatter.ts, deleting.ts, lifecycle.ts, scratch.ts, store.ts, threads.ts; apps/app/src/labels.ts
Validation: `bun run test` passed 122 with 5 skipped; typecheck, `bun run check`, and the desktop build passed; 11 of 11 mutations caught. Driven in the window on the fake harness. The owner accepted the look on 2026-11-06; the interface gets a later pass, including shortening titles in notices by available width (backlog, Interface pass).
Evidence: The owner's answers: look, "Yes, it is okay. And the UI part will be taking care later."; chatter pause, "Keep ending turns"; notice titles, "It doesn't matter much for now, but shorten it depending of the UI size."

## CHG-0043 · 2026-11-06 · Batch 8 agreed: mission journal

Type: Documentation
Event: Agreement
Scope: First slice, batch 8; Mission journal; Thread tree

Summary: Each mission gets a journal: a briefing with a version, limited to 2,000 tokens (about 4 characters per token, adjustable in Settings), and a change log only ever added to, each entry with its author (a thread or the owner) and time. Threads use `read_journal` (the briefing, its version, and entries from a starting point) and `update_journal` (an entry, optionally a new briefing and the version it was based on); a rewrite over the limit is refused with its reason, and one based on an older version is refused with the current briefing and version. Every briefing rewrite comes with an entry. `report_result` takes a required `journal` argument: an entry, or exactly "nothing to record"; the entry is recorded with the result. Every thread's starting context carries the briefing and the 20 latest entries, and a thread opened beneath another also carries its opener's messages since the journal's latest entry. The owner reads the journal in a Journal view opened from the mission header, rewrites the briefing, and adds entries; each change is recorded as an entry by the owner.
Reason: Threads start without each other's history and lose track of where the mission stands.
References: documentation/capabilities/mission-journal/specifications.md; documentation/capabilities/thread-tree/specifications.md#opening-a-thread; documentation/work-in-progress.md (Batch 8)
Validation: The owner chose batch 8 and answered three questions on 2026-11-06. Staged: asides (not built), `find_missions` and the entries written when a mission ends (mission-tracking), summarizing a starting context that exceeds the model's window, and the human acceptance with two harnesses (only Claude Code exists).
Evidence: batch, "Mission journal (Recommended)"; implementer, "Here, test-first"; scope, "Also opener's messages"; result entry, "Required field (Recommended)"; interface, "Journal view (Recommended)".

## CHG-0044 · 2026-11-06 · Batch 8 delivered: mission journal

Type: Code
Event: Delivery
Scope: First slice, batch 8; Mission journal; Thread tree

Summary: The mission journal as agreed in CHG-0043. Each mission has a versioned briefing, limited by the Settings value **Briefing limit** (2,000 tokens by default, about 4 characters per token), and a change log whose entries record their author and time and which the database refuses to edit or delete. Threads use `read_journal` and `update_journal`; a rewrite over the limit, or based on an older version, is refused with the current briefing. `report_result` requires `journal`: an entry, or "nothing to record". Every turn's context carries the briefing and the 20 latest entries; a thread opened beneath another also carries its opener's messages since the latest entry, at most 40 (provisional). The owner reads and edits the journal in the Journal view opened from the mission header. Deleting a mission erases its journal; a deleted thread's entries keep its saved title.
References: documentation/work-in-progress.md (Batch 8); documentation/verification/2026-11-06-journal.md; packages/service/src/journal.ts, journalTools.ts, mcp.ts, tree.ts, threads.ts, store.ts, deleting.ts, service.ts; apps/app/src/journal.tsx, conversation.tsx, settings.tsx, labels.ts
Validation: `bun run test` passed 140 with 5 skipped, and 145 of 145 with `OPENMISSION_LIVE_CLAUDE=1`; typecheck, `bun run check`, and the desktop build passed; 12 of 12 mutations caught. Driven in the window with Claude Code (Haiku): a thread opened after the owner's briefing rewrite answered from the journal alone. The owner accepted the look on 2026-11-06. Staged: asides, `find_missions`, mission-ending entries, summarizing a long starting context, and the two-harness acceptance.
Evidence: The owner's answer "Yes." to the batch 8 acceptance question.

## CHG-0045 · 2026-11-06 · Batch 9 agreed: mission tracking

Type: Documentation
Event: Agreement
Scope: First slice, batch 9; Mission tracking; Mission journal

Summary: Batch 9 builds the mission-tracking specification except spending's budget rings, the phone web app, and `find_missions`. A mission's state is the most urgent among its threads, or Done or Archived once it ends. When the top thread reports its result, the dashboard asks "Mark as done?". The owner marks a mission Done or archives it from the mission header or a dashboard question. When threads are still at work, one confirmation names how many ("2 threads are still running. Stop them and mark as done?") and then stops them. After 14 days without activity, the dashboard asks "Archive it or mark it as done?". Dismissing that question brings it back after another 14 days. An auto-archive setting, off by default, archives a Done mission 30 days after it was marked Done. Both durations are adjustable in Settings. Archived missions leave the list for an Archived view, which offers Reopen. Reopening, or the owner writing in a thread of an ended mission, returns the mission to the state worked out from its threads. Each ending and each reopening adds a journal entry ("Marked done by the user", "Archived by the user", "Archived automatically", "Reopened by the user"). The top thread names the mission with `set_mission_title`, which is refused once the owner has renamed the mission from its header. A new mission's model, effort, and workspace are prefilled from the last mission started. The dashboard lists missions in Attention or Failed first and the others by latest activity. Each row shows its thread count and how many threads are running. The dashboard filters by state and workspace and searches titles and briefings.
Reason: Missions cannot be ended, named, or found again once there are many.
References: documentation/capabilities/mission-tracking/specifications.md; documentation/capabilities/mission-journal/specifications.md#when-a-mission-ends; documentation/work-in-progress.md (Batch 9)
Validation: The owner chose the scope and answered two questions on 2026-11-06. Staged: budget rings (budget-control), the phone web app, and `find_missions` (thread-tree, Off-topic requests).
Evidence: batch, "Mission tracking (Recommended)"; scope, "All of it"; reopen, "From its threads (Recommended)"; actions, "Header + dashboard (Recommended)".

## CHG-0046 · 2026-11-06 · Batch 9 delivered: mission tracking

Type: Code
Event: Delivery
Scope: First slice, batch 9; Mission tracking; Mission journal

Summary: Mission tracking as agreed in CHG-0045, with the provisional choices listed in work-in-progress (Batch 9) kept: the most urgent thread state, Mark as done?, ending and reopening with their journal entries, the inactivity question, auto-archive, the Archived view, `set_mission_title` and the rename, prefilled choices, and the dashboard order, filters, and search.
References: documentation/work-in-progress.md (Batch 9); documentation/verification/2026-11-06-mission-tracking.md; commits 8e05eb0 and 083003f
Validation: `bun run test` passed 175 with 5 skipped; typecheck, `bun run check`, and the desktop build passed; 15 of 15 mutations caught. Driven in the window on the fake harness. The owner accepted the batch on 2026-11-06 and deferred the visual polish to the interface pass.
Evidence: The owner's answer "I want to progress fast and adjust when we have a MVP. So, I accept the batches."

## CHG-0047 · 2026-11-06 · Batches 10 and 11 agreed and delivered: off-topic requests, budget control

Type: Code
Event: Delivery
Scope: First slice, batches 10 and 11; Thread tree; Budget control

Summary: Off-topic requests (thread-tree, Off-topic requests) and budget control (budget-control specifications, without Control's budget or the phone) as built and listed in work-in-progress (Batches 10 and 11). The owner agreed both batches as built, with every provisional choice listed there, and will adjust them after the MVP: word-overlap matching; the suggestion only in its thread; an aside with the whole journal context; Claude Code counted as subscription spending in tokens, cache reads included; spending counted at a turn's end; the split by thread only; no global budget lines; meters as bars.
References: documentation/work-in-progress.md (Batches 10 and 11); documentation/verification/2026-11-06-off-topic.md; documentation/verification/2026-11-06-budgets.md; commit 083003f
Validation: `bun run test` passed 200 with 5 skipped; typecheck, `bun run check`, and the desktop build passed; 13 of 13 and 16 of 16 mutations caught. Driven in the window on the fake harness. Not verified: a live Claude Code thread calling `find_missions` and `suggest_mission`, and a live Claude Code turn reaching a token budget. The owner accepted both batches on 2026-11-06.
Evidence: The owner's answer "I want to progress fast and adjust when we have a MVP. So, I accept the batches."

## CHG-0048 · 2026-11-06 · Review fixes and thread lifecycle architecture

Type: Code
Event: Delivery
Scope: First slice; Budget control; Thread tree; Mission tracking

Summary: Fixes the eight findings of the review of batches 9–11, test-first, and restructures the local service, with no other change of agreed behavior. Behavior: every Stop returns a parent left Waiting to Idle; deleting threads or a mission keeps their spending; held threads are released when the global period starts over; the budget line is given with each turn's message; the no-ask off-topic setting matches on the service side; a thread not at work is told its suggestion was not asked; an ended mission is not marked done again; a budget hold leaves another reason in place, and a message to a Failed thread under a reached budget waits and runs once the budget is raised. Structure: one thread lifecycle module writes every thread state; one module waits on the owner inside a turn; the thread inbox owns messages; one catalogue defines each thread tool, answered by its handlers apart from the MCP transport; endpoints replace the Waker; the service tells the app which thread actions apply; the dashboard listing and the mission view leave `missions.ts`; contracts are split by kind. Provisional choices are listed in work-in-progress.
References: documentation/work-in-progress.md (Review, fixes, and architecture after batch 11); documentation/verification/2026-11-06-review-fixes.md; documentation/architecture-audit/architecture-audit-2026-11-06-1959.html; documentation/architecture.md (Inside the local service)
Validation: `bun run test` passed 216 with 5 skipped; typecheck, `bun run check`, the desktop build, and a Metro web export passed; each test file passes alone and the service has no module-load cycle; 10 of 10 mutations caught; the standards and specifications reviewers re-checked the result. Not verified live with Claude Code.
Evidence: The owner's request "Fix everything." after the review report.

## CHG-0049 · 2026-11-06 · Batch 12 built: scoped intel

Type: Code
Event: Delivery
Scope: First slice, batch 12; Scoped intel

Summary: Scoped intel as built and listed in work-in-progress (Batch 12): intel at thread, mission, workspace, or global scope; `save_intel`, `search_intel`, `update_intel`, and `forget_intel`; global saves, changes, and deletions and every widening wait for the owner's approval in the thread and the intel panel; every turn's context carries the intel in scope, most specific first; a 200-token limit per intel; the intel icon with its warning setting; the intel panel with filters, Edit, and Delete. Tidy up intel and the starting-context warning are staged. Chosen by an agent under the owner's instruction to build what is next without questions; not yet agreed or accepted by the owner.
References: documentation/capabilities/scoped-intel/specifications.md; documentation/work-in-progress.md (Batch 12); documentation/verification/2026-11-06-scoped-intel.md
Validation: `bun run test` passed 237 with 5 skipped; typecheck, `bun run check`, the desktop build, and a Metro web export passed; 12 of 12 mutations caught. Driven in the window on the fake harness. Not verified: a live Claude Code thread using the intel tools; a model with a larger context window.
Evidence: The owner's instruction of 2026-11-06: "For now, we build, step by step and we verify it works. The look and feel will be adjusted later. Don't ask any question for this session, build what is next."

## CHG-0050 · 2026-11-06 · Intel over time specified; inspirations listed

Type: Documentation
Event: Agreement
Scope: Scoped intel; Glossary; Backlog; Inspirations

Summary: Scoped intel gains rules for intel over time, after reading Rerun, souls.house's hearth guide, and Timon:
- intel kinds (rule, preference, decision, fact, temporary) with half-lives, and pinning;
- global intel in context as an index, read in full through `search_intel`, new lines added at the end;
- fading by real use only, dormant and archived intel, never deleted by fading;
- honest skips, recorded origin, and duplicates saved as replacements, global ones approved;
- widening and narrowing proposed from evidence; history with undo; ranked search;
- Tidy up intel as an optional routine that only prepares a proposal.
Adds `documentation/inspirations.md`, listing the products OpenMission follows, their good ideas, what was taken, and what to check on. Capsules and journal compression go to the backlog. The half-lives are starting values, adjustable in settings.
Reason: Global intel grows across every workspace; carrying all of it in every turn does not scale.
References: documentation/capabilities/scoped-intel/specifications.md; documentation/inspirations.md; documentation/glossary.md (Intel); documentation/backlog.md
Validation: Requested by the owner on 2026-11-06. Not built; batch 12 still carries every intel in full.
Evidence: The owner's request "Yes, you can update the documentation to have better memory management. Also, would be nice to mention tools we are following and getting inspired by, in order to take the good ideas and see what interesting feature they already have or will release in the future."

## CHG-0051 · 2026-11-06 · Batch 13 built: intel over time

Type: Code
Event: Delivery
Scope: First slice, batch 13; Scoped intel

Summary: Part of the intel-over-time rules agreed in CHG-0050, as built and listed in work-in-progress (Batch 13):
- `save_intel` takes a kind (rule, preference, decision, fact, temporary); half-lives in Settings, a rule never fades; the owner pins intel;
- strength falls by half over the kind's half-life since the last use, slower with uses; dormant below 0.15, archived below 0.05, worked out when read;
- each turn's context carries active scoped intel in full, active global intel as an index added to at its end, and the count of dormant intels;
- `search_intel` searches active and dormant intel by words or identifiers, ranks the closest match and rare words first, and counts each intel returned as a use;
- the intel panel shows kind, state, strength, and uses, filters by state, and offers Pin, Unpin, and Restore.
Replacing duplicates, origin references, evidence-based widening and narrowing, history with undo, and Tidy up stay staged. Chosen by an agent under the owner's instruction to build what is next without questions; not yet agreed or accepted by the owner.
References: documentation/capabilities/scoped-intel/specifications.md; documentation/work-in-progress.md (Batch 13); documentation/verification/2026-11-06-intel-over-time.md; packages/service/src/intelFading.ts, intel.ts, intelViews.ts, intelChanges.ts, threadTools.ts, store.ts (migration 0017); apps/app/src/intel.tsx, settings.tsx
Validation: `bun run test` passed 253 with 5 skipped; typecheck, `bun run check`, the desktop build, and a Metro web export passed. 20 of 20 mutations were caught in a separate worktree, the new checks fail on the starting commit, and a migration check passed. The batch was driven in the window on the fake harness, with days simulated in the database. A fresh-context agent reproduced the whole proof. The look awaits the owner. Not verified: a live Claude Code thread using kinds, the index, and search.
Evidence: The owner's instruction of 2026-11-06, repeated for this session: "For now, we build, step by step and we verify it works. The look and feel will be adjusted later. Don't ask any question for this session, build what is next."

## CHG-0052 · 2026-11-07 · Batch 14 built: replacing duplicates, origins, relying on intel

Type: Code
Event: Delivery
Scope: First slice, batch 14; Scoped intel

Summary: Part of the intel-over-time rules agreed in CHG-0050, as built and listed in work-in-progress (Batch 14):
- a save close to an intel in the same scope replaces it, which keeps its identifier and uses; a global replacement waits for approval with the old and new text; an unclear match is saved new and its answer names the close intels;
- each intel records its origin: the journal entry named with `journalEntry`, or the latest message delivered to the thread; the panel shows it;
- `relied_on_intel` counts a use of each intel a thread says it relied on.
Provisional choices are listed in work-in-progress (Batch 14), among them replacing only within the same scope, so a narrower intel stays an override of a wider one. History with undo, evidence-based widening and narrowing, and Tidy up stay staged. Chosen by an agent under the owner's instruction to build what is next without questions; not yet agreed or accepted by the owner.
References: documentation/capabilities/scoped-intel/specifications.md; documentation/work-in-progress.md (Batch 14); documentation/verification/2026-11-07-replacing-intel.md; packages/service/src/intelDuplicates.ts, intelOrigins.ts, intelChanges.ts, intelViews.ts, intelTools.ts, intel.ts, threadTools.ts, store.ts (migration 0018); packages/contracts/src/intel.ts; apps/app/src/intel.tsx, labels.ts
Validation: `bun run test` passed 267 with 5 skipped; typecheck, `bun run check`, `git diff --check`, the desktop build, and a Metro web export passed. 20 of 20 mutations were caught in a separate copy, the new checks fail on the starting commit, and a two-step migration check passed. The batch was driven in the window on the fake harness. The look awaits the owner. Not verified: a live Claude Code thread using replacements, `journalEntry`, and `relied_on_intel`.
Evidence: The owner's instruction of 2026-11-07: "For now, we build, step by step and we verify it works. The look and feel will be adjusted later. Don't ask any question for this session, build what is next. I'll be AFK."

## CHG-0053 · 2026-11-07 · Batch 15 built: intel history with undo

Type: Code
Event: Delivery
Scope: First slice, batch 15; Scoped intel

Summary: Part of the intel-over-time rules agreed in CHG-0050, as built and listed in work-in-progress (Batch 15):
- every intel keeps a history, newest first: a thread's save, replacement (with the text it replaced), correction, widening, and deletion, with the owner's approval when one was needed; the owner's edit, deletion, pin, unpin, and restore; each with who made it and when;
- fading steps (dormant, archived) are worked out from strength and stored when something resets fading, so they stay after a use or a restore;
- the owner undoes any change but a fading step from the panel's History: what the change changed is put back as a new, undoable entry; undoing a save deletes the intel, undoing a deletion restores it with its identifier, uses, and origin;
- the panel's state filter gains Deleted, with Undo deletion;
- migration 0019 starts each existing intel's history with its save.
Provisional choices are listed in work-in-progress (Batch 15). Evidence-based widening and narrowing, and Tidy up, stay staged. Chosen by an agent under the owner's instruction to build what is next without questions; not yet agreed or accepted by the owner.
References: documentation/capabilities/scoped-intel/specifications.md (History and undo); documentation/work-in-progress.md (Batch 15); documentation/verification/2026-11-07-intel-history.md; packages/service/src/intelHistory.ts, intelHistoryViews.ts, intelUndo.ts, intelChanges.ts, intelFading.ts, intelViews.ts, deleting.ts, service.ts, store.ts (migration 0019); packages/contracts/src/intel.ts, requests.ts, ids.ts; apps/app/src/intel.tsx, intelHistory.tsx, labels.ts
Validation: `bun run test` passed 285 with 5 skipped; typecheck, `bun run check`, `git diff --check`, the desktop build, and a Metro web export passed. 22 of 22 mutations were caught in a separate copy, the new checks failed before the implementation, and a two-step migration check passed. The batch was driven in the window on the fake harness, with days simulated in the database. The look awaits the owner. Not verified: a live Claude Code thread whose intel changes appear in the history.
Evidence: The owner's instruction of 2026-11-07: "For now, we build, step by step and we verify it works. The look and feel will be adjusted later. Don't ask any question for this session, build what is next. I'll be AFK."

## CHG-0054 · 2026-11-07 · Batch 16 built: widening and narrowing proposed from evidence

Type: Code
Event: Delivery
Scope: First slice, batch 16; Scoped intel

Summary: Part of the intel-over-time rules agreed in CHG-0050, as built and listed in work-in-progress (Batch 16):
- each use of an intel is recorded with the using thread's workspace;
- the intel panel proposes one global intel when the same workspace intel is saved in two or more workspaces, and moving a global intel to a workspace when every use over its kind's half-life came from that workspace;
- a proposal changes nothing until the owner approves it; a declined one does not come back; an approved one widens (merging the others, their uses carried over) or narrows, in the history as the owner's and undoable;
- migration 0020 adds the uses and the decisions; proposals are worked out from evidence when read.
Provisional choices are listed in work-in-progress (Batch 16). Tidy up stays staged. Chosen by an agent under the owner's instruction to build what is next without questions; not yet agreed or accepted by the owner.
References: documentation/capabilities/scoped-intel/specifications.md (Widening and narrowing); documentation/work-in-progress.md (Batch 16); documentation/verification/2026-11-07-intel-proposals.md; packages/service/src/intelProposals.ts, intelViews.ts, intelDuplicates.ts, intelFading.ts, intel.ts, service.ts, store.ts (migration 0020); packages/contracts/src/intel.ts, requests.ts, ids.ts; apps/app/src/intel.tsx, labels.ts
Validation: `bun run test` passed 302 with 5 skipped; typecheck, `bun run check`, `git diff --check`, the desktop build, and a Metro web export passed. 17 of 17 mutations were caught in a separate copy, the new checks fail 15 of 15 on the starting commit, and a two-step migration check passed. The batch was driven in the window on the fake harness, with days simulated in the database. The look awaits the owner. Not verified: a live Claude Code thread whose uses become evidence.
Evidence: The owner's instruction of 2026-11-07: "For now, we build, step by step and we verify it works. The look and feel will be adjusted later. Don't ask any question for this session, build what is next. I'll be AFK."

## CHG-0055 · 2026-11-07 · Batch 17 built: the warning before a thread starts with too large a starting context

Type: Code
Event: Delivery
Scope: First slice, batch 17; Thread tree

Summary: The rule agreed in CHG-0007 for thread-tree (Opening a thread), as built and listed in work-in-progress (Batch 17):
- while the owner types the first message of a thread opened beneath another, the form measures its starting context: the request, the briefing and latest entries, the intel in scope, and the opener's messages since the latest entry;
- past 25% of the chosen model's context window it warns with the size, the share, each part, and the choices: a model with a larger window (none today: every model counts 200,000 tokens), Trim intel (the intel panel inside the form, the request kept), or Start anyway;
- the service refuses to start such a thread unless the owner chose Start anyway; agent-opened threads are not warned.
Provisional choices are listed in work-in-progress (Batch 17). Summarizing a starting context over the window, and the warning when starting a mission, stay staged. Chosen by an agent under the owner's instruction to build what is next without questions; not yet agreed or accepted by the owner.
References: documentation/capabilities/thread-tree/specifications.md (Opening a thread); documentation/work-in-progress.md (Batch 17); documentation/verification/2026-11-07-starting-context.md; packages/service/src/startingContext.ts, tree.ts, intel.ts, service.ts; packages/contracts/src/records.ts, requests.ts; apps/app/src/threadTree.tsx, controls.tsx, labels.ts, styles.ts
Validation: `bun run test` passed 311 with 5 skipped; typecheck, `bun run check`, `git diff --check`, the desktop build, and a Metro web export passed. 13 of 13 mutations were caught in a separate copy; the new checks fail 8 of 9 on the batch 16 state (the ninth guards that a small thread still opens). Driven in the window on the fake harness. The look awaits the owner. Not verified: a live Claude Code thread.
Evidence: The owner's instruction of 2026-11-07: "For now, we build, step by step and we verify it works. The look and feel will be adjusted later. Don't ask any question for this session, build what is next. I'll be AFK."

## CHG-0056 · 2026-11-07 · First interface pass, after the look of OpenBot

Type: Code
Event: Delivery
Scope: App interface

Summary: The look the owner deferred to an interface pass, close to OpenBot's light theme:
- a sidebar on a grey frame (New mission, Missions, Intel, Archived, the missions not archived with their state, Settings) beside a raised white panel; narrow windows keep the screens' own links;
- one palette in `apps/app/src/theme.ts`: neutral greys, a blue accent, soft tinted state pills;
- the composer as one rounded box with Send inside, and the mission's model and effort as compact pickers in it;
- mission rows with a muted meta line; the owner's messages as unlabelled grey bubbles, agent replies as plain text; accent switches; borderless button rows.
No behavior changed. Chosen by an agent under the owner's instruction, without questions; not yet accepted by the owner.
References: documentation/verification/2026-11-07-interface-pass.md; documentation/inspirations.md (OpenBot); apps/app/App.tsx; apps/app/src/theme.ts, sidebar.tsx, styles.ts, controls.tsx, dashboard.tsx, conversation.tsx, conversationEntries.tsx, settings.tsx, intel.tsx, budgets.tsx, formatting.ts, workspaces.tsx, missionActions.tsx, threadActions.tsx, threadTree.tsx, journal.tsx
Validation: `bun run test` passed 311 with 5 skipped; typecheck, `bun run check`, `git diff --check`, and a Metro web export passed. Driven in the window on the fake harness, with before and after screenshots. The look awaits the owner.
Evidence: The owner's instruction of 2026-11-07: "Let's work a bit on the UI. Look at how OpenBot looks like and try to get something close to that if possible. I'll be AFK so don't ask any question for now."

## CHG-0057 · 2026-11-07 · Prompt audit: a steady system prompt, fuller tool descriptions, current agent instructions

Type: Code
Event: Delivery
Scope: Thread context, thread tools, agent instructions

Summary: Changes from a prompt audit against the current Claude models (`/claude-api prompt-audit`):
- a thread's system prompt now holds only what stays the same across turns: its working folder, its place in the tree, and how to use the journal, intel, and approvals. The journal's briefing and latest entries, the intel in scope, and the budget line come with each turn's message, ahead of a `---` line. Until now, a new journal entry or intel changed the system prompt, so Claude Code restarted and resumed under a different prompt. That cost the prompt cache and, on Claude Fable 5.1, Opus 5.5, and Sonnet 5.5, the earlier thinking;
- the budget line ends with what happens at a limit (the work stops and the owner is asked) instead of "prefer cheaper work";
- tool descriptions: `send_thread_message.text`, `open_thread.model`, and `open_thread.effort` are described; `save_intel` names the temporary kind;
- `apps/app/AGENTS.md` describes the app as a web build in the desktop window first (ADR 0009) and lints with Biome (`bun run check`), not `expo lint`; `.agents/ai-tooling.md` gives `claudeHarnessLayer`'s current line.
Chosen by an agent at the owner's request to apply the audit's changes; not yet accepted by the owner.
References: documentation/verification/2026-11-07-prompt-audit.md; packages/service/src/threads.ts, journal.ts, intel.ts, claude.ts, spending.ts, threadTools.ts; packages/service/test/claude.test.ts, budget.test.ts, threadTools.test.ts, fixtures/stand-in-claude.mjs; apps/app/AGENTS.md; .agents/ai-tooling.md
Validation: `bun run test` passed 314 with 5 skipped; typecheck, `bun run check`, `git diff --check`, and the desktop build passed. The new checks fail on `ab85b66`, and a fresh agent reproduced the proof. Not verified: a live Claude Code thread's cache reads across a journal change.
Evidence: The owner's instruction of 2026-11-07: "Apply all the changes you feel relevant. Then /hand-off, commit and push (on main) once done."

## CHG-0058 · 2026-11-07 · Cost audit: titles leave the system prompt

Type: Code
Event: Delivery
Scope: Thread context

Summary: A change from a cost audit of the Claude Code harness (`/claude-api cost-optimize`):
- a thread's system prompt now names the thread and its opener by id only. Their titles come with each turn's message, as its first line ("Your title: …"). Until now, every mission's top thread renamed itself on its first turn (`set_mission_title`), so its second turn restarted Claude Code under a different system prompt: the whole prefix was written to the cache again instead of being read from it, and on Claude Fable 5.1, Opus 5.5, and Sonnet 5.5 the first turn's thinking was lost. An owner's rename did the same to the top thread, and to the threads opened beneath it.
Left for the owner, in the backlog: sending a turn's journal and intel in full only when they changed (changes scoped-intel's recall rule), and recording Claude Code's reported cost on API-key turns (detecting API-key billing is staged). No effort or model change: there is no eval of thread quality.
Chosen by an agent at the owner's request to apply the audit's changes; not yet accepted by the owner.
References: documentation/verification/2026-11-07-cost-audit.md; packages/service/src/instructions.ts, threads.ts; packages/service/test/claude.test.ts
Validation: `bun run test` passed 315 with 5 skipped; typecheck, `bun run check`, and `git diff --check` passed. The new check fails on `f9de337`. Not verified: a live Claude Code thread's cache reads on a mission's second turn.
Evidence: The owner's instruction of 2026-11-07: "Apply all the changes you feel relevant. Document them, then /hand-off, commit and push (on main) once done."

## CHG-0059 · 2026-11-07 · Batch 18 built: harnesses and provider accounts

Type: Code
Event: Delivery
Scope: First slice, batch 18; new capability provider-accounts; Thread tree; Action approval

Summary: OpenMission runs threads on Claude Code, Codex, or OpenCode, each with several provider accounts:
- every thread records its harness and account; the mission start, the open-thread form, and Open as new mission choose harness, account, model, and effort; `open_thread` takes a `harness`; a thread on another harness than its opener's takes that harness's own sign-in and default model;
- Codex runs through `codex app-server` and OpenCode through `opencode acp`, each one process per thread, with OpenMission's thread tools, starting context, approvals answered through `answer_prompt`, usage, interrupts, and (Codex) steering; native subagents are off;
- Settings lists each harness's version, the computer's own sign-in, and added accounts, each with its own folder (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_DATA_HOME`); Sign in opens the harness's own login in Terminal; Remove waits until missions on the account end;
- models are the harness's own identifiers: Claude Code's aliases, Codex's app server list, `opencode models`.
Built by an agent under the owner's instruction, without questions; provisional choices are in work-in-progress (Batch 18). Not yet agreed or accepted by the owner.
References: documentation/capabilities/provider-accounts/specifications.md; documentation/architecture-decision-record/0011-accounts-as-harness-folders.md; documentation/verification/2026-11-07-harnesses-and-accounts.md; packages/service/src/codex.ts, opencode.ts, rpcProcess.ts, harnessTools.ts, accounts.ts, runners.ts, harnessCatalog.ts, execution.ts, claude.ts, threads.ts, tree.ts, missions.ts, store.ts (0021), main.ts; packages/contracts/src/harnesses.ts, records.ts, requests.ts; apps/app/src/runners.tsx, accounts.tsx, settings.tsx, dashboard.tsx, threadTree.tsx, suggestions.tsx, conversation.tsx, controls.tsx
Validation: `bun run test` passed 332 with 8 skipped; typecheck, `bun run check`, `git diff --check`, the desktop build, and a Metro web export passed. 12 of 12 mutations were caught in a separate copy; the new checks cannot load on `ab85b66`. The opt-in live checks (`OPENMISSION_LIVE_HARNESSES=1`) passed against the installed Codex and OpenCode. Driven in the window with the real harnesses: a Codex mission, an OpenCode thread beneath it, a Claude Code mission, and adding and removing an account. Not verified: signing in an added account, live Codex escalation and steering, live OpenCode permission prompts.
Evidence: The owner's instruction of 2026-11-07: "I'd like OpenMission to be able to be used to build OpenMission. I want to be able to use different providers in it, using my Claude subscription (and even register more than one accound like OpenBot does). I want to be able to use Codex ad well and OpenCode. Focuse on that first. I'll be AFK, don't ask any question."

## CHG-0060 · 2026-11-07 · The app's logo

Type: Code
Event: Delivery
Scope: App and desktop shell

Summary: The owner's logo (a white arrow on a blue-to-violet arc with an orange trail, on deep navy) replaces Expo's placeholder icons and the sidebar's glyph: `apps/app/assets` icon, splash, favicon, Android adaptive foreground and background (`#01081C`), a 128-pixel `logo.png` in the sidebar, and `apps/desktop/assets/icon.png` with rounded corners as the window and macOS dock icon. Cropped from the owner's image to its square, on its own background colour; Android's monochrome icon reference was dropped, since Expo's placeholder was the only one.
References: apps/app/app.json; apps/app/assets/; apps/app/src/sidebar.tsx; apps/desktop/assets/icon.png; apps/desktop/src/main.ts; documentation/verification/2026-11-07-logo/sidebar.png
Validation: `bun run typecheck`, `bun run check`, the desktop build, and a Metro web export passed; the sidebar was seen in the window ([sidebar](verification/2026-11-07-logo/sidebar.png)). Not verified: the dock icon (screen capture unavailable), a native Android or iOS build.
Evidence: The owner's instruction of 2026-11-07: "Use this logo for the app." with the image `43855.png`.

## CHG-0061 · 2026-11-07 · Renamed to Canopy

Type: Code and documentation
Event: Delivery
Scope: Whole product

Summary: OpenMission is now Canopy. The domain terms stay as they are (mission, thread, Control, journal, briefing, dashboard, intel); Canopy reads as the view from above, a cockpit's canopy, not as tree vocabulary.
- The app, window, sidebar, Expo `name` and `slug`, packages (`canopy`, `@canopy/contracts`, `@canopy/service`), environment variables (`CANOPY_*`), the desktop bridge (`window.canopy`, `canopy:*` channels), service keys, temporary folder prefixes, the database file (`canopy.sqlite`), and the thread tools' MCP server name (`mcp__canopy__…`) carry the new name.
- On first launch without `CANOPY_DATA_DIR`, the desktop app moves the former `OpenMission` user-data folder to `Canopy` when only the former exists, renames the database with its write-ahead files, and renames Claude Code's session folders for scratch folders (the computer's sign-in and each added account), so threads with no workspace still resume.
- Living documents use the new name; dated records (handoffs, verification, earlier changelog records, architecture decisions, audits) keep the name they were written with, so their `OPENMISSION_*` commands need the new names when rerun.
References: apps/desktop/src/formerData.ts, main.ts, preload.ts; apps/desktop/test/formerData.test.ts; vitest.config.ts; apps/app/app.json; package.json files; bun.lock; README.md; AGENTS.md; documentation/
Validation: `bun run test` passed 335 with 8 skipped; typecheck, `bun run check`, and the desktop build passed. The owner's data on this computer was moved with `moveFormerData`: 5 threads, integrity check ok, 4 Claude Code session folders renamed; the built service started on it. Not verified: the app driven in the window after the rename.
Evidence: The owner's instruction of 2026-11-07: "Operate the rebranding overall in Canopy." Intel is kept for now ("Let's keep Intel for now."); former data migrated; dated records left as written.

## CHG-0062 · 2026-11-07 · Architecture pass: review refactors and the six audit candidates

Type: Code
Event: Delivery
Scope: Local service (harnesses, approvals, intel, starting context, commands); app labels; contracts

Summary: the review of the whole project and all six candidates of the 2026-11-07 architecture audit, applied at the owner's request:
- **Review refactors**:
  - doc comments on every export;
  - keyed objects and if-chains instead of nested ternaries;
  - one interrupted-turn outcome and grace constant;
  - unused exports dropped;
  - test names as activities;
  - the shared test fixture renamed `fixtures/service.ts`.
- **Harness processes** (`harnessProcesses.ts`, `lineProcess.ts`):
  - one module owns each thread's harness process for Claude Code, Codex, and OpenCode;
  - the adapters keep only their protocol over one transport with two framings;
  - every adapter's restart key now includes model, folder, account, and access, so a Claude Code thread restarts on a model change.
- **Prompts in-process**:
  - a turn carries `askOwner`, bound to Approvals;
  - Codex and OpenCode no longer answer their permission requests over loopback HTTP in Claude Code's format;
  - a failure to ask ends the turn instead of hanging it;
  - `answer_prompt` is listed only to Claude Code threads.
- **Each harness defined once** (`harnesses.ts`): a registry keyed by harness name; keyed lookups replace `harness === "claude"` branches.
- **Intel store** (`intelStore.ts`, `intelDecisions.ts`): the only writer of the intel tables, recording history and fading steps in each named operation.
- **Starting context** (`startingContext.ts`, `turns.ts`):
  - one module assembles a thread's system part and turn note;
  - the size warning measures the same sections, so the workspace's instructions, the fixed instructions, and the title and budget lines now count;
  - larger-model suggestions come from the chosen harness's list.
- **Commands** (`commands.ts`): owner requests and thread tools go through one runner. Operations return their follow-ups, and the runner commits, announces once, cancels, then wakes.

Behavior changes, built under the owner's instruction without questions and not yet accepted by the owner:
- the restart key;
- `answer_prompt` hidden from Codex and OpenCode;
- a failed prompt answer ending the turn;
- open harness questions withdrawn when their turn ends;
- the fake harness echoing `prompt allowed` / `prompt denied: …`;
- the starting-context measurement and its label: it now counts the instructions every thread receives, which reverses Batch 17's provisional choice;
- one announcement instead of two for SetMissionBudget and the auto-archive sweep;
- account, browsable-root, permission, and dismiss-prompt requests now committed in one transaction each.

References:
- documentation/architecture-audit/architecture-audit-2026-11-07-1830.html
- documentation/verification/2026-11-07-architecture-pass.md
- documentation/architecture.md (Inside the local service)
- packages/service/src/: harnessProcesses.ts, lineProcess.ts, harnesses.ts, harnessCatalog.ts, claude.ts, claudeArgs.ts, codex.ts, opencode.ts, fakeHarness.ts, execution.ts, threadToolHandlers.ts, intelStore.ts, intelDecisions.ts, intelChanges.ts, intelUndo.ts, intelProposals.ts, intelViews.ts, startingContext.ts, turns.ts, threads.ts, commands.ts, service.ts, tree.ts, budgets.ts, chatter.ts, deleting.ts, ending.ts, suggestions.ts, lifecycle.ts
- packages/contracts/src/records.ts, requests.ts
- apps/app/src/labels.ts, threadTree.tsx
- removed: packages/service/src/rpcProcess.ts

Validation:
- `bun run test` passed 371 with 8 skipped, twice; the baseline was 339 at `26bbb1d`, and 32 tests are new.
- `bun run typecheck`, `bun run check`, `git diff --check`, and the desktop build passed.
- The bundled service started on the fake harness.
- Not verified: the app driven in the window, or any live harness.

Evidence: The owner's instructions of 2026-11-07: "/review-and-refactor the full project. /improve-codebase-architecture for the full project. /code-simplifier without breaking conventions." and "All the points in the architecture-audit-2026-11-07-1830.html document are relevant. Do the necessary fix/implementation to improve all of that. Document the changes made."

## CHG-0063 · 2026-11-07 · Approval fixes: the quote check, wrapped commands, one-time allowances

Type: Code
Event: Delivery
Scope: Local service (approvals)

Summary: three Specifications review findings from CHG-0062, implemented test-first:
- **Quote check** (High, `quotes.ts`, `approvals.ts`): a thread's quote now approves only when it appears in the owner's message as whole words, ignoring case; no negation comes before it in its sentence or inside it ("don't", "not", "never", "wait", "hold", French "ne", "pas", "jamais"…); and it names the action. For a command on the sensitive list, naming means a verb of that kind (`Sensitivity.verbs` in `patterns.ts`, such as "push" for Push code, "ship" or "deploy" for Deploy). For any other command, it means a word of 3 letters or more that the command shares. "it", "don't push it", and "push it" for `npm publish` now ask.
- **Wrapped commands** (High, `patterns.ts`): the sensitive list now recognizes commands after a shell's `-c` script (`bash -lc '…'`, `/bin/zsh -lc "…"`), `eval`, `env` and variable assignments, `command`, `builtin`, `time`, `nohup`, `exec`, `nice`, `timeout`, `caffeinate`, and a command word with its folder (`/usr/bin/git`).
- **One-time allowance** (Medium, `approvals.ts`, `threads.ts`): `Approvals.endTurn` forgets a thread's one-time allowances however its turn ends, so an approval no longer outlives its turn.

Built under the owner's instruction without questions. Not yet accepted by the owner. Errors fall on the side of asking.

References:
- documentation/verification/2026-11-07-approval-fixes.md
- packages/service/src/quotes.ts, patterns.ts, approvals.ts, threads.ts
- packages/service/test/approvals.test.ts

Validation:
- `bun run test` passed 380 with 8 skipped, twice; 9 tests are new.
- `bun run typecheck`, `bun run check`, and `git diff --check` passed.
- 4 of 4 mutations caught.
- Not verified: a live Codex escalation's exact command format, or any live harness.

Evidence: The owner's instruction of 2026-11-07: "Read the last handoffs, then continue with the next step. For now, we build, step by step and we verify it works. […] Don't ask any question for this session, build what is next."

## CHG-0064 · 2026-11-08 · Approval fixes: OpenCode edits outside the workspace, Always allow across kinds, Codex's wrapped escalations

Type: Code
Event: Delivery
Scope: Local service (approvals, OpenCode adapter)

Summary: two Medium Specifications review findings from CHG-0062, and one bug found by the live probes, implemented test-first:
- **OpenCode edits outside the workspace** (`opencode.ts`, `folders.ts`): OpenCode's `edit` permission is now `ask` at every level, so each edit reaches Canopy. At the default level the adapter lets an edit run unasked when every file it names (`rawInput.filePath` and each `locations[].path`) lies inside the thread's folder once `..` and symbolic links are resolved (`isInsideFolder`); any other edit, or one naming no file, goes to Approvals and becomes a question. At "Also commands and edits" every edit asks, as before. An edit inside the folder leaves no line in the thread, as with Claude Code and Codex.
- **Always allow across kinds** (`permissions.ts`, `patterns.ts`, `approvals.ts`): a standing permission now covers only actions of its own kind: its sentence's sensitive kind, such as "Push code" (`kindOfPermission`), must equal the target's, or both are ordinary. A thread-proposed `gi*` saved for a push no longer covers `git reset --hard`, and `./*` saved for an unlisted script no longer covers `./git push`. A thread's question now stores and shows the pattern Always allow will save (`savedPatternOf`), the exact command when the proposed one does not cover it.
- **Codex's wrapped escalations** (`patterns.ts`, found live): Codex escalates a command as `/bin/zsh -lc 'git push origin main'`. The sensitive list already recognized it (CHG-0063), but the one-time allowance and standing patterns compared the wrapped string, so the owner was asked twice for one push, and `git push *` never spared a Codex prompt. `targetOf` now names a command that is wholly one shell `-c` script in one pair of quotes by that script; anything chained outside the quotes keeps the whole command.
- **OpenCode's real edit format** (`opencode.ts`, found live): OpenCode 2.2.0 sends `rawInput.path` (as the model wrote it, possibly relative), `locations[].path` and `content[].path` (absolute), never `filePath`. The adapter reads all of them, and the question shows the absolute path.

Built under the owner's instruction without questions; live checks run with the owner's accounts at their request ("Don't hesitate to test with my account. There are free OpenCode model available."). Not yet accepted by the owner. Errors fall on the side of asking: a thread-proposed sentence equal to a sensitive kind's name, saved for an unlisted command, no longer covers that command and asks again.

References:
- documentation/verification/2026-11-08-edits-and-pattern-kinds.md
- packages/service/src/opencode.ts, folders.ts, permissions.ts, patterns.ts, approvals.ts
- packages/service/test/harnesses.test.ts, approvals.test.ts, workspaces.test.ts, fixtures/stand-in-opencode.mjs

Validation:
- `bun run test` passed 390 with 10 skipped, twice; 10 tests are new (2 of them live, opt-in), 1 changed (OpenCode's `edit` permission).
- `bun run typecheck`, `bun run check`, and `git diff --check` passed.
- 4 of 4 mutations caught; the unwrap tests failed before the fix.
- Live, `CANOPY_LIVE_HARNESSES=1`: 5 of 5 passed, with OpenCode on `opencode/deepseek-v4.1-flash-free` and Codex on its default model. Real OpenCode wrote inside the workspace unasked and asked before writing outside it; a Codex thread's `git push` to a local remote was decided once and reached the remote.
- Not verified: the app driven in the window.

Evidence: The owner's instruction of 2026-11-08: "Read the last handoffs, then continue with the next step. For now, we build, step by step and we verify it works. […] Don't ask any question for this session, build what is next."

## CHG-0065 · 2026-11-08 · OpenCode carries on after a refusal

Type: Code
Event: Delivery
Scope: Local service (OpenCode adapter)

Summary: one Medium finding from the live probes of CHG-0064, implemented test-first. Rejecting an OpenCode permission ended its whole prompt (`stopReason: "cancelled"`), so the thread stopped instead of carrying on without the action, and a Deny message never reached it. OpenCode 2.2.0 has no setting for this (its `experimental.continue_loop_on_deny` is now a dropped legacy key) and ACP carries no message with a rejection. The adapter (`opencode.ts`, `runPrompts`) now keeps each refusal given during a prompt and, when OpenCode cancels the prompt after one and no interrupt is under way, sends the refusals as a new prompt in the same turn: "Canopy refused the command `…` / the change to `…`. <the owner's answer>", the answer being "Not approved by the owner. Do not do this action; carry on without it." or "Denied by the owner: <message>". The turn's usage adds every prompt's. Stop and Interrupt still end the turn.

Built under the owner's instruction without questions; the live check ran with the owner's accounts at their earlier request. Not yet accepted by the owner. The OpenCode stand-in now cancels its prompt on a rejection, as OpenCode does live.

References:
- documentation/verification/2026-11-08-opencode-refusals.md
- packages/service/src/opencode.ts
- packages/service/test/harnesses.test.ts, liveHarnesses.test.ts, fixtures/stand-in-opencode.mjs

Validation:
- `bun run test` passed 392 with 10 skipped, twice; 3 stand-in tests are new or changed in behavior, 1 renamed, and the live OpenCode edit check now also requires the thread to carry on after a Deny with a message.
- `bun run typecheck`, `bun run check`, and `git diff --check` passed.
- The mutation that drops the follow-up prompt failed 3 stand-in checks and the live check.
- Live, `CANOPY_LIVE_HARNESSES=1`: 5 of 5 passed, OpenCode on `opencode/deepseek-v4.1-flash-free`, Codex on its default model.
- Not verified: the app driven in the window.

Evidence: The owner's instruction of 2026-11-08: "Read the last handoffs, then continue with the next step. For now, we build, step by step and we verify it works. […] Don't ask any question for this session, build what is next."

## CHG-0066 · 2026-11-08 · Five Low findings fixed

Type: Code
Event: Delivery
Scope: Local service (approvals, thread tree, journal, accounts, harness processes)

Summary: five Low findings from the review pass (`work-in-progress.md`), each implemented test-first.
- **Edit summary**: a harness asking about a file change inside the thread's folder (at "Also commands and edits", on any harness) was asked as "Change a file outside the workspace". Approvals now resolves the thread's folder (`threadFolderOf`) and asks such a change as an ordinary "Change a file." with no sensitive kind; a change naming any file outside, after `..` and links, keeps the outside wording, and a key file stays "Read passwords or keys". Codex's several files in one field are each checked.
- **Running limit**: the 8 running threads of a mission now count threads in Attention on a question inside their turn, whose harness process still runs (`runningCountOf`).
- **Opener's messages**: the cap line now says how many were left out, for example "(4 earlier messages left out.)".
- **Removed account**: a turn of a thread whose added account was removed (possible once its mission ended, then reopened) fails before the harness starts, with "This thread ran on a … account that was removed, with its conversation. Open a new thread to carry on."
- **Interrupted usage**: an OpenCode prompt cancelled by an interrupt already counted the usage OpenCode reports with it (now tested); a process that dies during an interrupt now keeps the usage of the turn's earlier prompts instead of none (`harnessProcesses.ts`, for every harness).

Built under the owner's instruction without questions. Not yet accepted by the owner. The specifications are unchanged: the running-limit and removed-account behaviors are provisional until the owner accepts them.

References:
- documentation/verification/2026-11-08-low-findings.md
- packages/service/src/approvals.ts, patterns.ts, workspaces.ts, tree.ts, journal.ts, runners.ts, threads.ts, harnessProcesses.ts
- packages/service/test/approvals.test.ts, threads.test.ts, journal.test.ts, harnesses.test.ts, fixtures/stand-in-opencode.mjs

Validation:
- `bun run test` passed 397 with 10 skipped, twice; 5 tests are new and 1 extended.
- Each new test failed before its fix, for the reason the finding names (see the proof).
- `bun run typecheck`, `bun run check`, and `git diff --check` passed.
- Not verified: live harnesses (no live check covers these paths); the app driven in the window.

## CHG-0067 · 2026-11-08 · Thread-opening indicators

Type: Code
Event: Delivery
Scope: App (conversation), contracts (`ThreadSummary`), local service (mission detail)

Summary: the conversation now shows each thread opened beneath it, like delta's fork lines.
- The parent's conversation shows "Opened beneath: <title>" ("Agent opened beneath" when an agent opened it) where the thread was opened. Clicking the line selects that thread. An aside has no such line: its suggestion line already leads to it.
- The child shows "Opened from: <parent title>" under its header. Clicking it selects the parent.
- `ThreadSummary.openedAt`: the time of the thread's first message, read without a migration.
- `entriesOf` moved to `apps/app/src/entries.ts`, so it can be tested without React Native.

Asked by the owner on 2026-11-08. Not yet accepted by the owner. The thread-tree specifications are unchanged.

References:
- documentation/verification/2026-11-08-thread-opening-indicators.md
- apps/app/src/entries.ts, conversationEntries.tsx, conversation.tsx
- packages/contracts/src/records.ts, packages/service/src/missionDetail.ts
- apps/app/test/entries.test.ts, packages/service/test/threads.test.ts

Validation:
- `bun run test` passed 399 with 10 skipped; 2 tests are new and 1 extended. Mutations showed each check able to fail.
- `bun run typecheck`, `bun run check`, `git diff --check`, and the web export passed.
- The app was driven in the window with the fake harness; screenshots are in the proof.
- Not verified: live harnesses (no harness-specific path changed).

## CHG-0068 · 2026-11-08 · Sketchbook look and mission board

Type: Code
Event: Delivery
Scope: App (theme, shared controls, dashboard, sidebar, mission view, Settings, Intel)

Summary: the app takes the Sketchbook Board art direction (`documentation/art-direction/2026-11-08-sketchbook-board.html`), chosen by the owner over the four directions of the same day.
- Theme: ink on warm paper, one blue ink, a highlighter for Attention; 1.5px ink outlines, hand-cut corners, flat offset shadows. Caveat (bundled through `@expo-google-fonts/caveat`) for headings and margin notes only.
- No more chip rows: `Choice` is a segmented control up to three options and a drop-down field past that; effort is a line of stops (`Steps`); composer pickers are underlined words. `Choice`, `Menu`, and `Steps` moved to `pickers.tsx`.
- Dashboard: the state filter is replaced by a board of Attention (with Failed), Running (with Waiting and Idle), and Done columns; the workspace filter is a breadcrumb menu. Columns stack below 720 points of width.
- Canopy drawings (`react-native-svg`): the logo, the mission view's arched top, and the empty board.
- States read as marks: Attention highlighted and circled, Done ticked, Failed crossed.

Not done from the mockup, for lack of data or because the conversation is too wide to dock: harness, model, branch, and diff stats on cards; plan usage in the rail; the mission docked beside the board; trace, Changes tab, and Land.

Asked by the owner on 2026-11-08. Not yet accepted by the owner.

References:
- apps/app/src/theme.ts, styles.ts, pickers.tsx, board.tsx, boardColumns.ts, sketches.tsx, dashboard.tsx, sidebar.tsx, runners.tsx, intel.tsx, conversation.tsx, controls.tsx, App.tsx
- apps/app/test/boardColumns.test.ts
- documentation/verification/2026-11-08-sketchbook-look/

Validation:
- `bun run test` passed 403 with 10 skipped; 4 tests are new.
- `bun run typecheck` and `bun run check` passed (the art-direction mockups are excluded from Biome).
- Driven in the Electron window with the fake harness: empty board, board with a mission, mission view, Settings, Intel (screenshots in the verification folder).
- Not verified: native builds; the Attention circle and Done column with real missions in those states.

## CHG-0069 · 2026-11-08 · Sidebar by Control and workspaces, Idle column, send icon, menus in their own layer

Type: Code
Event: Delivery
Scope: App (sidebar, dashboard board, composer, drop-down menus)

Summary: the owner's review of CHG-0068 asked for Control on top of the sidebar, workspaces under it, a place for missions outside workspaces, a send icon, Running told apart from finished, and the composer's menus fixed.
- Sidebar: Control on top, then Workspaces (each with its open missions counted; choosing one shows its board), then Missions with no workspace with Archived as a small link under its heading, then Intel, Settings, and Spending (the global budget's period: meters when it has limits, a token count otherwise). Control leads to the board of every mission, where Control's own thread will be pinned (mission-coordination, not built); the board's heading reads Control. The workspace chosen moved from the dashboard into the app, so the sidebar and the breadcrumb share it.
- Board: four columns, Attention, Running (with Waiting), Idle, Done. Idle missions, with no thread at work, no longer sit under Running. The columns stand side by side from 860 points of panel width (was 720).
- Composer: Send is a round arrow button (accessibility label "Send"), dimmed while the box is empty; Enter still sends.
- Menus: an open list draws in a transparent modal layer placed from its button (`menuPlacement.ts`), so nothing covers it (the workspace line did), a click outside closes it, only one is open at a time, and it opens upward when there is more room above.
- Workspace board: a mission started there starts in that workspace; the folder choice is replaced by "Starts in <workspace>", and the starter waits until the workspace's folder is known. The mission list's workspaces now carry their folder (`WorkspaceChoice.path`, contracts and service).
- Conversation: the messages keep a 16-point gutter on the right, so the scrollbar no longer sits on the owner's messages.

Not done: plan usage per harness (no harness limit is read yet; backlog entry with the Codex evidence); Control's thread itself.

Asked by the owner on 2026-11-08. Not yet accepted by the owner.

References:
- apps/app/src/sidebar.tsx, dashboard.tsx, boardColumns.ts, pickers.tsx, menuPlacement.ts, controls.tsx, styles.ts, App.tsx
- apps/app/test/boardColumns.test.ts, menuPlacement.test.ts
- packages/contracts/src/workspaces.ts, packages/service/src/dashboard.ts, packages/service/test/dashboard.test.ts
- documentation/verification/2026-11-08-sidebar-and-menus/

Validation:
- `bun run test` passed 410 with 10 skipped; 7 tests are new or changed (board columns, menu placement), the board ones seen failing first.
- `bun run typecheck`, `bun run check`, `git diff --check` passed.
- Driven in the Electron window with the fake harness (Environment as in `verification/2026-11-08-thread-opening-indicators.md`): empty Control board, harness menu drawn over the workspace line, click outside closing it, an Idle mission in the Idle column and in the sidebar's Missions, the send arrow in the mission view, a Settings drop-down field.
- Workspace board driven with a workspace mission started over the service socket (the Finder dialog cannot be driven): the sidebar lists the workspace with its count, the starter reads "Starts in canopy-ws-demo", and a mission sent from it lands in that workspace.
- Not verified: a menu opening upward, native builds.

## CHG-0070 · 2026-11-08 · No New mission button beside Control, Archived at the end of Missions

Type: Code
Event: Delivery
Scope: App (sidebar)

Summary: the sidebar's "New mission" button only opened Control, where missions already start; the owner asked why both exist, and it is removed. Control is the one way to start a mission from the sidebar.
- Archived moves from a subtitle under the Missions heading to the list's last row, shaped like a mission's row: a box glyph where a mission has its dot, a muted label, and the count of archived missions.

Asked by the owner on 2026-11-08. Not yet accepted by the owner.

References:
- apps/app/src/sidebar.tsx, App.tsx

Validation:
- `bun run typecheck`, `bun run check` passed; `bun run test` passed 410 with 10 skipped. Driven in the window with the fake harness: Control first in the rail, Archived last under Missions, its count going to 1 after archiving a mission from its card (`verification/2026-11-08-sidebar-and-menus/archived-last-row.png`).

## CHG-0071 · 2026-11-08 · Seven more art directions, kept for a theme or a later rework

Type: Docs
Event: Delivery
Scope: Art direction

Summary: seven whole-app boards beside the taken Sketchbook look (CHG-0068), each with the same window (rail, board, docked mission panel) and the same kit sheets, so they compare on look alone.
- D Flight Deck (dark spaceship cockpit), E Flight Manual (between Sketchbook and Flight Deck), F Forest Canopy (tree canopy).
- G Brigade (kitchen pass, renamed), H Guild (heroic fantasy, renamed, with a lexicon to the glossary), I Tower (air traffic strip board, renamed), J Copydesk (newsroom front page, renamed).
- None replaces the Sketchbook look. Each is a candidate either as a selectable theme or as the basis of a future visual rework.

Asked by the owner on 2026-11-08; the owner liked Brigade best among G to J. Not yet chosen.

References:
- documentation/art-direction/2026-11-08-{flight-deck,flight-manual,forest-canopy,brigade,guild,tower,copydesk}-board.html

Validation:
- Each page rendered with Playwright at 1400px and checked by eye; overlaps found were fixed. Not checked: React Native feasibility beyond the notes in each page.

## CHG-0072 · 2026-11-09 · Renamed to Gild, with the owner's logo

Type: Code and documentation
Event: Delivery
Scope: Whole product

Summary: Canopy is now Gild. The domain terms stay as they are (mission, thread, Control, journal, briefing, dashboard, intel). The owner's logo replaces the drawn canopy mark and every app icon, for now.
- The app, window, sidebar, Expo `name` and `slug`, packages (`gild`, `@gild/contracts`, `@gild/service`), environment variables (`GILD_*`), the desktop bridge (`window.gild`, `gild:*` channels), service keys (`gild/…`), temporary folder prefixes, the database file (`gild.sqlite`), and the thread tools' MCP server name (`mcp__gild__…`) carry the new name.
- On first launch without `GILD_DATA_DIR`, the desktop app moves the newest former user-data folder (`Canopy`, else `OpenMission`) into its profile folder, renames the database with its write-ahead files, and renames Claude Code's session folders for scratch folders (the computer's sign-in and each added account), so threads with no workspace still resume. It now joins a profile folder Electron made before the move, and does nothing once `gild.sqlite` exists.
- Logo: the owner's gold G on deep navy `#000216` (`documentation/brand/gild-logo-2026-11-09.png`) becomes the 1024-point app icon and splash, the 48-point favicon, the 128-point `logo.png`, the Android adaptive foreground and background and monochrome icon, and the 1024-point desktop icon with rounded corners. The G is keyed out of its background as `gild-mark.png` for the sidebar. The splash and adaptive backgrounds change from `#01081C` to `#000216`.
- Sketches: the drawn canopy logo (`CanopyMark`) is gone in favour of the image; the mission panel's arch stays (`PanelArch`); the empty board is an empty gilt frame (`EmptyBoard`).
- Living documents use the new name; dated records (handoffs, verification, earlier changelog records, architecture decisions, audits, art-direction boards) keep the name they were written with. The GitHub repository is `Dyrits/GILD` (was `Dyrits/CANOPY`), and `origin` follows it.
References: apps/app/assets/, apps/desktop/assets/icon.png, apps/app/app.json, apps/app/src/sketches.tsx, apps/app/src/styles.ts, apps/desktop/src/formerData.ts, apps/desktop/src/main.ts, apps/desktop/test/formerData.test.ts, package.json files, bun.lock, README.md, AGENTS.md, documentation/, documentation/brand/, documentation/verification/2026-11-09-gild-rename/

Validation: `bun run test` passed 414 with 10 skipped; `bun run typecheck`, `bun run check`, `git diff --check`, and the desktop build passed. `leftovers.sh` reports 0 brand uses of the former name in living files. The probe moved a copy of the owner's install (11 missions) into a profile folder that already existed, renamed the database and a Claude session folder, and the built service listed all 11. The window was driven with the fake harness: title Gild, the gold G and name in the sidebar, the gilt empty board, and the mission panel's arch (`verification/2026-11-09-gild-rename/window-control.png`, `window-mission.png`). Not verified: the owner's real install moving (it happens on the next launch), the dock icon, native phone builds.

Evidence: The owner's instruction of 2026-11-09: "We'll do another rebranding. We'll rename the solution 'Gild' instead of Canopy. Use this logo for now."

## CHG-0073 · 2026-11-09 · Guild board and interface vocabulary

Type: Code
Event: Agreement
Scope: Interface

Summary: Apply the owner's selected Guild mockup to Gild, including quests, companions, realms, lore, War table, and state display names, while retaining the Gild name and logo.
Reason: The owner chose this art direction and explicitly requested the naming changes with iterate.
References: [Mockup](art-direction/2026-11-08-guild-board.html), [vocabulary](glossary.md#guild-interface-vocabulary), [current batch](work-in-progress.md).
Validation: Direct user request on 2026-11-09; appearance acceptance is pending on the implemented app.
Evidence: Starting revision `63bc425d28bb4ee054e4d0e91c77bdc3c85551a8`; verification recorded in working state.

## CHG-0074 · 2026-11-09 · Quest vocabulary refined

Type: Code
Event: Delivery
Scope: Interface vocabulary

Summary: The owner confirmed Mission → Quest, Intel → Lore, child thread → Side-quest, Workflow → Craft, Routine → Ritual, and Control / War table → Guildmaster.
Companion names the selected model doing the work, not its conversation; model selectors say Companion (model), and messages use Companion as their sender label.
Quest cards count the root quest and its side-quests separately, and child creation, folded groups, deletion, scope labels, and composer wording use the work's name.
Craft and Ritual are recorded for future automation interfaces; no new automation behavior was added.
References: [Glossary](glossary.md#guild-interface-vocabulary), apps/app/src/, apps/app/test/labels.test.ts.
Validation: The owner's naming instructions and explicit clarification that Companion is the selected model; 21 label tests, typecheck, lint, and whitespace checks pass.
Evidence: Baseline `41cc1f5`; presentation-only changes preserve protocol and storage identifiers.

## CHG-0075 · 2026-11-09 · Frameless window, top bar, collapsible sidebar

Type: Code
Event: Delivery
Scope: Interface layout

Summary: The owner asked to drop the box around the conversation, show the quest input without a "Post a quest" button, add a top bar, and let the sidebar collapse to icons.
The gold frame around the window and the docked 540px conversation panel are removed; a quest opens full width.
The quest input is always open on the Quests board (not on Archived).
The 40px top bar spans the window and, on macOS, is the window's title bar (the system's is hidden, the traffic lights stay, the bar drags the window): a sidebar toggle, where the owner is (realm, place, or open quest), and the global spending; the screens' own duplicate headings leave when the sidebar shows.
The sidebar collapses to a 56px icon rail, remembered in browser storage.
References: apps/app/App.tsx, apps/app/src/sidebar.tsx, apps/app/src/dashboard.tsx, apps/desktop/src/main.ts, apps/desktop/src/preload.ts.
Validation: The owner's answers to three scoping questions, then the correction that the top bar is the window's own; typecheck, lint, and 415 tests pass.
Evidence: Baseline `c9c0077`; not yet seen in the running window, so the appearance awaits the owner.

## CHG-0076 · 2026-11-09 · Breadcrumbs, quest layout, and quest panel

Type: Code
Event: Delivery
Scope: Interface layout

Summary: The owner asked for breadcrumbs in the top bar, the sidebar toggle out of it, a quest screen without a full-width header, and the quest's options in a right side panel.
The top bar shows breadcrumbs that follow the rail (Realms, Quests, Archives); the toggle is an icon handle on the rail's edge, and "Archived" is now "Archives".
A quest shows its thread tree (Quest, Side-quests) beside a full-height conversation.
The quest panel (name, state, journal, budget, usage, ending) is a right column with its own header level with the top bar, shown or hidden by an icon at the top bar's right end, open by default from 1280px; below 820px it takes the conversation's place.
References: apps/app/src/sidebar.tsx, apps/app/src/conversation.tsx, apps/app/src/questPanel.tsx, apps/app/src/threadTree.tsx, apps/app/src/missionActions.tsx, apps/app/App.tsx.
Validation: The owner's requests in conversation; typecheck, lint, 415 tests, and the web export pass.
Evidence: Baseline `e827fe2`; [proof](verification/2026-11-09-quest-layout.md), not proven: not seen in the running window, so the appearance awaits the owner.

## CHG-0077 · 2026-11-09 · Tilted quest cards with API cost; Claude turn cost recorded

Type: Code
Event: Delivery
Scope: Mission card, harness cost

Summary: The owner asked for quest cards like the Guild mockup (parchment, pinned, tilted, with the API cost) and then the next feature through iterate.
Cards tilt by a steady angle from their id (within 1.8 degrees), an Attention card has a red edge, and a gold-coin cost line shows when the quest has spent API cost.
So the cost can appear, Claude Code's `total_cost_usd` is now recorded per turn as the difference from the process's previous running total; the owner chose to record it on every Claude turn, not only when billed by API key.
Because a turn with a cost is not counted in tokens, Claude turns now count against cost limits and no longer against token limits.
References: apps/app/src/board.tsx, packages/service/src/claude.ts, packages/service/src/harnessProcesses.ts, packages/service/test/claude.test.ts.
Validation: typecheck, lint, and 419 tests pass, including one for the per-turn cost from a running total.
Evidence: Baseline `6d7804d`; not proven: the running-total assumption was not probed live (the owner stopped the probe), and the card look was not seen in the running window; both await the owner.

## CHG-0078 · 2026-11-09 · Ribbon column headings; harness and model on cards

Type: Code
Event: Delivery
Scope: Mission board

Summary: The owner asked for column headings like the Guild mockup, then for the next feature.
Each column heading is a colored banner with a notched lower edge (web only), the name in capitals with its count, and an italic caption beneath ("needs you", "Running", "Resting", "Done").
`MissionSummary` gains `harness` and `model` of the top thread, and a card's line reads, for example, "Claude Code · Sonnet · realm · 2 threads".
References: apps/app/src/board.tsx, packages/contracts/src/records.ts, packages/service/src/missions.ts, packages/service/test/missions.test.ts.
Validation: typecheck, lint, and 419 tests pass.
Evidence: Baseline `6d7804d`; not proven: the look was not seen in the running window and awaits the owner. Branch and diff stats stay on the backlog.

## CHG-0079 · 2026-11-09 · Thread panel and context gauge

Type: Code
Event: Delivery
Scope: Thread panel

Summary: The owner asked to implement the next big feature unattended; the backlog's "Thread panel and context gauge" was built.
Each thread has a 300px panel beside its conversation, shown by a "Thread panel" link in its header (closed at first, remembered, not below 820px): harness, account, model, effort, realm, state, the context gauge, lore and skills, this thread's spending, and the quest's budget.
The context gauge shows the latest model call's tokens against the model's window, split into Instructions, Lore, Journal, Messages, and Tools and results; the first four are counted from what Gild sends and the last is the remainder, with the counted parts scaled down when they exceed the reported total.
Each harness now reports the context of the turn's latest call (`TurnEnd.context`), stored in `usage.context` (migration 0022); a thread with none shows "Not measured yet".
New request `ReadThreadPanel`; new capability [thread-panel](capabilities/thread-panel/specifications.md), written by the agent: its behavior is provisional until the owner reviews it.
References: documentation/capabilities/thread-panel/specifications.md, packages/service/src/threadPanel.ts, packages/service/src/startingContext.ts, packages/service/src/{claude,codex,opencode}.ts, apps/app/src/threadPanel.tsx, apps/app/src/conversation.tsx.
Validation: typecheck, lint, and 430 tests pass; the panel was rendered with the fake harness.
Evidence: Baseline `24ccaaf`; [proof](verification/2026-11-09-thread-panel.md). Not proven: per-call usage from the live harnesses, other widths, and the owner's acceptance of the look.


## CHG-0080 · 2026-11-09 · Plain board background

Type: Code
Event: Delivery
Scope: Mission board

Summary: The owner asked for a simpler board background. The repeating timber seams and grain are removed; the board is the flat wood color.
References: apps/app/src/dashboard.tsx, apps/app/src/sketches.tsx.
Validation: typecheck, lint, and 430 tests pass.
Evidence: Baseline `7caf116`; not proven: the look was not seen in the running window and awaits the owner.


## CHG-0081 · 2026-11-09 · Emblems, realms menu, and rail interactions

Type: Code
Event: Delivery
Scope: Guild interface

Summary: The owner found the interface short of interactions and its quests alike, and suggested gathering the realms in one menu when the rail is short.
Every realm and quest wears an emblem (sixteen line drawings in eight tints) chosen from its id, so it never changes; a quest's emblem carries a dot in its state's color. Emblems show in the rail, the realms menu, and on quest cards (on a leather chip).
The collapsed rail shows one Realms button with a count; it opens a list of the realms with their emblems and open quests. The quests are left to Guildmaster's board, and the Archives, Lore, and Settings icons remain.
Interactions: rows highlight on hover; a collapsed row names itself in a label beside it; Ctrl or Command with B collapses and expands the rail; a quest card under the pointer straightens and rises.
Emblems are not chosen by the owner yet; a chosen icon would need a stored field (backlog candidate).
References: apps/app/src/{emblems,sidebar,board}.tsx.
Validation: typecheck, lint, and 430 tests pass.
Evidence: Baseline `e6db65d`; [proof](verification/2026-11-09-emblems.md). Not proven: the card hover, the realm choice in the menu, narrow widths, and the owner's acceptance of the look.


## CHG-0082 · 2026-11-09 · Pill composer and rail reserves

Type: Code
Event: Delivery
Scope: Guild interface

Summary: The owner preferred a one-line, rounded message box that grows only for several lines, and showed a reserves block with a name, what is left, and a bar per resource.
The composer is one pill: the text, the pickers (on the dashboard), the Interrupt and alternative buttons, and the send button share a row; the input is one line high and grows with its lines up to 200px, then scrolls. On a narrow box the pickers wrap below the text.
The rail's Reserves show one row per set global limit: Mana for tokens, Gold for cost, each with what is left ("38% left", "$12.60 left") over a bar that drains, orange from 80% spent and red at the limit. Without limits the rail keeps its one line of spending. Gild does not read the harnesses' plan limits, so the rows show the global budget only.
References: apps/app/src/{controls,styles,sidebar,budgets,labels}.ts*.
Validation: typecheck, lint, and 431 tests pass.
Evidence: Baseline `882402b`; [proof](verification/2026-11-09-composer-reserves.md). Not proven: warning colors, the skill highlight on a grown box, narrow widths, and the owner's acceptance of the look.


## CHG-0083 · 2026-11-09 · Board closer to the owner's mockup

Type: Code
Event: Delivery
Scope: Guild interface

Summary: The owner shared a painted mockup of the guild and asked for the interface to be more like it. What code can draw was taken; painted art and features Gild lacks were not.
Board: a large Quests title over a drawn castle and hills; columns hang as banners from gilt rods with their meaning inside; cards have an inner gilt line and Done cards a FULFILLED tag.
Rail: a crest with the mark and the wordmark; sections with icons and a gilt rule (Realms, Quests, The Keep, Reserves). Guildmaster, Lore, Archives, and Settings now sit together under The Keep, drawn icons replace the text glyphs, and the reserves have icons and gilt-rimmed bars.
Quest panel: opens with the quest's emblem, its title (press to rename), and its state; the separate Name and Status groups are gone.
Left out: the mockup's painted scenery, the Counsel, Spoils, Chronicle tabs, party size, branch, and diff counts, which Gild does not have.
References: apps/app/src/{board,dashboard,sidebar,budgets,questPanel,sketches}.tsx.
Validation: typecheck, lint, and 431 tests pass.
Evidence: Baseline `5485680`; [proof](verification/2026-11-09-guild-mockup.md). Not proven: the Fulfilled tag, the collapsed rail, narrow widths, and the owner's acceptance of the look.


## CHG-0084 · 2026-11-09 · Drawn banners

Type: Code
Event: Delivery
Scope: Mission board

Summary: The owner shared a reference of hanging banners and asked for banners as good. The columns' headings are now drawn to their width in SVG: a gilt rod with a finial at each end and a diamond in the middle, a cloth shaded from light to dark with fine vertical weave lines, a double gilt trim and a pointed lower edge with a diamond, a tassel on the red, blue, and violet cloths, and the title, a rule, and the column's meaning over the cloth.
References: apps/app/src/banner.tsx, apps/app/src/board.tsx.
Validation: typecheck, lint, and 431 tests pass.
Evidence: Baseline `3302f7b`; [screenshot](verification/2026-11-09-guild-mockup/board-banners.png), fake harness at 1600px. Not proven: narrow widths and the owner's acceptance of the look. The reference's velvet texture, the frayed green fringe, and the shadow under the rod are not drawn.


## CHG-0085 · 2026-11-09 · Straight archive cards

Type: Code
Event: Correction
Scope: Mission board

Summary: The owner reported the Archives view as broken: its cards were tilted across the full width and the search field looked cut short. Cards outside the board (the archives) no longer tilt and lie in a wrapping row, 360px wide each; the board's cards keep their tilt. The search field was hidden on its right by the heading's castle, which was drawn over the page; the castle now sits behind it.
References: apps/app/src/{board,dashboard,sketches}.tsx.
Validation: typecheck, lint, and 431 tests pass.
Evidence: Baseline `12b0908`; [screenshot](verification/2026-11-09-guild-mockup/archives-1600.png), fake harness with two archived quests. Not proven: narrow widths.


## CHG-0086 · 2026-11-09 · Guildmaster on top

Type: Code
Event: Delivery
Scope: Guild interface

Summary: The owner asked for Guildmaster to be its own category on top. It leaves The Keep and stands alone under the crest, over a gilt rule, in the expanded and the collapsed rail; The Keep keeps Lore, Archives, and Settings.
References: apps/app/src/sidebar.tsx.
Validation: typecheck and lint pass; seen in the fake-harness render, expanded and collapsed.
Evidence: Baseline `6d07d55`; not proven: the owner's acceptance of the look.


## CHG-0087 · 2026-11-09 · Places: Guildmaster, Realms, Quests, The Keep, Settings

Type: Code
Event: Delivery
Scope: Guild interface

Summary: The owner asked for every rail category to be clickable and of one kind, with Guildmaster holding only the quest input, the quest dashboard under Quests, the realms listed under Realms, and Settings in its own menu apart from The Keep.
The rail has five categories, each a heading that leads to its place and stands out while it shows: Guildmaster (the quest input alone), Realms (cards of the workspaces with their folders and open quests; a card shows that realm's quests), Quests (the board, optionally of one realm), The Keep (cards for Lore and Archives), and Settings. Realms keep their rows under their heading, as do the quests outside a realm, and Lore and Archives under The Keep. Collapsed, each category is one icon; the Realms icon opens a list with "All realms ›" on top.
The breadcrumbs follow: Realms, Quests, and The Keep now lead to their places. Quests are no longer started from a realm's board; the Guildmaster starts them. The app opens on the Guildmaster.
References: apps/app/App.tsx, apps/app/src/{places,sidebar,dashboard}.tsx.
Validation: typecheck, lint, and 431 tests pass.
Evidence: Baseline `d1b7023`; [screenshots](verification/2026-11-09-places/) (fake harness, 1600px). Not proven: the selected heading's new fill, narrow widths, and the owner's acceptance.


## CHG-0088 · 2026-11-09 · The quest panel and cards closer to the illustrated view

Type: Code
Event: Delivery
Scope: Guild interface

Summary: The owner shared their illustrated dashboard (`guild-dashboard 2`), asked for the interface to look more like it, and liked its selected-quest sidebar, asking for the same.
The quest panel is now a parchment in a double gilt frame with corner diamonds and a red bookmark, the quest's emblem on a gilt tile beside its name in large capitals, a line of how it stands, tabs Knows (the journal, as a blue note with a quill) and Spends (budget, usage, meters), and a red-ruled Does box with gilt Mark as done and Archive buttons; it is 360px wide. Cards have larger capital titles, a brown double frame, no pin, and a rule over the cost; the columns have faint rules between them; emblem chips have a gilt ring. The owner's painted desk (`apps/app/assets/guild-desk.png`, from the mockup's `desk-props.png`) lies along the foot of the board's window.
Left out because Gild has no such thing: the mockup's Counsel, Spoils, Chronicle, and Lore tabs, quest ordinals, party and branch lines, diff counts, the approval box, and the message box in the panel.
References: apps/app/src/{parchment,questPanel,missionActions,board,dashboard,sketches,emblems,sidebar}.tsx.
Validation: typecheck, lint, and 431 tests pass.
Evidence: Baseline `e40d80e`; [proof](verification/2026-11-09-guild-panel.md). Not proven: Summons and Fulfilled cards, narrow widths, and the owner's acceptance.


## CHG-0089 · 2026-11-09 · No rule under Guildmaster and Settings

Type: Code
Event: Delivery
Scope: Guild interface

Summary: The owner asked to remove the gilt underline under Guildmaster and Settings, since they have no rows beneath them. Realms, Quests, and The Keep keep theirs; the heading's height is unchanged.
References: apps/app/src/sidebar.tsx.
Validation: typecheck and lint pass; seen in the fake-harness render at 1600px.
Evidence: Baseline `4e76098`; not proven: the owner's acceptance of the look.


## CHG-0090 · 2026-11-09 · Realms, Quests, and The Keep unfold

Type: Code
Event: Delivery
Scope: Guild interface

Summary: The owner asked for Realms, Quests, and The Keep to be unfoldable. Each of the three headings has a chevron on its right that folds its rows away and brings them back; pressing the label still opens the place. Which are folded is remembered in browser storage; all start unfolded, and the collapsed rail is unchanged.
References: apps/app/src/sidebar.tsx.
Validation: typecheck, lint, and tests pass; seen in the fake-harness render at 1600px (folded Realms and The Keep, then Realms unfolded).
Evidence: Baseline `4e76098`; not proven: keyboard use of the chevron, the narrow window, and the owner's acceptance.


## CHG-0091 · 2026-11-09 · The rule under Guildmaster and Settings removed again

Type: Code
Event: Delivery
Scope: Guild interface

Summary: The owner asked for the rule back under every category (CHG-0089 undone), then preferred it without one under Guildmaster and Settings, which have no rows beneath them. Those two headings are bare again; Realms, Quests, and The Keep keep their rule and fold.
References: apps/app/src/sidebar.tsx.
Validation: typecheck, lint, and tests pass; the same code as CHG-0089, which was seen in a render.
Evidence: Baseline `f64b270`; a revert of that commit.


## CHG-0092 · 2026-11-09 · Settings is the Workshop

Type: Code
Event: Agreement
Scope: Guild interface

Summary: The owner chose Workshop as the interface name for Settings, from the options offered (Charter, Statutes, Workshop). The rail row, the breadcrumb, the page heading, the dashboard link, the Permissions back link, and the messages that send the owner there (global budget reached, folder outside the browsable roots, harness not found, settings still loading) say Workshop. The place, the contracts (`ReadSettings`, `UpdateSettings`), the stored table, and the glossary's technical term stay Settings.
References: apps/app/src/{sidebar,settings,dashboard,permissions,budgets,folderBrowser}.tsx, packages/service/src/{missions,folders,harnessTools}.ts, documentation/glossary.md.
Validation: typecheck, lint, and tests pass.
Evidence: Baseline `9ddcddb`; not proven: the owner's acceptance of the look.


## CHG-0093 · 2026-11-10 · Intel is called lore in the code

Type: Code
Event: Delivery
Scope: Scoped intel

Summary: The owner asked for the code to say lore, as the interface already did, keeping wire and storage names. Modules, types, schemas, functions, components, variables, comments, and tests now say lore: one item is a lore entry (`LoreEntry`, `LoreEntryId`), several are lore (`LoreScope`, `LoreView`, `loreEntries`); files moved from `intel*` to `lore*`. The prose threads read (thread instructions, tool descriptions, tool answers such as "Saved lore entry …") says lore. Kept as `intel`: the SQL tables, columns, indexes, and migrations; the request tags (`ListIntel` and the eight others); the thread tool names (`save_intel`, `search_intel`, `update_intel`, `forget_intel`, `relied_on_intel`); and the stored settings keys `intelHalfLives` and `intelWarningPercent`. Each file holding one of these says so in a one-line comment. The glossary's Intel terms became Lore terms, and the capability folder keeps its `scoped-intel` path.
References: packages/contracts/src/{lore,requests,ids,records}.ts, packages/service/src/lore*.ts, apps/app/src/{lore,loreHistory}.tsx, documentation/glossary.md, documentation/architecture.md.
Validation: format, typecheck, and tests pass (455 passed, 10 skipped); the kept table, tag, tool, and settings names are the same as before the rename.
Evidence: Baseline `2221cbe` with the owner's uncommitted review fixes; not proven: a live thread reading the reworded instructions.

## CHG-0094 · 2026-11-10 · Review findings of the realms and Companion-label commits fixed

Type: Code
Event: Delivery
Scope: Guild interface

Summary: The owner asked for every finding of the review of `42a60db` and `2221cbe` to be fixed. A quest's budget or journal screen, and a realm's lore and crest studio, close when another quest or realm is chosen. The realm panel is keyed by realm, saves a rename once, and counts all the realm's quests whatever the search shows; its ledger and lists are one shared component. `samePath` is exact (with the macOS `/private` form) in `apps/app/src/paths.ts`. The crest studio starts from the crest the realm shows, and its text field can be cleared, one undo step per typing. Breadcrumb keys are positional, and an archived quest's trail runs through Archives. The reply records the thread's chosen model when the harness names none, and Claude Code's `<synthetic>` is no model; `sonnet` reads as "Sonnet". A realm's lore lists its own deleted entries and hides the scope choice. The ending message says quest, and the desktop notification says "A quest needs you.". Not done: the six architecture candidates of `documentation/architecture-audit/architecture-audit-2026-11-09-2351.html`.
References: apps/app/src/{dashboard,questPanel,paths,workspaces,crestStudio,sidebar,formatting,lore,notifications}.tsx, packages/service/src/{turns,claude,loreViews,loreHistoryViews,ending}.ts.
Validation: format, typecheck, and tests pass (458 passed, 10 skipped); five mutations each fail a test ([proof](verification/2026-11-10-review-fixes-and-lore-rename.md)).
Evidence: Baseline `2221cbe`; not proven: the screen behaviors, which await the owner.

## CHG-0095 · 2026-11-10 · Quest and Side-quests menu restyled

Type: Code
Event: Delivery
Scope: Guild interface

Summary: The owner asked for the Quest and Side-quests menu to look better, using an illustrated mockup as inspiration. Section headings are bold Cinzel with a gold rule; titles are bold; each row ends with a diamond and the state's name in italics (Done keeps a tick, Failed a cross); side-quests of level 2 and deeper have L connectors; the selected row has a gold fill and border. The mockup's fold caret was not added.
References: apps/app/src/{threadTree.tsx,styles.ts}.
Validation: format, typecheck, and tests pass (458 passed, 10 skipped) ([proof](verification/2026-11-10-quest-tree-menu.md)).
Evidence: Baseline `10bf154`; not proven: the look, which awaits the owner.

## CHG-0096 · 2026-11-10 · Changing harness, account, model, and effort in the middle of a quest

Type: Code
Event: Delivery
Scope: Thread handover

Summary: The owner asked to be able to change provider and model in the middle of a quest. A quest's message box now carries the harness, account, Companion, and effort pickers; choosing another value is a handover (`ChangeThreadRunner`), refused while the thread is in a turn. A model or effort change keeps the harness session; a harness or account change forgets it, and the next turn's message carries the whole conversation so far (the oldest left out past half the context window). Each handover leaves a line in the conversation; a thread's waiting messages run on the new runner at once; each reply records the harness and model that wrote it (migration 0026 backfills earlier ones) so it keeps its provider's mark and name. Migration 0025 adds the handover lines.
References: documentation/capabilities/thread-handover/specifications.md, packages/service/src/{handover,messaging,turns,threads,missionDetail,store,deleting,fakeHarness}.ts, packages/contracts/src/{requests,records}.ts, apps/app/src/{conversation,conversationEntries,entries,formatting}.ts(x).
Validation: format, typecheck, and tests pass (473 passed, 10 skipped); each key check fails under a mutation ([proof](verification/2026-11-10-thread-handover.md)).
Evidence: Baseline `b7a0f16`; not proven: the look, which awaits the owner, and a handover between live harnesses.

## CHG-0097 · 2026-11-10 · Claude Code models by version, no Default model

Type: Code
Event: Delivery
Scope: Provider accounts

Summary: The owner saw only Haiku, Sonnet, and Opus in the Companion picker and asked for versions (Fable 5.2, Haiku 5.5) and no Default model on any harness. Claude Code now offers `claude-fable-5-2`, `claude-opus-5-5`, `claude-sonnet-5-5`, and `claude-haiku-5-5`, labelled "Fable 5.2" and so on; Codex and OpenCode list only the models their tools report. A new quest starts on Sonnet 5.5 (`startingModel`, provisional: the owner has not chosen it); choosing another harness in a picker takes its first listed model. Threads and settings that already hold `default`, `opus`, or `sonnet` keep running and keep their label.
References: documentation/capabilities/provider-accounts/specifications.md, packages/service/src/{harnessCatalog,harnesses,harnessTools,accounts,settings}.ts, packages/contracts/src/{records,harnesses}.ts, apps/app/src/{formatting,runners,dashboard}.ts(x).
Validation: format, typecheck, and tests pass (475 passed, 10 skipped); the four identifiers each answered through `claude -p --model` on 2026-11-10 (Fable 5.2 printed an `unrecognized_model` warning from the CLI and ran).
Evidence: Baseline `b7a0f16`; not proven: the look in the running window, the picker on Codex and OpenCode without Default, and a stored Settings default of `default`, which stays until changed.

## CHG-0098 · 2026-11-10 · Rituals: scheduled runs in a quest of their own, with fallback Companions

Type: Code
Event: Delivery
Scope: Rituals

Summary: The owner asked for Rituals, the routines of Gild: an instruction with a schedule and models, fallback models, a card of its own on the board, runs in the main quest, schedule presets, missed runs skipped, and a manual run at any time. A Ritual is a quest (migration 0027 adds `rituals`) whose main thread receives the instruction at each run, under "Ritual · scheduled 07:00" or "Ritual · run by you". Schedules are presets in local time (daily, weekdays, weekly, monthly, every N hours). The scheduler sleeps until the next Ritual is due and wakes on any change; a run later than 5 minutes after its time is skipped. When a run's turn fails, the thread is handed over to the next fallback Companion, which may be on another harness, with a line "Fell back to ... · reason"; the next run starts on the primary Companion again. The board shows a Ritual as a violet dashed card with a "Ritual" ribbon, its schedule, next run, last run, and Run now; the quest's panel holds the switch, Run now, Edit, and Delete (which keeps the quest). New requests: CreateRitual, UpdateRitual, RunRitual, DeleteRitual, ReadRitual.
References: documentation/capabilities/rituals/specifications.md, packages/contracts/src/{rituals,ritualSchedules,records,requests,ids}.ts, packages/service/src/{rituals,ritualSchedule,missions,handover,turns,threads,service,store,deleting}.ts, apps/app/src/{rituals.tsx,ritualLabels.ts,board.tsx,questPanel.tsx,dashboard.tsx}.
Validation: format, typecheck, lint, and tests pass (496 passed, 10 skipped); the service checks fail under mutation; driven in the web export on the fake harness ([proof](verification/2026-11-10-rituals.md)).
Evidence: Baseline `9ae8b19`; not proven: the look, which awaits the owner, a scheduled run firing on a live harness, and the fallback on real usage-limit failures.


## CHG-0099 · 2026-11-09 · @ names files and folders of the realm

Type: Code
Event: Delivery
Scope: Message box, workspace attachment

Summary: The owner asked that "@" reference folders and files of the current realm (workspace), and not work outside a realm.
Typing `@` at the start of a word lists up to 8 matching files and folders of the message's workspace; Tab, Enter, or a click completes the relative path (a folder's ends with a slash).
The list follows `.gitignore` in a git workspace and skips `.git` and `node_modules` otherwise; with no workspace nothing is offered.
The text reaches the thread as typed: no pointer is added.
A chosen path and a chosen skill show as a chip with a small icon (file, folder, puzzle piece) in the owner's messages of the conversation, and in the suggestion list; in the message box a chosen skill or path leaves the text and becomes a chip with its icon (and a × to remove it, or Backspace on an empty text) inside the text where it was chosen, as in OpenBot; a chip is removed like a character (Backspace), and the message goes out as plain text with `/skill` and `@path` in its place.
The web message box is now an editable element (`chipEditor.web.tsx`) rather than a text input; other platforms keep a text input that writes the token in.
References: documentation/capabilities/workspace-attachment/specifications.md, packages/service/src/workspaceEntries.ts, apps/app/src/controls.tsx, apps/app/src/useWorkspaceEntries.ts.
Validation: The owner's request; three service tests (matching, `.gitignore`, refusal), typecheck, lint, and 378 service tests pass.
Evidence: Baseline `6d7804d`; not seen in the running window (the chips and icons were added at the owner's second request after the first look). The listing accepts any existing folder, since a folder chosen for a first quest is not a workspace until that quest starts.

## CHG-0100 · 2026-11-10 · Rituals as a place of their own, apart from the quests

Type: Code
Event: Delivery
Scope: Rituals

Summary: The owner did not like how Rituals looked, found no menu for them, and asked for a menu of their own like the Quests one, with Rituals separate from quests. The rail gains a **Rituals** category (a moon) after Quests, with a row per Ritual; it leads to a Rituals place of cards with a **+ New Ritual** button. A Ritual's quest no longer appears on the Quests board, in the realms, the Archives, or the dashboard prompts (`ListMissions` leaves it out; the new `ListRituals` lists the Rituals). Its conversation opens from the card or the rail row under "Rituals › name", and its panel shows the Ritual's controls without Mark as done and Archive. The "+ Ritual" link and the card style on the quest board are gone. The form is compact: the schedule reads as a sentence of pickers ("Every week on Monday at 07:00"), and the Companion and each fallback are one row of the composer's underlined pickers.
References: documentation/capabilities/rituals/specifications.md, packages/contracts/src/{rituals,requests}.ts, packages/service/src/{rituals,missions,service}.ts, apps/app/{App.tsx,src/rituals.tsx,src/sidebar.tsx,src/board.tsx,src/dashboard.tsx,src/questPanel.tsx}.
Validation: format, typecheck, lint, and tests pass (500 passed, 10 skipped); the listing test fails without the quest-list exclusion; driven in the web export on the fake harness ([proof](verification/2026-11-10-rituals.md)).
Evidence: Baseline `9e6e2e3`; not proven: the look, which awaits the owner, the rail with many Rituals, and the narrow window (no rail).


## CHG-0101 · 2026-11-10 · The Workshop follows the owner's mockup, with provider logos

Type: Code
Event: Delivery
Scope: Settings

Summary: The owner supplied a mockup of the settings page and asked for it, with each provider's logo in place of its crest. The Workshop (Settings keeps the name chosen in CHG-0092, not the mockup's "Sanctum") is a page of parchment cards on the wood: a heading with a gear, a menu of Permissions, Defaults, Harnesses, Accounts, Messaging, and Limits that scrolls to its section and marks the one in view, and a pinned **Settings guide** side panel on a window with a rail. The old Harnesses and accounts section is two cards, **Harnesses** (logo, version, ready or problem, Refresh) and **Accounts** (logo, the computer's sign-in and added accounts, Add account). Every setting is kept: the mockup's cards are as drawn; the quest upkeep rows and the default budget join Defaults, and the lore half-lives and the global budget join Limits. The mockup's painted artwork (sunset castle, tree banner, guide castle) is left out at the owner's choice. The side panel's top-bar name is now set by the screen that gives the panel (`useQuestPanel`'s second argument), "Quest" by default.
References: apps/app/{App.tsx,src/settings.tsx,src/settingsParts.tsx,src/settingsSections.ts,src/settingsIcons.tsx,src/accounts.tsx,src/sidebar.tsx}, apps/app/test/settingsSections.test.ts.
Validation: format, typecheck, lint, and tests pass (505 passed, 10 skipped); five new tests cover the section the menu marks and fail when the foot rule or the early margin is removed; the web export builds.
Evidence: Baseline `77d925b`; driven once in the web export on the fake harness at 1440px ([proof](verification/2026-11-10-workshop.md)); not proven: the look, which awaits the owner, the narrow window (a row menu and no guide), and that choosing a section near the page's foot marks that section rather than the last one.

## CHG-0102 · 2026-11-10 · Images attached to the owner's messages

Type: Documentation
Event: Agreement
Scope: Message attachments

Summary: The owner asked to attach media to a message, starting with an image pasted from the clipboard, and to see how the products in the inspirations handle it.
The owner chose: paste, drop, and a file picker through one step; every message the owner sends (messages between threads are a later batch); upload first and then reference, as OpenBot does; and a refusal to send when the harness or model cannot read images.
This reverses thread-messaging's exclusion of attachments for the owner's messages and adds the capability message-attachments.
References: documentation/capabilities/message-attachments/specifications.md, documentation/inspirations.md, documentation/capabilities/thread-messaging/specifications.md.
Validation: The owner's answers of 2026-11-10 to the batch questions.
Evidence: Claude Code 2.1.311 (stream-json image block) and Codex 0.160.1 (`localImage` from outside the folder, `model/list` with `inputModalities`) each answered the colour of a one-colour image in a live turn; OpenCode 2.2.0 advertises `promptCapabilities.image` through ACP `initialize` and reports no per-model vision.

## CHG-0103 · 2026-11-10 · Images on the owner's messages built; a large paste no longer freezes the window; the service starts again

Type: Feature
Event: Delivery
Scope: Message attachments, message box

Summary: Images attach to the owner's messages by paste, drop, or a file button, show as thumbnails with a × above the box and on the sent message, and reach Claude Code, Codex, and OpenCode in their own forms; a Companion that cannot read images refuses the message.
Pasting a very large text (17,000 lines froze the window) now goes in as one text node above 20,000 characters.
The service failed to start with `Service not found: gild/AttachmentsRoot`; the draft sweep is now given the root.
References: documentation/capabilities/message-attachments/specifications.md, documentation/changelog.md (CHG-0102).
Validation: Typecheck, Biome, and 545 tests pass; the window was driven on a throwaway data folder with the fake harness.
Evidence: [message-attachments proof](verification/2026-11-10-message-attachments.md).
Open: the look awaits the owner; undo does not take back a large paste in one step; OpenCode was not run live.

## CHG-0104 · 2026-11-10 · Agent replies drawn as Markdown

Type: Feature
Event: Delivery
Scope: Conversation

Summary: A reply from the Companion, and a message from another thread, showed its Markdown as typed (`**bold**`, `` `code` ``, `-` lists). They now draw as paragraphs, nested lists, bold, italic, struck text, inline and fenced code, headings, quotes, tables, and links, in the guild's type.
A link opens only for `http:`, `https:`, and `mailto:`; a reply is untrusted text, so any other scheme shows as plain text.
Dependency: `marked` (pure JavaScript, no native code) lexes the text; neither the platform nor the Effect ecosystem parses Markdown, and a hand-written parser would miss the edge cases of nested lists and emphasis. The drawing is our own, in `apps/app/src/markdown.tsx`, so it stays portable to native.
References: apps/app/src/{markdown.tsx,markdownRules.ts,conversationEntries.tsx}, apps/app/test/markdownRules.test.ts.
Validation: Typecheck and Biome pass; the new tests (link schemes, list markers) pass with the app's others.
Evidence: The text of the owner's screenshot, with extra headings, quote, code, table, and links, was rendered once in a browser through `react-native-web` and read by eye; not driven in the running window, and not checked on native.
Open: the look awaits the owner; the owner's own messages stay plain text with chips.
