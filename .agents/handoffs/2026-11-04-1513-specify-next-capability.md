# Handoff: specify the next OpenMission capability

Supersedes: `2026-11-04-1358-specify-next-capability.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`, remote `origin` = git@github.com:Dyrits/OPEN-MISSION.git (private)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep specifying OpenMission's capabilities, one at a time, until the version 1 scope is agreed. Done for the next session means one more capability, chosen with the user, has an agreed `documentation/capabilities/<capability>/specifications.md` and a changelog Agreement record, committed.

## State

- Nothing is built; the repository holds documentation only. Verified: listed `documentation/`.
- Specified: `thread-tree`, `thread-messaging`, `mission-journal`, `scoped-intel`, `mission-tracking`, `mission-coordination`, `action-approval`. Verified: the seven `specifications.md` files exist; the changelog holds CHG-0001 to CHG-0010.
- This session specified `action-approval` (CHG-0010) in an interview of 5 rounds (Q1 to Q22, Q1 and Q7 replaced by Q10). It also, at the user's request:
  - relaxed the requirement Approval per action to allow standing permissions, keeping the old wording in `documentation/requirements.md`;
  - renamed the thread state Needs you to Attention, and the journal's summary to Briefing, in every document except the changelog's history; added glossary terms Briefing, Standing permission, Attention;
  - updated the architecture's Approval flow and requirement row, and linked action-approval from the specifications that depend on it.
  Verified: `grep` finds "Needs you" and "journal summary" only in the changelog and the glossary's _Avoid_ lines.
- This session's work is committed and pushed together with this handoff, in the commit after `e2101b6`. Assumed: the commit is made right after this file is written; check `git log` and `git status -sb`.

## Decisions

All agreed behavior is in the specifications, requirements, glossary, and changelog. Only what those do not record is listed here.

**Working style the user expects**
- Settle decisions through numbered interview rounds. Each question uses the line `❓ **Qn** - **title**: <the question itself, ending with a question mark>`, then a `➡️` line with the recommended answer and its reason, with `---` between questions. A "yes" accepts the recommendation. Numbering restarts at Q1 for each capability.
- Every question must be a real, complete question. When a round needs background, give it first in short, plain sentences with an example, then ask.
- The user often answers only some questions or answers with an idea instead of yes or no. Restate your reading of it, write down what is settled, and re-ask the rest; for a name the user rejects, offer a few options as a multiple choice.
- The user takes OpenBot as the model for agent behavior (autonomy, asking in the chat with buttons, no permission dialogs). Use it as evidence when recommending.
- Write each item down as soon as it is settled, in the draft specification's "Open decisions" section, then complete it.
- After a specification, review the whole documentation for consistency and fix what the new capability contradicts; record those fixes in the same changelog entry.
- The user prefers short, plain answers and simple terms over coined ones. Commit only when the user says so.

**Tools and packages**
- Bun for package management and scripts; never pnpm. Recorded in `documentation/architecture.md`.

**GitHub access**
- The user's personal `gh` sign-in (`GH_CONFIG_DIR=~/.config/gh`, SSH, `repo` scope) created and pushes this repository. The OpenBot GitHub sign-in cannot create repositories.

## Next

1. Ask the user which capability to specify next. Candidates from `documentation/outline.md`: `budget-control` (referenced by thread-tree and mission-tracking), `workspace-attachment` (referenced by scoped-intel and action-approval), `routine-running` (action-approval relies on routine instructions approving named actions), `thread-handover`, `tool-and-skill-loading`, `workflow-running`, `device-pairing`, and the unnamed thread panel and context gauge in `documentation/backlog.md`. Recommended: `budget-control`, the last core safety capability that two specifications already depend on.
2. Read `AGENTS.md`, the outline, requirements, glossary, architecture, the decision records the capability touches, and the existing specifications as a template (`documentation/capabilities/action-approval/specifications.md` is the latest).
3. Draft what is already agreed, interview on the rest, then write the specification and the changelog record (next number CHG-0011), link it from `outline.md`, update the backlog, review the documents for consistency, and commit when the user approves.

## Open questions

- **Filled in by the agent in action-approval, not discussed**: standing permissions reach threads through their starting context; the arguments and answers of `request_approval`; discarded and withdrawn questions recorded in the history; the exclusion stating that the default level cannot stop an action a thread fails to see as risky. The user saw them listed before asking to commit; raise them again only if the user asks.
- **Control's tool names** (`open_mission`, `act_on_mission`, `read_control_history`) were proposed by the agent in mission-coordination; same status.
- **Desktop shell and service runtime**: Electron with Node versus Tauri with a Bun-compiled sidecar (or Electrobun), to settle with the prototype in `documentation/backlog.md`. Undecided.
- **Thread worktrees**, deferred in `documentation/backlog.md`.
- **Desktop UI quality with React Native**: discussion and proposed prototype in `2026-11-04-0118-specify-journal-and-intel.md`, under Open questions. The user wants to discuss it in a later session.

## Sources

- `AGENTS.md`: index of the project documents.
- `documentation/outline.md`, `requirements.md`, `glossary.md`, `architecture.md`, `backlog.md`, `changelog.md`
- `documentation/architecture-decision-record/0001`–`0010`
- `documentation/capabilities/*/specifications.md` (seven capabilities)
- Repository: https://github.com/Dyrits/OPEN-MISSION
