# OpenMission

OpenMission organizes a person's work with AI agents as missions carried out in trees of threads, where any thread can open further threads on any harness, model, and effort, and threads talk to each other in both directions.

## Work

**Mission**:
A top-level thread other than Control, together with every thread opened beneath it. A quick chat is a mission too.
_Avoid_: Goal, objective, task, ticket, project

**Thread**:
The unit of work: a conversation with its own identifier, carried out by one harness at a time, and optionally opened beneath a parent thread.
_Avoid_: Sub-thread, child thread, chat, conversation, session

**Turn**:
One exchange in a thread, recording the harness, agent, model, and effort that produced it.
_Avoid_: Step, round

**Aside**:
A thread opened beneath the current one for an off-topic request the user chose to keep in the mission. It knows the mission's briefing and informs its parent when the conversation comes back to the mission, but does not update the journal itself.
_Avoid_: Side thread, tangent

**Thread message**:
A message one thread sends another, in either direction along the tree, or to any thread it references with `@`, that can ask for a reply.
_Avoid_: Ping, notification

**Steer**:
To deliver a message into a thread's current turn, changing its course without waiting for the turn to end. Its counterpart is to queue the message for the next turn.
_Avoid_: Inject, nudge

**Journal**:
The record a mission keeps as it evolves: its briefing and a dated change log only ever added to. Every thread in the mission starts from it and may update it.
_Avoid_: Mission journal, mission memory, mission history

**Briefing**:
The part of a journal that says where the mission stands, rewritten as it changes. Every thread in the mission reads it before it starts.
_Avoid_: Summary, journal summary, description, brief

**Dashboard**:
The one overview of all missions with their state, threads, spending, and the start of each briefing. Control reads it as text.
_Avoid_: Mission dashboard, index, mission list, board, kanban

**Control**:
The one permanent thread outside every mission that the user can talk to about anything. It opens a mission for each task and never does the work itself.
_Avoid_: Coordinator, dispatcher, orchestrator, main thread, Mission control

**Workspace**:
A folder or repository on the user's computer, chosen by the user or cloned by OpenMission, that a thread is attached to before it starts.
_Avoid_: Project, repo, directory

**Browsable root**:
A folder set in Settings under which the user and threads can browse and choose workspaces.
_Avoid_: Allowed folder, sandbox

**Scratch folder**:
The folder OpenMission keeps for each mission, where its threads with no workspace work.
_Avoid_: Temp folder, default workspace

**Own copy**:
A thread's own git worktree of a git workspace, on its own branch, shared by the threads beneath it and merged back with one button.
_Avoid_: Worktree, fork, sandbox

## Execution

**Harness**:
An agent runtime that carries out a thread's turns, such as Claude Code or Codex.
_Avoid_: Bot, engine, runner

**Agent**:
An agent definition offered by a harness, such as a Claude Code subagent, optionally chosen for a thread.
_Avoid_: Bot, persona, teammate

**Model**:
The language model a harness uses for a turn.

**Effort**:
The reasoning level a turn runs at.
_Avoid_: Reasoning level, thinking budget

**Provider**:
The account that bills model use, such as an Anthropic subscription or an OpenAI API key.
_Avoid_: Vendor

**Handover**:
A change of harness, agent, model, or effort in the middle of a thread, giving the new one the thread's full history.
_Avoid_: Switch, transfer

**Approval**:
The user's permission for one risky action in one thread.
_Avoid_: Consent, confirmation

**Standing permission**:
The user's permission for one kind of risky action, in a workspace, a mission, or everywhere, granted with Always allow and removable from the Permissions page.
_Avoid_: Rule, always-allow, grant

**Attention**:
The state of a thread that waits for the user: an approval, an answer, a decision after the chatter guard paused it, a budget reached, a missing workspace folder, or a tool or skill loading problem that prevents a turn.
_Avoid_: Needs you, blocked, pending

**Budget**:
A spending limit, in cost, tokens, or both, on a mission or on Control, that every thread in it draws on. Single threads have no budget.
_Avoid_: Quota, cap

**Global budget**:
The budget on all spending, across every mission and Control, over a day, week, or month.
_Avoid_: Total budget, monthly cap

## Automation

**Routine**:
A trigger paired with a skill or instruction, running in its own thread or opening new threads on each run.
_Avoid_: Job, cron, scheduled task

**Trigger**:
The schedule, webhook, or event that starts a routine run or a workflow run.

**Workflow**:
A graph of steps, each carried out as a thread, with conditions, approvals, and outputs.
_Avoid_: Pipeline, flow

**Workflow run**:
One pass through a workflow.

**Skill**:
A reusable, named set of instructions, available globally, in a workspace, or in the thread it was installed in and the threads beneath it.
_Avoid_: Plugin, recipe

**Instruction**:
Free text that tells a thread how to work, attached to a routine, workspace, or the whole system.
_Avoid_: Prompt, system prompt

## Intel

**Intel**:
A saved fact, preference, or decision, held at one intel scope. One item is an intel; several are intels.
_Avoid_: Memory, note, knowledge, lore

**Intel scope**:
Where an intel lives and who sees it: a thread (and the threads beneath it), a workspace, or global.

## Devices

**Paired device**:
A phone connected to the user's OpenMission by scanning a pairing code.
_Avoid_: Remote, client

**Pairing code**:
The one-time QR code the computer shows to pair a phone.
_Avoid_: Connect code, ticket
