# Handoff: specify the next OpenMission capability

Supersedes: `2026-11-04-0118-specify-journal-and-intel.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`, remote `origin` = git@github.com:Dyrits/OPEN-MISSION.git (private)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep specifying OpenMission's capabilities, one at a time, until the version 1 scope is agreed. Done for the next session means one more capability, chosen with the user, has an agreed `documentation/capabilities/<capability>/specifications.md` and a changelog Agreement record, committed.

## State

- Nothing is built; the repository holds documentation only. Verified: listed `documentation/`.
- Specified: `thread-tree`, `thread-messaging`, `mission-journal`, `scoped-intel`. Verified: the four `specifications.md` files exist; the changelog holds CHG-0001 to CHG-0007.
- This session added CHG-0005 (folding threads opened by agents), CHG-0006 (mission journal), and CHG-0007 (scoped intel, plus the thread-tree starting-context warning). Verified: read `documentation/changelog.md`.
- This session's work is committed and pushed together with this handoff, in the commit after `390880d`. Assumed: the commit is made right after this file is written; check `git log` and `git status -sb`.

## Decisions

All agreed behavior is in the specifications, glossary, backlog, and changelog. Only what those do not record is listed here.

**Working style the user expects**
- Settle decisions through numbered interview rounds. Each question uses the line `❓ **Qn** - **title**: <the question itself, ending with a question mark>`, then a `➡️` line with the recommended answer and its reason, with `---` between questions. A "yes" accepts the recommendation.
- Every question must be a real, complete question. The user found title-only questions unclear. When a round needs background, give it first in short, plain sentences with an example, then ask.
- Ask only what is unresolved, and recommend from evidence. When the user asks how other tools do something, check their documentation first (Hermes Agent's memory docs were used for scoped-intel).
- Write each item down as soon as it is settled.
- Use glossary terms. "An intel" and "intels" replace "intel entry". "Control" is the agreed name for the orchestration thread.
- Commit only when the user says so. The user prefers short, plain answers.

**Tools and packages**
- The user never uses pnpm. Do not assume it, and do not use it in examples.

**GitHub access**
- The user's personal `gh` sign-in (`GH_CONFIG_DIR=~/.config/gh`, SSH, `repo` scope) created and pushes this repository. The OpenBot GitHub sign-in cannot create repositories.

## Next

1. Ask the user about the open question on pnpm below, and fix `documentation/architecture.md` if needed.
2. Ask the user which capability to specify next. Candidates, from `documentation/outline.md` and `documentation/backlog.md`:
   - `mission-tracking`, which now includes the backlog item on ending missions (mark done by hand, archive after a while, ask after X days without activity);
   - `mission-coordination` (Control), whose open points are in the backlog;
   - `workspace-attachment`, `tool-and-skill-loading`, `action-approval`, `budget-control`, `thread-handover`;
   - the thread panel and context gauge in the backlog, which has no capability name yet.
3. Read `AGENTS.md`, the outline, requirements, glossary, architecture, the decision records the capability touches, and the existing specifications as a template.
4. Draft what is already agreed, interview on the rest, then write the specification and the changelog record (next number CHG-0008), link it from `outline.md`, and commit when the user approves.

## Open questions

- **pnpm in the architecture.** `documentation/architecture.md` says "TypeScript everywhere, in one pnpm workspace", but the user never uses pnpm. That line likely came from a wrong assumption. Only the user can say which package manager the workspace uses.
- **Thread worktrees**, deferred in `documentation/backlog.md`.
- **Desktop UI quality with React Native.** Discussion and the proposed prototype are in the superseded handoff, under Open questions. The user wants to discuss it in a later session.

## Sources

- `AGENTS.md`: index of the project documents.
- `documentation/outline.md`, `requirements.md`, `glossary.md`, `architecture.md`, `backlog.md`, `changelog.md`
- `documentation/architecture-decision-record/0001`–`0010`
- `documentation/capabilities/thread-tree/specifications.md`
- `documentation/capabilities/thread-messaging/specifications.md`
- `documentation/capabilities/mission-journal/specifications.md`
- `documentation/capabilities/scoped-intel/specifications.md`
- Hermes Agent memory documentation: https://hermes-agent.nousresearch.com/docs/user-guide/features/memory
- Repository: https://github.com/Dyrits/OPEN-MISSION
