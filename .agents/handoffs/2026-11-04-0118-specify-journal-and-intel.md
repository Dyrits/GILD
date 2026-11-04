# Handoff: specify mission-journal and scoped-intel

Supersedes: none
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`, remote `origin` = git@github.com:Dyrits/OPEN-MISSION.git (private)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Specify the next two OpenMission capabilities, `mission-journal` and `scoped-intel`. Done means each has an agreed `documentation/capabilities/<capability>/specifications.md` with behavior, edge cases, external contract (thread tools), acceptance, requirement references, dependencies, and exclusions, plus a changelog Agreement record, authorized by the user and committed.

## State

- Nothing is built; the repository holds documentation only. Verified: listed `documentation/` and read `git log`.
- Three commits on `main`, pushed, local in sync with `origin/main`: `43b6fa3` (outline, requirements, glossary, architecture, decision records 0001–0010), `f690724` (thread-tree and thread-messaging specifications, backlog, changelog), `ca104fd` (asides and mission discovery). Verified: `git fetch` then `git status -sb` showed `main...origin/main`.
- Specified so far: `thread-tree` and `thread-messaging`. Verified: the two `specifications.md` files exist; changelog records CHG-0001 to CHG-0004.
- `mission-journal` and `scoped-intel` have no specification folder yet. Their one-line definitions are in `documentation/outline.md` and their terms (Mission journal, Intel, Intel scope) in `documentation/glossary.md`. Verified: `ls documentation/capabilities` shows only the two specified capabilities.
- Not committed: this handoff and the `AGENTS.md` pointer to it.

## Decisions

All recorded decisions live in the Sources. These were agreed in conversation and bear directly on the next two capabilities. Each is recorded where noted.

**Mission journal**
- The journal is a summary, rewritten as the mission changes, plus a dated change log that is only ever added to. Recorded in `glossary.md`.
- Every thread in the mission starts from the journal, and any thread in it may update it. Summary changes are recorded in the change log with their author thread. The user can edit it. The authorship and editing parts are agreed in conversation; `glossary.md` and the architecture's "Journal update" flow record the rest.
- A new thread starts with the opener's messages since the journal's last change log entry. Recorded in `capabilities/thread-tree/specifications.md`.
- An aside starts with the journal summary but never updates the journal itself: it informs its parent, and the parent decides what to record. Recorded in the thread-tree specification and CHG-0003.
- `find_missions` matches other missions by title and journal summary only. Recorded in the thread-tree specification and CHG-0004.

**Intel**
- Intel is the term for saved facts, preferences, and decisions; "memory" is avoided. Recorded in `glossary.md`.
- Intel has three scopes: a thread (and the threads beneath it), a workspace, or global.
- Proposed earlier, never formally settled, so confirm with the user:
  - lookup goes from the thread, through its parents, then the workspace, then global, and the most specific entry wins;
  - the agent proposes the narrowest scope when saving;
  - global saves are visible to the user or need approval;
  - intel can be promoted to a wider scope, for example when a mission ends;
  - the journal and intel stay separate, so a journal holds "where the mission stands" and intel holds "facts worth keeping".

**Storage and tools**
- Storage is SQLite with full-text search for intel; `sqlite-vec` comes later if semantic search is needed. Recorded in `architecture.md` and decision record 0002.
- Thread tools are served over MCP and include journal and intel tools. Their names are not yet fixed. Recorded in decision record 0005.

**Working style the user expects**
- Settle decisions through numbered interview rounds. Each question uses the ❓ **Qn** - **title** line, then ➡️ followed by a recommended answer, with `---` between questions. A "yes" accepts the recommendation.
- Ask only what is unresolved, and recommend from evidence.
- Write each item down as soon as it is settled.
- Use glossary terms: Mission, Thread, Turn, Harness, Agent, Model, Effort, Aside, Steer, Intel.
- Commit only when the user says so. The user prefers short, plain answers.

**GitHub access**
- The OpenBot GitHub sign-in (`GH_CONFIG_DIR` under `~/Library/Application Support/OpenBot/provider-state/github/gh`) cannot create repositories.
- The user's personal `gh` sign-in (`GH_CONFIG_DIR=~/.config/gh`, SSH, `repo` scope) created and pushed this repository.

## Next

1. Confirm with the user that the next focus is specifying `mission-journal` and then `scoped-intel`, and whether to do both in one interview.
2. Read `AGENTS.md`, then `documentation/outline.md`, `requirements.md`, `glossary.md`, `architecture.md`, decision records 0002 and 0005, and both existing specifications. Use those specifications as the template for structure.
3. Draft what is already agreed for `mission-journal`, then interview on the open decisions:
   - when threads must update the journal;
   - how large the summary may grow, and who compacts it;
   - conflicting updates from parallel threads;
   - how the user edits it, and how that shows in the change log;
   - the journal of a Done mission;
   - the tool names and their arguments.
4. Do the same for `scoped-intel`:
   - confirm the unsettled proposals listed under Decisions;
   - what counts as an intel entry versus an instruction;
   - deleting and correcting intel;
   - limits;
   - recall at a thread's start versus on demand;
   - the tool names.
5. Write each `specifications.md` and changelog record (next number CHG-0005), link the capabilities from `outline.md`, add any new terms to `glossary.md`, and commit when the user approves.

## Open questions

- The open decisions in Next steps 3 and 4. Only the user can settle them.
- The thread-worktree question, in `documentation/backlog.md`. It is deferred and not part of this focus.
- **Desktop UI quality with React Native.** The user asked whether React Native allows a nice desktop UI, and wants to discuss it in a later session. It is not part of this focus. Discussion so far:
  - **Answer given:** yes, if desktop is designed for from the start. Bluesky ships a web app from Expo and React Native for Web; Paseo's desktop is its Expo web build inside Electron (its polish was not checked).
  - **Weak spots and their usual fixes:**
    - hover, focus, and cursors: a styling library that compiles to CSS on the web, such as Tamagui or NativeWind;
    - dense and responsive layouts: their media queries, plus `.web.tsx` files;
    - keyboard shortcuts and right-click menus: Electron's native menus plus a keyboard layer;
    - resizable panes, virtualized lists, and code, diff, and terminal views: Expo DOM components hosting web libraries.
  - **Alternative raised:** a separate React web app for desktop that shares only logic packages with the Expo phone app. It would mean building every screen twice and would revisit decision record 0009.
  - **Proposed, not approved:** a one-day prototype to settle it. One Expo app with a thread tree, a resizable two-pane thread view, a diff panel as a DOM component, and keyboard shortcuts, run in Electron and in a phone browser. The user decides whether to run it.

## Sources

- `AGENTS.md`: index of the project documents.
- `documentation/outline.md`, `requirements.md`, `glossary.md`, `architecture.md`, `backlog.md`, `changelog.md`
- `documentation/architecture-decision-record/0001`–`0010`
- `documentation/capabilities/thread-tree/specifications.md`
- `documentation/capabilities/thread-messaging/specifications.md`
- Repository: https://github.com/Dyrits/OPEN-MISSION
- Reference projects that were studied:
  - MausBot: https://github.com/milind-soni/openmausbot, Apache 2.0 except `enterprise/`. Its memory journal and intel-like files are in `server/memory-*`.
  - Paseo: https://github.com/getpaseo/paseo, Apache 2.0.
  - OpenBot: https://github.com/nightly-labs/openbot. Its PolyForm Noncommercial license allows reading only; do not copy its code.
