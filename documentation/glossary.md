# OpenMission

OpenMission organizes a person's work with AI agents as missions carried out in trees of threads, where any thread can open further threads on any harness, model, and effort, and threads talk to each other in both directions.

## Work

**Mission**:
A top-level thread together with every thread opened beneath it. A quick chat is a mission too.
_Avoid_: Goal, objective, task, ticket, project

**Thread**:
The unit of work: a conversation with its own identifier, carried out by one harness at a time, and optionally opened beneath a parent thread.
_Avoid_: Sub-thread, child thread, chat, conversation, session

**Turn**:
One exchange in a thread, recording the harness, agent, model, and effort that produced it.
_Avoid_: Step, round

**Aside**:
A thread opened beneath the current one for an off-topic request the user chose to keep in the mission, starting fresh with only that request and kept out of the mission journal.
_Avoid_: Side thread, tangent

**Thread message**:
A message one thread sends another, in either direction along the tree, that can ask for a reply.
_Avoid_: Ping, notification

**Steer**:
To deliver a message into a thread's current turn, changing its course without waiting for the turn to end. Its counterpart is to queue the message for the next turn.
_Avoid_: Inject, nudge

**Mission journal**:
The record a mission keeps as it evolves: a summary of where it stands, rewritten as it changes, and a dated change log only ever added to. Every thread in the mission starts from it and may update it.
_Avoid_: Mission memory, mission history, brief

**Mission dashboard**:
The overview of all missions with their state, threads, and spending.
_Avoid_: Board, kanban

**Workspace**:
A folder or repository on the user's computer that a thread can be attached to.
_Avoid_: Project, repo, directory

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

**Budget**:
A spending limit on a mission or thread that the threads beneath it draw from.
_Avoid_: Quota, cap

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
A saved fact, preference, or decision, held at one intel scope. One item is an intel entry.
_Avoid_: Memory, note, knowledge, lore

**Intel scope**:
Where an intel entry lives and who sees it: a thread (and the threads beneath it), a workspace, or global.

## Devices

**Paired device**:
A phone connected to the user's OpenMission by scanning a pairing code.
_Avoid_: Remote, client

**Pairing code**:
The one-time QR code the computer shows to pair a phone.
_Avoid_: Connect code, ticket
