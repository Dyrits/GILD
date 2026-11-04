# Handoff: specify the next OpenMission capability

Supersedes: `2026-11-04-1019-specify-next-capability.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`, remote `origin` = git@github.com:Dyrits/OPEN-MISSION.git (private)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep specifying OpenMission's capabilities, one at a time, until the version 1 scope is agreed. Done for the next session means one more capability, chosen with the user, has an agreed `documentation/capabilities/<capability>/specifications.md` and a changelog Agreement record, committed.

## State

- Nothing is built; the repository holds documentation only. Verified: listed `documentation/`.
- Specified: `thread-tree`, `thread-messaging`, `mission-journal`, `scoped-intel`, `mission-tracking`. Verified: the five `specifications.md` files exist; the changelog holds CHG-0001 to CHG-0008.
- This session added `mission-tracking` (CHG-0008), linked it from `outline.md`, removed the "Ending missions" item from `backlog.md`, and changed `architecture.md` from a pnpm workspace to a Bun workspace (Bun for package management and scripts; Node still runs the local service). Verified: `git diff --stat` before committing.
- This session's work is committed and pushed together with this handoff, in the commit after `2db68f1`. Assumed: the commit is made right after this file is written; check `git log` and `git status -sb`.
- Interview questions this session were numbered Q1 to Q12 (rounds 1 to 3); the next capability may restart at Q1, as CHG-0008's Evidence line shows the numbering is per interview.

## Decisions

All agreed behavior is in the specifications, glossary, backlog, and changelog. Only what those do not record is listed here.

**Working style the user expects**
- Settle decisions through numbered interview rounds. Each question uses the line `❓ **Qn** - **title**: <the question itself, ending with a question mark>`, then a `➡️` line with the recommended answer and its reason, with `---` between questions. A "yes" or "agree to all" accepts the recommendations.
- Every question must be a real, complete question. When a round needs background, give it first in short, plain sentences with an example, then ask.
- Ask only what is unresolved, and recommend from evidence. When the user asks how other tools do something, check their documentation first.
- Write each item down as soon as it is settled: this session drafted the specification after round 2 and completed it after round 3.
- Use glossary terms. "An intel" and "intels" replace "intel entry". "Control" is the agreed name for the orchestration thread.
- Commit only when the user says so. The user prefers short, plain answers.

**Tools and packages**
- Bun for package management and scripts; never pnpm. Recorded in `documentation/architecture.md`.

**GitHub access**
- The user's personal `gh` sign-in (`GH_CONFIG_DIR=~/.config/gh`, SSH, `repo` scope) created and pushes this repository. The OpenBot GitHub sign-in cannot create repositories.

## Next

1. Ask the user which capability to specify next. Recommended: `mission-coordination` (Control), since it opens missions and reports how they stand, building on mission-tracking; its open points are in `documentation/backlog.md` (whether it has a journal or intel, and how it hears back from missions). Other candidates from `documentation/outline.md` and the backlog: `workspace-attachment`, `tool-and-skill-loading`, `action-approval`, `budget-control`, `thread-handover`, `routine-running`, `workflow-running`, `device-pairing`, and the unnamed thread panel and context gauge.
2. Read `AGENTS.md`, the outline, requirements, glossary, architecture, the decision records the capability touches, and the existing specifications as a template (`documentation/capabilities/mission-tracking/specifications.md` is the latest).
3. Draft what is already agreed, interview on the rest, then write the specification and the changelog record (next number CHG-0009), link it from `outline.md`, update the backlog, and commit when the user approves.

## Open questions

- **Thread worktrees**, deferred in `documentation/backlog.md`.
- **Desktop UI quality with React Native.** Discussion and the proposed prototype are in `2026-11-04-0118-specify-journal-and-intel.md`, under Open questions. The user wants to discuss it in a later session.

## Sources

- `AGENTS.md`: index of the project documents.
- `documentation/outline.md`, `requirements.md`, `glossary.md`, `architecture.md`, `backlog.md`, `changelog.md`
- `documentation/architecture-decision-record/0001`–`0010`
- `documentation/capabilities/thread-tree/specifications.md`
- `documentation/capabilities/thread-messaging/specifications.md`
- `documentation/capabilities/mission-journal/specifications.md`
- `documentation/capabilities/scoped-intel/specifications.md`
- `documentation/capabilities/mission-tracking/specifications.md`
- Repository: https://github.com/Dyrits/OPEN-MISSION
