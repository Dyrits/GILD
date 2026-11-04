# Handoff: specify the next OpenMission capability

Supersedes: `2026-11-04-1251-specify-next-capability.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`, remote `origin` = git@github.com:Dyrits/OPEN-MISSION.git (private)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep specifying OpenMission's capabilities, one at a time, until the version 1 scope is agreed. Done for the next session means one more capability, chosen with the user, has an agreed `documentation/capabilities/<capability>/specifications.md` and a changelog Agreement record, committed.

## State

- Nothing is built; the repository holds documentation only. Verified: listed `documentation/`.
- Specified: `thread-tree`, `thread-messaging`, `mission-journal`, `scoped-intel`, `mission-tracking`, `mission-coordination`. Verified: the six `specifications.md` files exist; the changelog holds CHG-0001 to CHG-0009.
- This session specified `mission-coordination` (Control) in an interview with questions Q1 to Q22 over 3 rounds, recorded as CHG-0009. It also:
  - let threads message any thread or mission they reference with `@`, across missions (thread-messaging, decision record 0005 amended);
  - renamed "Mission journal" to Journal and "Mission dashboard" to Dashboard in the glossary and all documents except the changelog's history; the capability name `mission-journal` and tool names stay;
  - made the documents consistent with Control: a mission is a top thread other than Control (glossary, thread-tree), and `architecture.md` has a corrected thread message flow and a new Control flow;
  - added the "Desktop shell and service runtime" item to `documentation/backlog.md`.
  Verified: `grep` finds no "mission journal" or "mission dashboard" outside the changelog, the glossary's _Avoid_ lines, and the `mission-journal` capability title.
- This session's work is committed and pushed together with this handoff, in the commit after `4f8f669`. Assumed: the commit is made right after this file is written; check `git log` and `git status -sb`.

## Decisions

All agreed behavior is in the specifications, glossary, backlog, and changelog. Only what those do not record is listed here.

**Working style the user expects**
- Settle decisions through numbered interview rounds. Each question uses the line `❓ **Qn** - **title**: <the question itself, ending with a question mark>`, then a `➡️` line with the recommended answer and its reason, with `---` between questions. A "yes" or "agree to all" accepts the recommendations. Numbering restarts at Q1 for each capability.
- Every question must be a real, complete question. When a round needs background, give it first in short, plain sentences with an example, then ask.
- Ask only what is unresolved, and recommend from evidence. When the user asks how other tools do something, check their documentation first.
- Write each item down as soon as it is settled, in a draft specification with an "Open decisions" section, then complete it.
- After a specification, review the whole documentation for consistency (other specifications, glossary, architecture, decision records) and fix what the new capability contradicts; record those fixes in the same changelog entry.
- The user prefers short, plain answers and simple terms over new coined ones. Commit only when the user says so.

**Tools and packages**
- Bun for package management and scripts; never pnpm. Recorded in `documentation/architecture.md`.

**GitHub access**
- The user's personal `gh` sign-in (`GH_CONFIG_DIR=~/.config/gh`, SSH, `repo` scope) created and pushes this repository. The OpenBot GitHub sign-in cannot create repositories.

## Next

1. Ask the user which capability to specify next. Candidates from `documentation/outline.md`: `action-approval` (referenced as a dependency by thread-messaging, scoped-intel, and mission-coordination), `budget-control` (referenced by thread-tree and mission-tracking), `thread-handover`, `workspace-attachment`, `tool-and-skill-loading`, `routine-running`, `workflow-running`, `device-pairing`, and the unnamed thread panel and context gauge in the backlog. Recommended: `action-approval`, since three specifications already depend on it.
2. Read `AGENTS.md`, the outline, requirements, glossary, architecture, the decision records the capability touches, and the existing specifications as a template (`documentation/capabilities/mission-coordination/specifications.md` is the latest).
3. Draft what is already agreed, interview on the rest, then write the specification and the changelog record (next number CHG-0010), link it from `outline.md`, update the backlog, review the documents for consistency, and commit when the user approves.

## Open questions

- **Control's tool names**: `open_mission`, `act_on_mission`, and `read_control_history` in the mission-coordination specification were proposed by the agent, not discussed; the workspace choice by Control and the first sentence of each journal summary in the dashboard as text were also filled in. The user saw them listed before asking to commit; raise them again only if the user asks.
- **Desktop shell and service runtime**: Electron with Node versus Tauri with a Bun-compiled sidecar (or Electrobun), to settle with the prototype described in `documentation/backlog.md`. The user asked about it but has not decided.
- **Thread worktrees**, deferred in `documentation/backlog.md`.
- **Desktop UI quality with React Native**: discussion and the proposed prototype are in `2026-11-04-0118-specify-journal-and-intel.md`, under Open questions. The user wants to discuss it in a later session.

## Sources

- `AGENTS.md`: index of the project documents.
- `documentation/outline.md`, `requirements.md`, `glossary.md`, `architecture.md`, `backlog.md`, `changelog.md`
- `documentation/architecture-decision-record/0001`–`0010`
- `documentation/capabilities/*/specifications.md` (six capabilities)
- Repository: https://github.com/Dyrits/OPEN-MISSION
