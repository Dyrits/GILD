# Handoff: specify the next OpenMission capability

Supersedes: `2026-11-04-1547-specify-next-capability.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`, remote `origin` = git@github.com:Dyrits/OPEN-MISSION.git (private)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Specify the capabilities a first build needs, then start building. Done for the next session means `tool-and-skill-loading` has an agreed `documentation/capabilities/tool-and-skill-loading/specifications.md` and a changelog Agreement record (CHG-0013), committed.

## State

- Nothing is built; the repository holds documentation only. Verified: listed `documentation/`.
- Specified: `thread-tree`, `thread-messaging`, `mission-journal`, `scoped-intel`, `mission-tracking`, `mission-coordination`, `action-approval`, `budget-control`, `workspace-attachment`. Verified: nine folders in `documentation/capabilities/`; the changelog holds CHG-0001 to CHG-0012.
- This session specified `workspace-attachment` (CHG-0012) in 4 rounds (Q1 to Q22), with consistency fixes to the glossary (Workspace, new Browsable root, Scratch folder, Own copy; Attention), outline, architecture (Workspace flow, Git integration), backlog, thread-tree, mission-coordination, scoped-intel, and action-approval. Verified: files edited and `git status` read.
- This session's work is committed and pushed with this handoff. Assumed: the commit follows right after this file is written; check `git log` and `git status -sb`.

## Decisions

All agreed behavior is in the specifications, requirements, glossary, and changelog. Only what those do not record is listed here.

**Working style the user expects**
- Settle decisions through numbered interview rounds. Each question uses the line `❓ **Qn** - **title**: <the question itself, ending with a question mark>`, then a `➡️` line with the recommended answer and its reason, with `---` between questions. A "yes" accepts the recommendation. Numbering restarts at Q1 for each capability.
- Every question must be a real, complete question. When a round needs background, give it first in short, plain sentences with an example, then ask.
- The user often answers only partly, with an idea, or with a doubt ("I'm not sure"). Restate your reading, write down what is settled, and re-ask or recommend for the rest.
- The user takes OpenBot, Delta (delta.dev), and Zed as models for behavior and UI. Use them as evidence, without copying.
- Write each item down as soon as it is settled in the draft's "Settled in the interview" and "Open decisions" sections, then complete the specification and list the items the agent filled in without discussion.
- After a specification, review the whole documentation for consistency and record the fixes in the same changelog entry.
- Short, plain answers and simple terms. Commit only when the user says so.

**Order toward a first build** (agreed this session)
- Specify `workspace-attachment` (done), then `tool-and-skill-loading`; then design and build a first slice: missions, the thread tree, and thread messaging on one harness, adding journal, intel, approvals, and budgets after.
- The desktop shell and runtime prototype (backlog) can wait: the user holds the runtime is easy to change. Keep it cheap to change: put SQLite behind one small storage layer, keep Electron-only features out of the UI, and run the prototype before the first release.

**Tools and packages**
- Bun for package management and scripts; never pnpm. Recorded in `documentation/architecture.md`.

**GitHub access**
- The user's personal `gh` sign-in (`GH_CONFIG_DIR=~/.config/gh`, SSH, `repo` scope) pushes this repository.

## Next

1. Confirm with the user, then specify `tool-and-skill-loading`: giving every thread, whatever its harness, the global and workspace MCP servers, the thread tools, and the skills in scope. Already fixed elsewhere: skill locations and narrower-scope-wins in `documentation/architecture.md` (Integrations), skills scoped to a thread and the threads beneath it in the glossary, workspace instructions from `AGENTS.md`, `CLAUDE.md`, `.agents`, `.claude` in the workspace-attachment spec, thread tools over MCP in decision record 0005.
2. Read `AGENTS.md`, the outline, requirements, glossary, architecture, decision records 0005 and 0008, and `documentation/capabilities/workspace-attachment/specifications.md` as the latest template.
3. Draft, interview, write the specification and CHG-0013, link it from the outline, review for consistency, commit when the user approves.
4. Then design the first slice (modules, data model, test seams) before any code.

## Open questions

- **Filled in by the agent in workspace-attachment, not discussed**: clone location defaults to `~/Code`; a failed clone is refused with git's reason; Hide and Delete permanently are refused while a thread of the workspace runs; cloning uses the computer's git sign-in. Q20 was read as keeping Own copy in version 1 with a one-button merge, Q21 as keeping workspace intel in OpenMission's data instead of a `.openmission` folder. The user saw these before asking to commit.
- **Filled in by the agent in earlier capabilities**: see the superseded handoffs' Open questions; same status.
- **Desktop shell and service runtime**: Electron with Node versus Tauri with a Bun sidecar (or Electrobun), prototype in `documentation/backlog.md`. Undecided.
- **Desktop UI quality with React Native**: see `2026-11-04-0118-specify-journal-and-intel.md`, Open questions. The user wants to discuss it later.
- **Zed's DeltaDB**: could replace own copies if published as open source; only secondary reports of a plan as of 2026-11-04 (https://hermes-ai.net/news/zed-industries-deltadb-links-every-agent-code-edit-to-its-conversation/). In the backlog.

## Sources

- `AGENTS.md`: index of the project documents.
- `documentation/outline.md`, `requirements.md`, `glossary.md`, `architecture.md`, `backlog.md`, `changelog.md`
- `documentation/architecture-decision-record/0001`–`0010`
- `documentation/capabilities/*/specifications.md` (nine capabilities)
- Repository: https://github.com/Dyrits/OPEN-MISSION
