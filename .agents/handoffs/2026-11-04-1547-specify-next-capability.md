# Handoff: specify the next OpenMission capability

Supersedes: `2026-11-04-1513-specify-next-capability.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`, remote `origin` = git@github.com:Dyrits/OPEN-MISSION.git (private)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep specifying OpenMission's capabilities, one at a time, until the version 1 scope is agreed. Done for the next session means one more capability, chosen with the user, has an agreed `documentation/capabilities/<capability>/specifications.md` and a changelog Agreement record, committed.

## State

- Nothing is built; the repository holds documentation only. Verified: listed `documentation/`.
- Specified: `thread-tree`, `thread-messaging`, `mission-journal`, `scoped-intel`, `mission-tracking`, `mission-coordination`, `action-approval`, `budget-control`. Verified: the eight `specifications.md` files exist; the changelog holds CHG-0001 to CHG-0011.
- This session specified `budget-control` (CHG-0011) in an interview of 4 rounds (Q1 to Q19). The user changed the shape in Q3 and Q4: budgets live on missions, on Control, and as one global budget with a period, not on single threads. Consistency fixes went into the glossary (Budget, new Global budget, Attention), outline, architecture (new Budget flow), backlog, thread-tree, mission-tracking, and mission-coordination. Verified: `grep` finds no "mission or thread" or "thread budget" wording outside the changelog and the budget-control spec.
- This session's work is committed and pushed together with this handoff, in the commit after `8d3ad2b`. Assumed: the commit is made right after this file is written; check `git log` and `git status -sb`.

## Decisions

All agreed behavior is in the specifications, requirements, glossary, and changelog. Only what those do not record is listed here.

**Working style the user expects**
- Settle decisions through numbered interview rounds. Each question uses the line `❓ **Qn** - **title**: <the question itself, ending with a question mark>`, then a `➡️` line with the recommended answer and its reason, with `---` between questions. A "yes" accepts the recommendation. Numbering restarts at Q1 for each capability.
- Every question must be a real, complete question. When a round needs background, give it first in short, plain sentences with an example, then ask.
- The user often answers only some questions, or with an idea or a screenshot instead of yes or no. Restate your reading of it, write down what is settled, and re-ask the rest; for a name the user rejects, offer a few options as a multiple choice.
- The user takes OpenBot as the model for agent behavior and UI (autonomy, asking in the chat with buttons, no permission dialogs, rings around provider icons, the context window popover). Use it as evidence when recommending, without copying it.
- Write each item down as soon as it is settled, in the draft specification's "Settled in the interview" and "Open decisions" sections, then complete the specification.
- After a specification, review the whole documentation for consistency and fix what the new capability contradicts; record those fixes in the same changelog entry.
- The user prefers short, plain answers and simple terms over coined ones. Commit only when the user says so.

**Tools and packages**
- Bun for package management and scripts; never pnpm. Recorded in `documentation/architecture.md`.

**GitHub access**
- The user's personal `gh` sign-in (`GH_CONFIG_DIR=~/.config/gh`, SSH, `repo` scope) created and pushes this repository. The OpenBot GitHub sign-in cannot create repositories.

## Next

1. Ask the user which capability to specify next. Candidates from `documentation/outline.md`: `workspace-attachment` (referenced by scoped-intel and action-approval), `routine-running` (action-approval relies on routine instructions approving named actions), `thread-handover` (referenced by thread-tree and budget-control), `tool-and-skill-loading`, `workflow-running`, `device-pairing`, and the unnamed thread panel and context gauge in `documentation/backlog.md` (which now also decides whether the budget window joins the context gauge). Recommended: `workspace-attachment`, which two specifications and standing permissions already depend on.
2. Read `AGENTS.md`, the outline, requirements, glossary, architecture, the decision records the capability touches, and the existing specifications as a template (`documentation/capabilities/budget-control/specifications.md` is the latest).
3. Draft what is already agreed, interview on the rest, then write the specification and the changelog record (next number CHG-0012), link it from `outline.md`, update the backlog, review the documents for consistency, and commit when the user approves.

## Open questions

- **Filled in by the agent in budget-control, not discussed**: at a mission's limit every running thread in it stops and only the one that reached it asks; global budget events are recorded in Control; a handed-over thread keeps drawing on the same mission budget; exclusions for a subscription's own usage caps and for one limit per provider; the reading of Q16 as a budget window opened from a ring. The user saw them listed before asking to commit; raise them again only if the user asks.
- **Filled in by the agent in action-approval and mission-coordination**: listed in the superseded handoff's Open questions; same status.
- **Desktop shell and service runtime**: Electron with Node versus Tauri with a Bun-compiled sidecar (or Electrobun), to settle with the prototype in `documentation/backlog.md`. Undecided.
- **Thread worktrees**, deferred in `documentation/backlog.md`.
- **Desktop UI quality with React Native**: discussion and proposed prototype in `2026-11-04-0118-specify-journal-and-intel.md`, under Open questions. The user wants to discuss it in a later session.

## Sources

- `AGENTS.md`: index of the project documents.
- `documentation/outline.md`, `requirements.md`, `glossary.md`, `architecture.md`, `backlog.md`, `changelog.md`
- `documentation/architecture-decision-record/0001`–`0010`
- `documentation/capabilities/*/specifications.md` (eight capabilities)
- Repository: https://github.com/Dyrits/OPEN-MISSION
