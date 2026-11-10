# Work in progress

## Desktop packaging automation · 2026-11-10 · locally verified, GitHub run pending

Authorized by the owner's request to package on pushes to `main`, starting at `51d4ceb44a8fad62fbea27acb233856d6cb1c777`.
The batch adds GitHub Actions artifacts for Apple Silicon and Intel DMGs, a Windows x64 NSIS installer, and a Linux x64 AppImage, using the existing Electron Builder setup.
Verification: local lint, workspace typecheck, actionlint, macOS arm64 packaging, and bundle signature verification passed; see [proof](verification/2026-11-10-desktop-packaging.md).
Next: publish the workflow, inspect all four native build jobs and their downloadable artifacts, then smoke-test the installers on their target systems.
Installers remain unsigned on Windows and ad hoc signed without notarization on macOS; public releases, auto-updates, signing credentials, and runtime portability fixes are outside this batch.

## Compact left navigation specification · 2026-11-10

The owner accepted the smaller main left menu in CHG-0123; see [mission tracking](capabilities/mission-tracking/specifications.md#compact-left-navigation).
The owner accepted hiding the tree only when no side-quests exist and retaining its location on the left (CHG-0124).
Implementation starts at `d421b47aaca8c0a8bfef78eb8d9a7fdda33ce554`, alongside an unrelated staged file reorganization that must be preserved.
Built: a 220px default main left menu with 15px labels, smaller crests and icons, tighter rows, and a 60px collapsed width; existing saved widths remain respected and resizing now allows 200px.
The quest tree renders only while any side-quest exists, including folded and finished children; the narrow-screen back link remains available without the tree.
Checks: lint, workspace typecheck, and Expo web export pass; all 132 existing app tests pass; the sandbox blocks localhost fixtures in the full suite (216 passed, 431 failed, 10 skipped).
Evidence and remaining acceptance: [compact navigation verification](verification/2026-11-10-compact-navigation.md).
The implementation and agreements are committed and pushed in `51d4ceb` alongside the source-folder reorganization; CHG-0125 records a later full-suite run with four workers (647 passed, 10 skipped), not independently rerun in this navigation session.
Next: verify the layout in the running app and have the owner review its proportions; the installed app has not been rebuilt by this session.

## Guildmaster batch · 2026-11-10 · increments A, B, and C implemented and checked, owner review pending

Agreed in CHG-0106 and CHG-0107: the Guildmaster is the one place quests start and the control panel over them, built from the full [quest coordination](capabilities/mission-coordination/specifications.md). Starting revision: `b913921`.
Built: A (CHG-0106) the conversation, matching on ticket keys, Continue in or open, realm hand-off; B hearing back, `act_on_mission`, `create_ritual`, `read_journal` and `read_control_history`, messaging to and from the Guildmaster; C tiers, its own cheap Companion and budget, the hide setting.
Checks: 29 fake-harness tests in `guildmaster.test.ts`; typecheck and Biome pass; full suite 581 passed, 10 skipped; the window driven on a throwaway database for A, B, and C ([proof](verification/2026-11-10-guildmaster.md)).
Awaiting the owner: the look; a live Claude Code, Codex, or OpenCode run of the Guildmaster's prompt (does it search first, pick Rituals for repeating work, never open a quest that fits, and act only when asked?).
Not built: messages between quests by `@` reference and their event lines; the 20-message window with summarized older messages; Guildmaster's spending on the quests' dashboard.

Sidebar follow-up (2026-11-10): the rail no longer lists finished (Done) quests by default; a Charter toggle ("Show finished quests in the sidebar", `shouldShowFinishedQuests`) brings them back, and a finished quest stays listed while it is open. The board and the realm counts are unchanged. Checked by `apps/app/test/shell/railQuests.test.ts`, typecheck, lint, and the full suite (590 passed); not driven in the window; the look awaits the owner.

## Guild-board batch · 2026-11-09 · implemented and checked, owner review pending

The owner selected [the Guild direction](art-direction/2026-11-08-guild-board.html) and requested its naming through iterate.
Starting revision: `63bc425d28bb4ee054e4d0e91c77bdc3c85551a8`.
Scope: Gild keeps its brand and logo, adopts leather, timber, parchment, gold controls, bundled Cinzel/Alegreya, guild display vocabulary (refined in CHG-0074), a collapsible Post a quest form, and a docked conversation from 1280px.
Existing resting quests retain their own column; no subscription data, Rituals, Waystones, Spoils, or Chronicle features are fabricated.
Contracts, persisted identifiers, capability paths, harness tools, user-authored content, and service-generated historical text retain their existing terms.
Checks: typecheck and lint pass; full tests passed 413 with one stale label expectation, corrected and verified by all 20 label tests; desktop build passes.
Visual check on a throwaway database with the fake harness: quest creation, echo reply, and the docked desktop work; a later CDP timeout prevented the final screenshot and phone-width check.
The Balanced reviewer (`gpt-6.1-terra`) verified fixes for contrast, notifications, and lore scope names.
Evidence and remaining checks: [guild-board verification](verification/2026-11-09-guild-board.md).
Owner acceptance of the appearance remains pending.
The owner rejected the oversized scroll roll on 2026-11-09; it is removed, along with the dark side rules, in favour of a thin gold top border and 16px of heading space.
This targeted visual correction passes typecheck and lint; its appearance awaits the owner.
Naming follow-up: Guildmaster replaces War table; all child threads are side-quests; Companion means the selected model; future Workflow and Routine interfaces are Craft and Ritual.
The follow-up label suite passes 21 tests; typecheck and lint pass.
Remaining optional naming choices: Realm, Journal, Briefing, and future Waystones / Spoils / Chronicle; none blocks the agreed vocabulary.

Layout follow-up (CHG-0075): no window frame or docked conversation, the quest input always open, a top bar, and an icon-only sidebar option; typecheck, lint, and tests pass, not yet seen in the running window.

Quest layout follow-up (CHG-0076): breadcrumbs, an icon handle on the rail, a quest screen without a header block, and a right quest panel; typecheck, lint, tests, and web export pass, not yet seen in the running window ([proof](verification/2026-11-09-quest-layout.md)).

Card cost batch (CHG-0077): tilted cards with API cost; Claude's `total_cost_usd` recorded per turn (assumed a running total, unprobed live); typecheck, lint, and 419 tests pass; the look and the live probe await the owner.

Board batch (CHG-0078): ribbon column headings and harness and model on cards; typecheck, lint, and tests pass; the look awaits the owner.

Thread panel batch (CHG-0079): a panel beside each thread with its context gauge, built unattended; typecheck, lint, and 430 tests pass; the look, live per-call usage, and the unsettled points of the specification await the owner ([proof](verification/2026-11-09-thread-panel.md)).

Emblems batch (CHG-0081): an emblem per realm and quest, one Realms menu in the collapsed rail, hover labels, Ctrl/Command+B, and card hover; typecheck, lint, and 430 tests pass; the look awaits the owner ([proof](verification/2026-11-09-emblems.md)).

Composer and reserves batch (CHG-0082): a one-line pill message box growing only for several lines, and Mana and Gold reserve rows in the rail; typecheck, lint, and 431 tests pass; the look awaits the owner ([proof](verification/2026-11-09-composer-reserves.md)).

Mockup batch (CHG-0083): hanging banners, a drawn castle heading, a crest and The Keep in the rail, a quest panel header; typecheck, lint, and 431 tests pass; the look awaits the owner ([proof](verification/2026-11-09-guild-mockup.md)).

Illustrated-view batch (CHG-0088): a parchment quest panel with gilt frame, bookmark, Knows and Spends tabs and a Does box; sturdier cards; the painted desk behind the board; typecheck, lint, and 431 tests pass; the look awaits the owner ([proof](verification/2026-11-09-guild-panel.md)).

Review-fix and lore batch (CHG-0093, CHG-0094): the review findings fixed and intel renamed to lore in the code; typecheck, lint, and 458 tests pass; the screen behaviors await the owner ([proof](verification/2026-11-10-review-fixes-and-lore-rename.md)). The architecture audit of 2026-11-09 awaits the owner's choice of candidate.

## Goal

Build the first slice iteratively (CHG-0025): each batch leaves a runnable application with its checks. Design under review: [first-slice-design.md](first-slice-design.md) and the mission-tracking, thread-tree, and thread-messaging blueprints. Starting revision: `e445b44`.

## Batch 1: delivered

Delivered in CHG-0026 (commit 649e232). Provisional behavior still in place until decided: on startup, threads left Running become Idle and interrupted turns are not replayed; the desktop app loads only the Metro dev server; rollback of a failed mission start is not directly tested.

## Batch 2: delivered

Delivered in CHG-0030 (commits ddb888d to d62a904). Provisional behavior still in place until decided: a failed turn's messages become undelivered and are retried with the next message; the live check runs only with `GILD_LIVE_CLAUDE=1`; a missing `claude` executable is covered by the stand-in checks only.

## Batch 3: delivered

Delivered in CHG-0033; the owner skipped the run-through and the desktop notification is unverified. Agreed in CHG-0031: Claude Code's built-in tools behind action approval. The user's own MCP servers, skills, and Claude settings stay off.

### Behavior

- **Approval level** in Settings: **Risky actions only** (default) or **Also commands and edits**.
- **Default level**: Claude Code runs sandboxed with in-workspace edits and sandboxed commands unasked. The thread's instructions list the risky actions (action-approval, Asking); the thread calls `request_approval` before one.
- **Harness prompts** reach Gild through `--permission-prompt-tool` on the local MCP server. A prompt matching the action just allowed in that thread runs once without a question; one matching a standing permission's pattern runs unasked; any other prompt becomes a question. At **Also commands and edits**, every prompt is a question.
- **No sandbox** (native Windows; Linux or WSL2 without bubblewrap and socat): the default level asks for every prompt, and Settings says why.
- **The question**: one sentence (what and why); **Show details** with the exact command or target and the proposed pattern; **Allow**, **Always allow**, **Deny**, **Deny with a message**, **Discard**. Thread in Attention until answered, no time limit. Deny carries on with the refusal; Discard answers as Deny without a message.
- **Named in the owner's message**: `request_approval` cites the owner's words; when they appear verbatim in the owner's latest message in that thread, the answer is Allowed without a question, recorded as "Allowed by your message". Thread or harness text never counts.
- **Standing permissions**: Always allow saves a sentence and a command pattern (for example `git push *`) for the mission, widenable to everywhere; removable. Workspace scope follows workspace attachment. Each thread's instructions carry the permissions that apply.
- **Permissions page**: Settings row "Permissions · <level>"; level, standing permissions with scope, answer history filterable by mission.
- **Records**: each answer, discard, and withdrawal stays in its thread as a short line, for example "Allowed `git push` · 14:02 · desktop".
- **Where**: in the thread, and an open-questions list at the top of the dashboard (mission and thread shown). A content-free desktop notification when a thread enters Attention (macOS, Linux, Windows).
- **Stop**: a per-thread Stop button; the thread becomes Stopped and its open question is withdrawn. On startup, open questions are withdrawn and their thread becomes Idle.
- **Out**: routines, thread messages, Interrupt, phone answering, workspace scope.

### Probe evidence (Claude Code 2.1.302, 2026-11-05, stand-in MCP server over stdio)

- The prompt tool is called as `tools/call` with arguments `{ tool_name, input, tool_use_id }`, for example `{"tool_name":"Bash","input":{"command":"…","description":"…"}}`. It answers with one text block holding JSON: `{"behavior":"allow","updatedInput":<input>}` runs the tool; `{"behavior":"deny","message":"…"}` returns the message to the model as an error tool result.
- With `--permission-mode acceptEdits` and `--settings '{"sandbox":{"enabled":true,"autoAllowBashIfSandboxed":true}}'`: a command writing inside the working directory runs unasked; a write outside it fails with "Operation not permitted"; a new network host is denied ("deny network-outbound github.com:443"). Neither reaches the prompt tool.
- A Bash call with `dangerouslyDisableSandbox: true` reaches the prompt tool with the exact command and that flag, and runs unsandboxed when allowed. So an approved risky action is retried unsandboxed, and the thread's instructions must say so; the one-time match compares that prompt's command with the approved details.
- A prompt-tool answer held 200 seconds was accepted and the turn continued. Waits of hours are not verified.
- Claude Code aborts an MCP call silent for 300 seconds ("sent no response or progress for 300s; aborting"); SSE comments do not count and `MCP_TOOL_TIMEOUT` did not lift it. A per-server `timeout` in `--mcp-config` does: an answer given after 5 min 51 s was accepted (window drive).
- The sandbox refuses every write under `.git` in the working folder ("Operation not permitted" on `git init` and on `.git/index.lock`), so each local `git init` or `git commit` becomes a harness question at the default level.

### Checks

- Live probe: done, see above.
- Automated with the fake harness: done, 42 checks.
- Live check behind `GILD_LIVE_CLAUDE=1`: done, 44 of 44 pass with Haiku.
- `bun run test`, `bun run typecheck`, `bun run check`: pass. Driven in the Electron window: done, see Drive findings.
- User run-through: pending. In a mission's scratch folder, allow a push to a local bare remote, choose Always allow, see a second push run unasked, remove the permission on the Permissions page; confirm the desktop notification.

### Drive findings (2026-11-05, Electron window, Claude Code with Haiku)

Verified: a harness question with Claude Code's description, Show details, the quote check ("Allowed by your message"), the one-time match, Always allow from the dashboard list, a later push in the same mission allowed by the standing permission with no question, the Permissions page and its filter, Remove, and Stop.

Fixed during the drive, each with a check written first:

- Stop opened a new question: Claude Code still prompted while exiting. A question now opens only on a thread at work, and Stop marks the thread Stopped before withdrawing.
- A question held over 300 seconds stayed open while Claude Code moved on. The MCP server entry now sets `timeout`, and a call whose connection closes withdraws its question.
- Harness questions said only "Claude Code asks to use Bash." They now add Claude Code's description of the command.
- The Allowed text now tells the thread to run the approved command alone: a chained `&& git log` failed the one-time match and asked again.
- History lines showed whole multi-line commands; they now show the first line, cut at 80 characters. Long mission names no longer overflow the filter chips.

Open, for the owner:

- Settled in CHG-0032: the sandbox protects `.git` (its write settings cannot lift a protected path, per Claude Code's settings reference), so Gild answers prompts for local git itself at the default level when the sandbox runs. Verified in the window: a mission created a repository, committed, and branched with no question.
- The desktop notification was not observed by an agent.
- The service passes its whole environment to Claude Code except `GILD_` variables. Launched from an agent's shell, that leaked the agent's `CLAUDE_*` and `GIT_CONFIG_*` variables; a normal launch is not affected. Not changed.

## Batch 4: delivered

Delivered in CHG-0036 after an agent's run-through in the window at the owner's request ([proof](verification/2026-11-06-batch-4-drive.md)). Agreed in CHG-0034 and CHG-0035. Not verified: operating the Finder dialog itself, and the desktop notification. Provisional behavior still in place until decided: the sensitive list is best effort; a missing-folder wait raises no desktop notification; Relocate and Clone again are staged.

### Open, for the owner

- In a fresh clone, `bun install`'s `prepare` step cannot set `core.hooksPath` inside the sandbox, so commits skip the pre-commit hook until something sets it. A thread asked to set it does so with no question.
- Whether a workspace should also load its own Claude Code settings and skills (`--setting-sources project`), which would also let project hooks run.

## Batch 5: delivered

Thread tree core, agreed in CHG-0037 and delivered in CHG-0038 after the owner accepted the side tree. Built test-first and driven in the window: [proof](verification/2026-11-06-thread-tree.md). Sources: thread-tree and thread-messaging specifications and blueprints.

### Behavior

- **Opening by a thread**: `open_thread` with a request and optional short title, model, and effort opens a thread directly beneath the caller, in the caller's workspace, and starts it with the request. The answer is the new thread's identifier, or a refusal with its reason. Starting context: the request and who opened it; journal and intel are staged.
- **Opening by the owner**: "Open thread beneath" on the selected thread, with model and effort shown and changeable before the first message. Down to 4 levels below the top thread; agents have no depth limit.
- **Running limit**: at most 8 threads Running at once in a mission. `open_thread` past the limit is refused with the reason; a message to a thread past the limit waits until a slot frees.
- **Results**: `report_result` with the result text sends it to the parent as a thread message and makes the caller Done. The top thread has no parent: its result is shown in its own conversation. A result can be reported while threads beneath still run.
- **Thread messages**: `send_thread_message` to the parent or a thread directly beneath; others refused with the reason. Delivered at the receiver's next turn; a message wakes Waiting, Idle, and Done threads; each message shows its sender.
- **Waiting**: a turn ending while threads beneath the thread are Running or Waiting leaves it Waiting rather than Idle.
- **Stop and Resume**: Stop affects only the selected thread. Messages reaching a Stopped thread are kept; the tree shows "N messages waiting". Resume makes it Idle and delivers them.
- **View**: the conversation screen shows a side tree with each thread's title, state, and waiting count; selecting one shows its conversation, model, effort, and workspace.
- **Hooks**: the thread instructions say that a setup step failing only because the sandbox protects a Git file is re-run outside the sandbox.

### Provisional, until decided

- On startup, Waiting threads become Idle with Running ones, since nothing runs beneath them any more.
- The top thread's `report_result` makes it Done with no message: its replies are already the owner's.
- A thread message reaches a running thread at its next turn only; mid-turn delivery is staged.
- The phone layout of the side tree is not designed; the tree is a fixed 280-point column.

### Checks

- Automated with the fake harness: opening by owner and thread with copied settings and overrides; depth and running limits; results to the parent and Done; message reach and refusal; delivery and waking; Waiting; Stop without cascade, kept messages, and Resume.
- Live: one Claude Code mission that opens a thread, gets its result, and reports.
- Driven in the window: the side tree, selecting threads, writing to a child, Stop and Resume.

## Batch 6: delivered

Interrupts and steering, agreed in CHG-0039 and delivered in CHG-0040 after the owner accepted the composer. Built test-first and driven in the window on the fake harness (Claude Code's session limit stopped the live drive): [proof](verification/2026-11-06-steering.md). Sources: thread-messaging specifications (Delivery, Interruptions, Thread tools) and the Claude Code probe recorded in CHG-0039.

### Behavior

- **Steering**: a message to a running thread joins its current turn after the current tool call: thread messages and results always, the owner's when steered. A message counts as delivered when the harness takes it in; one written but not taken in before the turn ends starts the next turn.
- **Queuing**: an owner message sent as Queue waits for the thread's next turn; the conversation marks it Queued until then.
- **Composer**: while a thread runs, Send uses the owner's default (Steer unless changed in Settings) and a smaller second button does the other; an Interrupt button sits next to them.
- **Interrupt**: by the owner (any running thread) or by a thread (`interrupt_thread`, a running thread directly beneath it; others refused with the reason). The turn ends, its open questions are withdrawn, and the thread becomes Done if it reported its result in that turn, Waiting while threads beneath it are Running or Waiting, otherwise Idle. Undelivered messages start its next turn. Stop is unchanged.

### Provisional, until decided

- A message written to Claude Code but not taken in before the turn's result closes the process, so Claude Code does not run it on its own; the next turn resumes the session and sends it again. If the process had already taken it in when closed, the model may see it twice.
- An interrupt that Claude Code does not confirm within 10 seconds closes the process.

### Checks

- Automated with the fake harness: steering owner and thread messages, queuing, the default setting, interrupts by the owner and by a parent with refusals, the state after an interrupt, and undelivered messages starting the next turn.
- Automated with the Claude Code stand-in: the stream-json steering message with its identifier, delivery on echo, closing on an untaken message, and the interrupt control request.
- Live: one Claude Code thread steered mid-turn and one interrupted.
- Driven in the window: Send and Queue while running, the Queued mark, Interrupt, and the default setting.

## Batch 7: delivered

Folding agent-opened threads, deleting, and the chatter guard, agreed in CHG-0041 and delivered in CHG-0042 after the owner accepted its look; the interface gets its own pass later (backlog, Interface pass). Built by Codex (`gpt-6-astra`) at the owner's request; verified and driven in the window on the fake harness: [proof](verification/2026-11-06-batch-7.md). Sources: thread-tree specifications (Threads opened by agents, Deleting) and thread-messaging specifications (Chatter guard).

### Behavior

- **Folding**: Settings **Show threads opened by agents**, on by default; settings saved before it read on. When off, the side tree folds each agent-opened thread into the thread that opened it, which shows "+N threads" (all folded threads beneath it, at any depth) and unfolds when selected. A folded thread whose state is Attention or Failed still appears. Folding is view only.
- **Deleting**: "Delete" on the selected thread. One confirmation: "Delete this thread?" or "Delete this thread and N threads beneath it (M running)?". Running threads are stopped first, open questions withdrawn. Deleting the top thread deletes the mission and returns to the dashboard. Permanent: threads, turns, messages, questions erased; for a mission also its scratch folder and mission-scoped standing permissions. A workspace folder is never touched. Messages other threads sent to deleted threads are erased with them; a thread whose parent is deleted is deleted with it, so no orphan remains.
- **Chatter guard**: a count per unordered pair of threads of messages between them (thread messages and steered thread messages; results do not count). A message from the owner to either thread or a result reported between them resets it. At the threshold (Settings, default 20, minimum 2), both threads enter Attention with the notice "<A> and <B> exchanged 20 messages without you" and the choices **Let them continue** and **Stop both**; messages between them past the threshold are kept undelivered. Let them continue resets the count, leaves Attention, and delivers the kept messages. Stop both makes both Stopped with messages kept. Simultaneous sends at the threshold trip the guard once. A pause ends both threads' running turns; a message a turn already took in may get no answer (the owner kept this on 2026-11-06).

### Checks

- Automated with the fake harness: the folding setting and its default; the tree query exposing what folding needs; deletion of a subtree with count, running threads stopped, questions withdrawn, mission deletion with scratch folder and permissions, workspace folder untouched; chatter count, reset by owner message and by result, trip at threshold for both threads, kept messages, Let them continue, Stop both, simultaneous sends at the threshold, the adjustable threshold.
- `bun run test`, `bun run typecheck`, `bun run check`, desktop build.
- Driven in the window: fold and unfold, a folded thread reappearing in Attention, delete with the count, the chatter notice and both choices.
- Owner's look: the "+N threads" mark, the delete confirmation, the chatter notice.

## Batch 8: delivered

The mission journal, agreed in CHG-0043 and delivered in CHG-0044 after the owner accepted its look, built here test-first and driven in the window with Claude Code (Haiku): [proof](verification/2026-11-06-journal.md). Sources: mission-journal specifications; thread-tree specifications (Opening a thread).

### Behavior

- **Journal**: one per mission, created with it: a briefing (empty at first, version 0) and a change log. Entries carry their author (a thread with its title, or the owner) and time, and are never edited or deleted.
- **Limit**: the briefing holds at most the Settings value **Briefing limit** (default 2,000 tokens), estimated at 4 characters per token; a rewrite over it is refused with its reason.
- **Thread tools**: `read_journal` (optional `before`, an entry number, and `count`, default 20) answers with the briefing, its version, and those entries. `update_journal` takes `entry` and optionally `briefing` with `basedOn`, the version it was based on; a rewrite without `basedOn`, or with a version older than the current one, is refused with the current briefing and version.
- **Results**: `report_result` requires `journal`, an entry or exactly "nothing to record"; a missing one is refused with the reason. The entry is added before the result is delivered.
- **Starting context**: every turn's context carries the briefing and the 20 latest entries. A thread opened beneath another also carries its opener's messages since the journal's latest entry, captured when it was opened.
- **The owner**: a Journal link in the mission header opens the Journal view: the briefing with Edit, the entries newest first, and a box to add an entry. A rewrite by the owner adds the entry "Rewrote the briefing" unless the owner writes one.

### Provisional, until decided

- The opener's messages are capped at the 40 latest, with a line saying how many earlier ones were left out; summarizing is staged (thread-tree, Opening a thread).

### Checks

- Automated with the fake harness: journal created with a mission; entry with author and time; briefing rewrite with its entry; over-limit refusal; stale rewrite refused with the current briefing, then accepted; `read_journal` paging; `report_result` refusing a missing `journal` and recording the entry; the starting context with the briefing, 20 latest entries, and the opener's messages; no tool or route edits or deletes an entry; the owner's edits recorded as entries by the owner; deleting a mission erases its journal.
- `bun run test`, `bun run typecheck`, `bun run check`, desktop build; mutation check.
- Driven in the window with Claude Code (Haiku): a thread updating the journal, a child opened from it starting with the briefing, and the owner editing the briefing.
- Owner's look: the Journal view and the Briefing limit setting.

## Batch 9: delivered

Mission tracking, agreed in CHG-0045, built here test-first. Sources: mission-tracking specifications; mission-journal specifications (When a mission ends).

Status (2026-11-06): implemented and committed in `8e05eb0`. Tests pass (175, five opt-in live checks skipped), typecheck, lint, desktop build. Recovered mutation evidence catches 15/15 mutations. The window drive on the fake harness proved the dashboard row ending actions (Mark as done with the stop confirmation, Cancel, Archive, Reopen from Archived), rename and the refused `set_mission_title`, workspace and state filters, search, the Mark as done? question with Not now, and writing in a Done mission: [proof](verification/2026-11-06-mission-tracking.md). Visual polish is deferred by the owner. Accepted by the owner and delivered in CHG-0046.

### Behavior

- **Mission state**: the most urgent of its threads' states (Attention, Failed, Running, Waiting, Idle), or Done or Archived once ended. Done and Archived are set only by ending.
- **Mark as done?**: when the top thread reports its result, the dashboard asks "Mark as done?" with **Mark as done** and **Not now**. The mission does not end on its own; a later result asks again.
- **Ending**: **Mark done** and **Archive** in the mission header; an archived mission's header offers **Reopen**. With threads still at work (Running, Waiting, or Attention), one confirmation, for example "2 threads are still running. Stop them and mark as done?", then they are stopped.
- **Inactivity**: after **Ask after inactive days** (Settings, default 14) without a turn or message, the dashboard asks of a mission not ended "Archive it or mark it as done?" with **Archive**, **Mark as done**, **Not now**. Not now brings it back after another such period without activity.
- **Auto-archive**: Settings **Archive done missions automatically**, off by default, after **days after done** (default 30).
- **Archived view**: from the dashboard header; lists archived missions with Reopen. Reopening, or the owner writing in a thread of a Done or archived mission, returns it to the state worked out from its threads.
- **Journal**: "Marked done by the user", "Archived by the user", "Archived automatically", "Reopened by the user".
- **Title**: `set_mission_title` from the top thread only, whose instructions ask for a short title on its first turn; refused once the owner renamed the mission from its header. The top thread's title follows the mission's.
- **Prefilled choices**: model, effort, and workspace of the last mission started; the Settings defaults before any.
- **Dashboard**: missions in Attention or Failed first, then by latest activity; each row shows title, state, workspace, thread count with running count, usage, last activity. Filters by state and workspace; search over titles and briefings.
- **Out**: budget rings, the phone web app, `find_missions`.

### Provisional, until decided

- "Still running" in the ending confirmation counts threads Running, Waiting, or in Attention, so no question stays open on an ended mission.
- "Need the user" in the dashboard order means Attention or Failed; the questions above the list are not counted.
- The inactivity question is not asked of a Done mission; auto-archive covers those.
- Auto-archive runs at startup and then hourly.

### Checks

- Automated with the fake harness: state urgency; the top thread's result asking Mark as done without ending, Not now; the inactivity question after the set duration, agent activity resetting it, a dismissed question coming back; the confirmation counting threads at work and stopping them; ending and reopening journal entries; auto-archive off by default and archiving after the set duration when on; writing in a Done or archived mission bringing it back; the Archived view and Reopen; the proposed title, the rename, and `set_mission_title` refused afterwards and from other threads; prefilled choices; dashboard order, state and workspace filters, title and briefing search.
- `bun run test`, `bun run typecheck`, `bun run check`, desktop build; mutation check.
- Driven in the window: 3 missions, the one needing the owner first, Mark done, archive, reopen, rename, filters and search.
- Owner's look: the dashboard questions, filters, Archived view, and the header actions.

## Batch 10: delivered

Status (2026-11-06): committed in `083003f`; 13/13 mutations caught; driven in the window on the fake harness: [proof](verification/2026-11-06-off-topic.md). Agreed as built with its provisional choices, and accepted, in CHG-0047; the owner adjusts after the MVP. Not run: the live check with Claude Code.

Off-topic requests (thread-tree, Off-topic requests; CHG-0045 staged `find_missions`). Chosen by an agent under the owner's instruction of 2026-11-06 ("build what is next", no questions this session); not yet agreed by the owner. Sources: thread-tree specifications (Off-topic requests, External contract, Acceptance).

### Behavior

- **Judging**: every thread's instructions say that a message from the owner that clearly shares nothing with the mission, judged against the briefing, is not answered: the thread calls `find_missions`, then `suggest_mission`, then carries on as if the message had not been sent.
- **`find_missions`** (the request): up to 3 other missions whose titles or briefings share words with the request, best first, each with its id, title, state, and briefing. Every mission not deleted counts, Done and Archived included; the caller's own mission does not.
- **`suggest_mission`** (the off-topic part, a proposed title, the matching missions' ids): the thread enters Attention and its conversation shows the suggestion with **Continue in "title" · state** for each match (at most 3), **Open as new mission** with model and effort prefilled from the thread, and **Keep as aside**. The answer tells the thread where the message went.
- **Continue in**: the off-topic part goes to that mission's top thread as the owner's message, steered or queued by the default delivery, waking it.
- **Open as new mission**: a mission whose top thread starts with only the off-topic part, the proposed title, no workspace, an empty journal.
- **Keep as aside**: a thread beneath the current one, marked as an aside, whose first message is the off-topic part from the owner. Its instructions carry the note that the message went off topic and was put aside, and the rule to message its parent with what is relevant when the conversation comes back to the mission. An aside does not update the journal: `update_journal` is refused and its result records no entry.
- **Link left behind**: the original thread shows a line "Continued in mission: X", "Moved to mission: X", or "Kept as aside: X" that opens it.
- **Setting**: **Open off-topic requests as new missions without asking when no mission matches**, off by default.
- **Withdrawal**: Stop, Interrupt, a failed turn, or a restart withdraw an open suggestion, as with questions.

### Provisional, kept until after the MVP

- Matching is word overlap on titles (counted twice) and briefings; no semantic search.
- The suggestion shows in its thread only, not in the dashboard's open-questions list; its mission comes first on the dashboard as Attention.
- An aside starts with the whole journal context (briefing and latest entries), not the briefing alone, and without its opener's messages.
- A new mission opened from a suggestion does not change the dashboard's prefilled choices.
- The aside is not folded with agent-opened threads: the owner chose it.

### Checks

- Automated with the fake harness: matches by title and briefing, Done and Archived included, own and deleted missions excluded, at most 3 best first; the suggestion in Attention; Continue in waking the chosen mission; a refused Continue to a mission not offered; the new mission's fresh start; the aside's first message, context, and journal refusal; the link left behind; the setting with and without matches; withdrawal on Stop; the instructions.
- `bun run test`, `bun run typecheck`, `bun run check`, desktop build.
- Driven in the window on the fake harness: the three choices and the setting.

## Batch 11: delivered

Status (2026-11-06): committed in `083003f`; 16/16 mutations caught; driven in the window on the fake harness: [proof](verification/2026-11-06-budgets.md). Agreed as built with its provisional choices, and accepted, in CHG-0047; the owner adjusts after the MVP. Not run: the live check with Claude Code's usage.

Budget control (budget-control specifications), chosen by an agent under the owner's instruction of 2026-11-06 ("Go for next feature", no questions); not yet agreed by the owner. Control and the phone web app do not exist yet, so Control's budget, its event lines, and phone notifications are out.

### Behavior

- **Budgets**: two optional limits, cost (API-key spending) and tokens (subscription spending); empty means none; tokens never priced. Each mission has one, for its whole life; one global budget covers all missions over a period: Day, Week, or Month (default), starting at local midnight, Monday, or the 1st.
- **Settings**: a default mission budget, empty at first, copied onto each new mission; the global budget and its period, empty at first.
- **Mission budget**: set, changed, or removed from the mission's budget window; only the owner, no thread tool.
- **Seeing use**: a mission with a budget shows a meter per limit, orange from 80%, red at 100%; without one, only its spending. The global meters sit at the top of the dashboard. The budget window shows used of limit and the split by thread.
- **Budget line**: each turn's context carries one line, for example "Budget: 12,000 of 50,000 tokens used (24%); global: 61% of this month's tokens". Left out with no budget at all.
- **Reaching a limit**: when a turn's spending reaches the mission's limit, every running thread of the mission stops its turn and goes to Attention; the thread that reached it shows **Raise budget** and **Stop**. At the global limit, every running thread stops, with one shared question at the top of the dashboard: **Raise budget** or **Stop all**. Raise budget opens the limit with +25%, +50%, double, and remove; once under the limit, the stopped threads resume on their own, their interrupted messages delivered again. Stop leaves them Stopped. A message to a thread under a reached budget waits in Attention the same way.
- **Refusals**: at a reached limit `open_thread` is refused with the reason; at the global limit starting a mission is refused with the reason.
- **Lowering** below what is spent stops running threads the same way.
- **Record**: each change (set, raised, lowered, removed) and each stop at a limit is a line in the mission's top thread, for example "Budget raised to 75,000 tokens · 14:02".

### Provisional, kept until after the MVP

- Claude Code counts as subscription spending: its turns count in tokens (input, output, cache writes, and cache reads); a cost is counted only from a harness that reports one (the fake harness). Detecting API-key billing is staged.
- Spending is counted when a turn ends, as Claude Code reports it then; a turn can go over before it stops.
- The budget window splits by thread only: Claude Code is the only provider.
- Global budget events have no line (Control holds them, and Control does not exist yet).
- A thread released after a raise becomes Idle and runs its kept messages; a thread that had reported its result in the reaching turn is not set Done again.
- Meters are thin bars, not rings, until the interface pass.

### Checks

- Automated with the fake harness reporting spending (`spend <tokens> [cost]`): limits counted separately; empty limits never stop; every thread drawing on the mission; mission and global counting; the default budget applied; changing a mission's budget; period starts for day, week, month; a reached limit stopping running threads in Attention with the question; Raise (resume) and Stop; the global limit with one question; `open_thread` and starting a mission refused; lowering below spending; the budget line present and absent; the lines recorded.
- `bun run test`, `bun run typecheck`, `bun run check`, desktop build; mutation check.
- Driven in the window on the fake harness: a budget set, meters turning orange then red, the stop question, Raise by 50%, threads carrying on.

## Review, fixes, and architecture after batch 11 (2026-11-06)

Fixed point `63d4b15` to `083003f`, reviewed on two axes, then fixed and refactored at the owner's request ("Fix everything"). Uncommitted. Report: [architecture-audit-2026-11-06-1959.html](architecture-audit/architecture-audit-2026-11-06-1959.html); proof: [verification](verification/2026-11-06-review-fixes.md); recorded in CHG-0048.

### Fixed, test-first

- P1 Stop at a budget and Stop both on chatter now return a parent left Waiting to Idle, as every Stop does.
- P2 Deleting threads or a mission keeps their spending (migration 0015).
- P3 Threads held at the global limit are released when the period starts over.
- P4 The budget line is given with each turn's message, not in the system prompt, so it no longer restarts Claude Code.
- P5 The no-ask off-topic setting matches on the service side.
- P6 Tests cover withdrawal on Interrupt and on restart; a thread not at work is told it was not asked.
- P7 Ending a mission refuses Done again and Archived to Done.
- P8 Holding at a lowered budget leaves another reason, or a failure, in place.
- R1 (found while checking P8) A message to a Failed thread under a reached budget waits in Attention and runs once the budget is raised.

### Provisional, until the owner decides

- The budget window shows spending of deleted threads as one part "Deleted threads", and of deleted missions as "Deleted missions".
- The budget line is the first paragraph of the turn's first message to Claude Code.
- "Archived automatically" keeps the user as its author: the journal's authors are a thread or the user.
- The global period release checks at each period start and at least hourly.

### Still open

- A failed turn's suggestion withdrawal has no automated test: the fake harness cannot fail during a call.
- Files over about 250 lines: `claude.ts`, `threads.ts`, `approvals.ts`, `requests.ts`, `conversation.tsx`, `service.ts`, `store.ts`, `records.ts`, `suggestions.ts`. Most of `claude.ts`, `threads.ts`, `approvals.ts`, and `store.ts` predates this work.
- Not verified live: a Claude Code turn with the budget line in its message.

## Batch 12: built, awaiting the owner

Scoped intel (scoped-intel specifications), chosen by an agent under the owner's instruction of 2026-11-06 ("build what is next", no questions this session); not yet agreed by the owner. Built test-first and driven in the window on the fake harness: [proof](verification/2026-11-06-scoped-intel.md). Uncommitted, on `554a28c`. Recorded in CHG-0049.

### Behavior

- **Scopes**: an intel belongs to a thread (and the threads beneath it), a workspace, or global; intel on the mission's top thread applies to the whole mission.
- **Thread tools**: `save_intel` (text, scope `thread`, `mission`, `workspace`, or `global`), `search_intel` (query, optional scope), `update_intel` (id, text, wider scope, or both), `forget_intel` (id).
- **Saving**: thread, mission, and workspace intel are saved at once and shown in the thread as a line; a global save answers "Awaiting approval" and shows as a card with **Approve** and **Decline** in its thread and in the intel panel. At most 200 tokens per intel (4 characters per token). Workspace intel is refused for a thread without a workspace.
- **Recall**: every turn's context carries all the intel in the thread's scope, most specific first, saying the first listed wins a conflict, with the rules: narrowest scope, a rule the owner gives in a chat saved without asking, correct, delete, propose widening, and where the mission stands belongs in the journal.
- **Correcting and deleting**: a thread changes or deletes thread and workspace intel in its scope at once; a change to or deletion of global intel waits for approval; intel outside its scope is refused.
- **Widening**: `update_intel` with a wider scope waits for approval; a narrower or equal scope is refused.
- **Size warning**: Settings **Intel warning** (default 10%); the thread header's **Intel · N · P%** turns red when the intel in scope takes more than that share of the model's context window, and opens the intel panel for that thread.
- **Intel panel**: from the thread's intel icon (that thread's scope, most specific first, with its gauge) or the dashboard's **Intel** link (all intel). Changes awaiting approval first, then each intel with scope, saver, time, and size; filters All, Thread and mission, Workspace, Global; **Edit** and **Delete** on any intel.
- **Deleting a thread** erases its own intel and its changes, awaiting or done.

### Provisional, until the owner decides

- Every model counts a 200,000-token context window until harnesses report theirs (backlog, Thread panel and context gauge).
- `mission` is a scope name for threads: thread intel on the top thread. Widening counts thread, mission, workspace, global in that order.
- A global change waits without blocking the thread, which carries on; the thread is not told the owner's decision, and an approved intel reaches it at its next turn.
- Approving a change to an intel deleted meanwhile records it as declined.
- The owner's edits and deletions apply at once and leave no line in a thread; the owner cannot add intel from the panel.
- `search_intel` matches shared words, as `find_missions` does; no full-text index yet.
- Intel recall is part of every turn's context, like the journal, not only a new thread's first turn.

### Staged

- **Tidy up intel** from the panel (scoped-intel, Intel panel).
- The warning before a thread starts with too large a starting context (thread-tree, Opening a thread).
- Standing permissions for global intel changes (scoped-intel, Requirements).

### Checks

- Automated with the fake harness: 19 checks in `intel.test.ts`; 2 label checks.
- `bun run test` (237 passed, 5 skipped), `bun run typecheck`, `bun run check`, desktop build, Metro web export; 12 of 12 mutations caught.
- Driven in the window on the fake harness: see the proof.
- Not run: a live Claude Code thread using the intel tools.

## Batch 13: built, awaiting the owner

Part of the agreed intel-over-time rules (CHG-0050, scoped-intel Kinds, Recall, Fading, intel panel, ranked search), chosen by an agent under the owner's instruction of 2026-11-06 ("build what is next", no questions this session). Starts from `5901f13`, uncommitted. Built test-first on the fake harness and its test clock and driven in the window: [proof](verification/2026-11-06-intel-over-time.md). Recorded in CHG-0051.

### Behavior

- **Kinds**: `save_intel` takes a kind (rule, preference, decision, fact, temporary). Half-lives in Settings (**Intel half-lives**, days): preference 90, decision 45, fact 45, temporary 3; a rule never fades. The context tells threads to save a rule the owner gives in a chat as a rule.
- **Pinning**: the owner pins or unpins any intel in the panel; a pinned intel never fades.
- **Fading**: strength = 0.5 ^ (days since last use or save ÷ (half-life × (1 + log2(1 + uses)))). Below 0.15 dormant, below 0.05 archived. Worked out when read, so nothing runs on a timer.
- **Uses**: each intel `search_intel` returns counts one use and becomes active again. Being in the context is not a use.
- **Recall**: every turn's context carries active thread, mission, and workspace intel in full, most specific first; active global intel as an index, one line each (identifier, kind, a short summary), oldest first so a new one is added at the end; then how many dormant intels in scope are not listed.
- **Search**: `search_intel` takes words, identifiers, or both, optionally a scope; it searches active and dormant intel in scope, never archived, ranks by shared words with a word found in three intels or fewer counting three times, then by scope, most specific first; it answers with each intel's identifier, scope, kind, and full text.
- **Gauge**: counts what the context carries: active intel in full plus the index lines.
- **Intel panel**: each intel shows kind, strength, state, uses, and whether pinned; filters by state (All, Active, Dormant, Archived, Pinned) next to the scope filters; **Pin**/**Unpin** and, for dormant or archived intel, **Restore** (strength back to full, not counted as a use).

### Provisional, until the owner decides

- A short summary is the text's first 80 characters, cut at a word, with "…".
- Restoring sets the last use to now without counting a use.
- An owner edit, a correction, or a widening is not a use.
- A global save awaiting approval keeps its kind; approval saves it with that kind.

### Staged, next intel batch

- Duplicates saved as replacements; history with undo, including fading steps; widening and narrowing proposed from evidence; Tidy up intel and its routine; a thread saying it relied on an intel counting as a use; the journal entry or message an intel rests on.

### Checks

- Automated: 15 checks in `intelOverTime.test.ts` on the test clock; 1 label check; batch 12's intel checks save as fact; a migration check of 0017 in the proof's folder.
- `bun run test` (253 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 20 of 20 mutations caught in a separate worktree; the proof reproduced by a fresh-context agent.
- Driven in the window on the fake harness, days simulated in the database: see the proof.
- Not run: a live Claude Code thread using kinds, the index, and search.

## Batch 14: built, awaiting the owner

Replacing duplicates, origins, and relying on intel (scoped-intel Duplicates, Saving, Fading), chosen by an agent under the owner's instruction of 2026-11-07 ("build what is next", no questions this session). Starts from `7b6ee2e`, uncommitted. Built test-first on the fake harness and its test clock and driven in the window: [proof](verification/2026-11-07-replacing-intel.md). Recorded in CHG-0052.

### Behavior

- **Replacing**: before a save, the service compares it with the active and dormant intel in the thread's scope, in the save's scope or wider. One in the same scope that is close enough is replaced: it keeps its identifier and uses, takes the new text and kind, and is at full strength again. The answer says "Replaced intel <id>" with the old text. A global replacement waits for approval; its card shows "Was:" with the old text and the new one. The change is a new kind, Replace, shown in the thread as "Replace intel in <scope>".
- **Close intels**: a save that replaces nothing still names up to 3 close intels in its answer, in the same or a wider scope, so the thread can correct or delete one that is outdated.
- **Origins**: `save_intel` takes an optional `journalEntry`, the number of the journal entry it rests on; a number that does not exist refuses the save. Without one, the latest message delivered to the thread is recorded, from the owner or a thread. The origin is copied as an excerpt of at most 80 characters, so it outlives the message's thread. A global save keeps its origin until approved. The panel shows "From journal entry N: …", "From your message: …", or "From a message by "<thread>": …".
- **Relying**: `relied_on_intel` with ids counts one use of each intel in the thread's scope that is not archived; the rest are named as refused, and a call where none counts is an error. The context asks threads to call it when an intel from their context shaped what they did.

### Provisional, until the owner decides

- Closeness is shared meaningful words, as `search_intel` matches them: twice the shared words over both texts' words. A replacement needs 0.6 and at least 2 shared words; a close intel needs 0.3. There is no semantic matching.
- Only an intel in the same scope is replaced. A narrower intel that differs from a wider one is an override, since the most specific scope wins, so a wider intel is named, not replaced. The specification says "the same scope and the scopes above it"; this reads it as where to look, not what to replace.
- An archived intel is never replaced; a new intel is saved beside it.
- A replacement restates the intel: its last use becomes now, without counting a use, and its origin becomes the new one.
- A replacement's kind is the new save's kind.
- Each `relied_on_intel` call counts, even for an intel already searched in the same turn.
- `relied_on_intel` is a fifth intel tool, not listed in the specification's contract before this batch; the contract now lists it.

### Staged, next intel batch

- History with undo, including fading steps and which intel replaced which; widening and narrowing proposed from evidence; Tidy up intel and its routine.

### Checks

- Automated: 13 checks in `intelReplacing.test.ts` on the test clock; 2 label checks; a two-step migration check of 0018 in the proof's folder.
- `bun run test` (267 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 20 of 20 mutations caught in a separate copy; the new checks fail on `7b6ee2e`.
- Driven in the window on the fake harness: see the proof.
- Not run: a live Claude Code thread using replacements, `journalEntry`, and `relied_on_intel`.

## Batch 15: built, awaiting the owner

Intel history with undo (scoped-intel, History and undo), chosen by an agent under the owner's instruction of 2026-11-07 ("build what is next", no questions this session); not yet agreed by the owner. Starts from `7b6ee2e` with batch 14 still uncommitted on top; uncommitted. Built test-first on the fake harness and its test clock and driven in the window: [proof](verification/2026-11-07-intel-history.md). Recorded in CHG-0053.

### Behavior

- **History**: every intel keeps its history, newest first: saved, replaced, corrected, widened, deleted (by a thread, approved or not), edited, deleted, pinned, unpinned, restored (by the owner), became dormant, became archived (by fading), and undone. Each entry says who or what made it (a thread with its title as then, you, or fading) and when; a thread's global change says when the owner approved it. A replacement shows the text it replaced ("Was: …") and the thread whose save replaced it.
- **Fading steps**: worked out from the intel's strength, so nothing runs on a timer. The time an intel crossed dormant or archived is recorded when something resets its fading (a use, a restore, a replacement, a pin, a deletion), so a step stays in the history after the intel is active again; steps not yet recorded are shown from the current strength.
- **Undo**: **Undo** on any entry the owner or a thread made puts back what that change changed, as a new entry "Undid …" by the owner, itself undoable. Undoing a save deletes the intel; undoing a deletion restores it with its identifier, uses, and origin. An entry already undone shows no Undo. Undoing a change to an intel that is deleted is refused until its deletion is undone. Fading steps have no Undo: Restore covers them.
- **Panel**: each intel has **History**, which lists its entries with Undo; the state filter gains **Deleted**, listing deleted intels with their history and **Undo deletion**.
- **Thread deletion** erases its own intel's history, deleted ones included.

### Provisional, until the owner decides

- Undo restores the fields the change changed (text, kind, scope, pin, origin) whatever happened since; its last use is put back only when no use came after the change; uses are never taken back.
- Fading steps are worked out with the current half-lives, so changing a half-life moves steps not yet recorded.
- Intel saved before this batch starts its history with one "Saved" entry; earlier changes are not in it.
- A thread's change awaiting approval is not in the history until approved; a declined one never is.
- History entries a deleted thread made on a workspace or global intel stay, with the thread's title as then.
- Deleting an intel by undoing its save declines its changes awaiting approval, as the owner's deletion does.

### Checks

- Automated: 16 checks in `intelHistory.test.ts` on the test clock; 2 label checks; a two-step migration check of 0019 in the proof's folder.
- `bun run test` (285 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 22 of 22 mutations caught in a separate copy.
- Driven in the window on the fake harness, days simulated in the database: see the proof.
- Not run: a live Claude Code thread whose intel changes appear in the history.

### Staged, next intel batch

- Widening and narrowing proposed from evidence; Tidy up intel and its routine.

## Batch 16: built, awaiting the owner

Widening and narrowing proposed from evidence (scoped-intel, Widening and narrowing), chosen by an agent under the owner's instruction of 2026-11-07 ("build what is next", no questions this session); not yet agreed by the owner. Starts from `b94771f`, uncommitted. Built test-first on the fake harness and its test clock and driven in the window: [proof](verification/2026-11-07-intel-proposals.md). Recorded in CHG-0054.

### Behavior

- **Uses by workspace**: each use (`search_intel`, `relied_on_intel`) is recorded with the using thread's workspace, or none.
- **Widening proposal**: when workspace intels in two or more workspaces say the same thing (the replacement closeness of batch 14), the intel panel proposes one global intel in their place, with the newest text and kind, listing each.
- **Narrowing proposal**: when a global intel was saved at least its kind's half-life ago and every use recorded over the last half-life came from threads of one workspace (at least one use), the panel proposes moving it to that workspace.
- **Nothing before approval**: a proposal changes nothing; **Approve** applies it, **Decline** removes it for good.
- **Applying a widening**: the newest intel becomes global ("Widened"), takes the sum of uses and the latest use; the others are merged into it ("Merged"), listed under Deleted, and their uses count for it.
- **Applying a narrowing**: the intel moves to the workspace ("Narrowed").
- Both are undoable from History like any change; a proposal no longer backed by evidence is refused.

### Provisional, until the owner decides

- Proposals are worked out from evidence when the panel is read, like fading; only decisions are stored. A declined proposal is the same set of intels (widening) or the same intel and workspace (narrowing); a new intel joining the set makes a new proposal.
- "Its whole half-life" is the kind's half-life in Settings, without the growth from uses; a rule never fades, so it is never narrowed. Uses before this batch have no workspace and do not count.
- No widening is proposed when a global intel already says the same thing.
- History entries of an applied proposal are the owner's, since the owner approved them.
- Archived intel is left out of both.

- A merged intel shows under Deleted as deleted; its history says merged.

### Checks

- Automated: 15 checks in `intelProposals.test.ts` on the test clock; 2 label checks; a two-step migration check of 0020 in the proof's folder.
- `bun run test` (302 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 17 of 17 mutations caught in a separate copy; the new checks fail 15 of 15 on `b94771f`.
- Driven in the window on the fake harness, days simulated in the database: see the proof.
- Not run: a live Claude Code thread whose uses become evidence.

### Staged, next intel batch

- Tidy up intel from the panel; its routine waits for routines.

## Batch 17: built, awaiting the owner

The warning before a thread starts with too large a starting context (thread-tree, Opening a thread; agreed in CHG-0007), chosen by an agent under the owner's instruction of 2026-11-07 ("build what is next", no questions this session); not yet agreed by the owner. Starts from batch 16's uncommitted state on `b94771f`. Built test-first on the fake harness and driven in the window: [proof](verification/2026-11-07-starting-context.md). Recorded in CHG-0055.

### Behavior

- **Preview**: while the owner types the first message of a thread opened beneath another, the form shows what it would start with (`PreviewStartingContext`): the request, the briefing and 20 latest entries, the intel in scope (scoped intel in full and the global index), the opener's messages since the journal's latest entry, and, since the architecture pass (CHG-0062), the workspace's own instructions, the instructions every thread receives, and the title and budget lines, each in estimated tokens. It measures the same sections the thread then receives, headings included (`startingContext.ts`).
- **Warning**: past 25% of the chosen model's context window, the form says the size, the share, and each part, and offers a model with a larger window, **Trim intel**, and **Start anyway**.
- **Trim intel** opens the intel panel of the parent's scope inside the form; the typed request stays, and the preview follows each change.
- **Refusal**: `OpenThread` is refused over the warning unless the owner chose Start anyway (`shouldStartAnyway`); the refusal names the share.

### Provisional, until the owner decides

- The warning share is fixed at 25%, as specified; it is not a setting.
- Every model counts 200,000 tokens (Batch 12), so no larger model is ever offered: the form says "No model has a larger context window."
- Threads opened by agents (`open_thread`) and asides are not warned: no owner is there to answer before they start.
- Starting a mission is not warned yet; its context is the first message, the workspace's and global intel.
- Skills are not counted: threads have none until tool-and-skill-loading.
- The parts are measured as tokens of their text (characters / 4), like the briefing limit. Since CHG-0062 the instructions every thread receives, the workspace's instructions, and the title and budget lines are counted too, so the warning measures what the harness receives; this reverses the earlier choice not to count the instructions and awaits the owner.
- The preview is asked for 300 ms after typing pauses.

### Checks

- Automated: 9 checks in `startingContext.test.ts`; 2 label checks.
- `bun run test` (311 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 13 of 13 mutations caught in a separate copy; the new checks fail 8 of 9 on the batch 16 state.
- Driven in the window on the fake harness: see the proof.
- Not run: a live Claude Code thread.

### Staged

- Summarizing the oldest part when a starting context exceeds the model's window (thread-tree, Opening a thread).
- The warning when starting a mission.

## Open questions, settled when a batch needs them

- Dependency gates and fake-first live launch (first-slice-design, Dependency gates).
- Recovery of turns interrupted by a crash or restart, and uncertain delivery.
- Idle as the mission state when no thread is urgent, including all Done or Stopped.
- Claude Code protocol verification; installed version 2.1.302.

## Batch 18: built, awaiting the owner

Harnesses and provider accounts ([provider-accounts](capabilities/provider-accounts/specifications.md)), chosen by an agent under the owner's instruction of 2026-11-07 to make Gild usable to build Gild with Claude Code (several accounts), Codex, and OpenCode, without questions. Starts from `ab85b66`. Built with stand-in checks first, then probed and driven live: [proof](verification/2026-11-07-harnesses-and-accounts.md). Recorded in CHG-0059.

### Behavior

- **Harness per thread**: Claude Code, Codex, or OpenCode, chosen at mission start and when opening a thread; `open_thread` takes `harness`. Kept for the thread's life.
- **Accounts**: the computer's own sign-in and accounts added in Settings, each a folder the harness uses as its home (ADR 0011). Sign in opens the harness's own login in Terminal. Remove refused while a mission not ended uses the account.
- **Models**: free identifiers per harness (`ModelChoice` is now a string), listed by each harness; "default" is the harness's own.
- **Adapters**: `codex.ts` (app server, JSON-RPC without the `jsonrpc` field) and `opencode.ts` (ACP), over `rpcProcess.ts`; `routeHarnesses` picks the adapter per turn.

### Provisional, until the owner decides

- Codex runs `workspace-write` with `on-request` approvals at the default level and `untrusted` at "Also commands and edits"; its escalations go to `answer_prompt` as a Bash prompt, file changes as Edit, sandbox widenings as "Permissions".
- OpenCode asks for every shell command (no sandbox) and, at the stricter level, every edit; its subagents are denied. Its starting context is written to `$TMPDIR/gild-opencode/<thread>.md` and given as `instructions`.
- The owner's own Codex and OpenCode settings (their MCP servers, skills, agents) still load in threads; Claude Code's stay off as before.
- Codex threads are not ephemeral: they appear in the owner's Codex history; OpenCode sessions in OpenCode's.
- OpenCode takes no effort; a steered message waits for its next turn.
- Codex and OpenCode report no cost: their turns count as subscription tokens (budget-control, Batch 11).
- Every model counts a 200,000-token window (Batch 12); larger-window suggestions come from the chosen harness's model list, which only Claude Code has, so Codex and OpenCode suggest none (CHG-0062).
- The Codex model list is cached 10 minutes per account; sign-in states are read when Settings or a picker opens, and on Refresh.
- Sign-in on Linux and Windows answers with the command to run in a terminal.
- `approvals.ts` still tells an allowed thread to set `dangerouslyDisableSandbox` for Bash, which only Claude Code has; the instructions themselves leave it out for Codex and OpenCode.

### Checks

- Automated: 21 checks in `harnesses.test.ts` on stand-ins; 3 opt-in live checks in `liveHarnesses.test.ts` (`GILD_LIVE_HARNESSES=1`, `GILD_LIVE_OPENCODE_MODEL`).
- `bun run test` (332 passed, 8 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, desktop build, Metro web export; 12 of 12 mutations caught in a separate copy.
- Driven in the window with the real harnesses: see the proof.
- Not run: signing in an added account; live Codex escalation and steering; live OpenCode permission prompts.

### Staged

- Thread-handover: changing a thread's harness, account, or model mid-thread (built in CHG-0096).
- Accounts for Control, routines, and workflows.
- Harness installs and updates offered from the app (architecture, Integrations).

## Review, refactor, and architecture pass (2026-11-07): committed (CHG-0062)

Started at HEAD `26bbb1d`, with the empty tree as the fixed point. Ran Standards and Specifications reviews and an architecture scan ([report](architecture-audit/architecture-audit-2026-11-07-1830.html)). The behavior-preserving refactors sit uncommitted in the working tree. Both reviewers verified them: no behavior, owner-facing wording, or contract changed. Checks after the refactor: `bun run test` 339 passed, 8 skipped, the same as before. After the architecture pass: 371 passed, 8 skipped. Typecheck, `bun run check`, `git diff --check`, and the desktop build pass.

### Open, for implementation (red/green): found by the Specifications review, not changed

- Done in CHG-0063, awaiting the owner ([proof](verification/2026-11-07-approval-fixes.md)):
  - **High**: the quote check now requires whole words, no negation before them in their sentence, and words naming the action (a verb of its sensitive kind, or a word an unlisted command shares).
  - **High**: commands wrapped in a shell `-c` script, `eval`, `env`, variable assignments, or a launcher (`time`, `nohup`, `exec`, `nice`…) now meet the sensitive list. Still to probe live: the exact command format Codex sends.
  - **Medium**: one-time allowances end with their turn (`Approvals.endTurn`).
- Done in CHG-0064, awaiting the owner ([proof](verification/2026-11-08-edits-and-pattern-kinds.md)):
  - **Medium**: OpenCode asks Gild for every edit; at the default level an edit inside the thread's folder (after `..` and links) runs unasked, any other asks. Proven live on OpenCode 2.2.0.
  - **Medium**: a standing permission covers only actions of its own kind (`kindOfPermission`), and the question shows the pattern Always allow will save.
  - **High, found live**: Codex escalates as `/bin/zsh -lc '…'`, which asked the owner twice for one push and escaped standing patterns; `targetOf` now unwraps one whole shell `-c` script. This also closes CHG-0063's open probe of the Codex command format.
- Done in CHG-0065, awaiting the owner ([proof](verification/2026-11-08-opencode-refusals.md)):
  - **Medium, found live**: rejecting an OpenCode permission ended its whole prompt (`stopReason: "cancelled"`). OpenCode 2.2.0 has no setting to continue and ACP carries no message, so the adapter now sends the refusals, with the owner's message, as a new prompt in the same turn; an interrupt still ends it. Proven live.
- **Medium**: Codex sandbox widenings ("Permissions") are granted without a question.
- **Medium**: Codex and OpenCode threads load the owner's own MCP servers and skills (against CHG-0022 and CHG-0031; listed as provisional above).
- **Medium**: the widened sandbox hosts may let `git push` or `npm publish` run without a prompt. Probe first, and ask the owner before changing anything.
- Done in CHG-0066, awaiting the owner ([proof](verification/2026-11-08-low-findings.md)), **Low**:
  - a change inside the thread's folder, asked at "Also commands and edits" on any harness, is asked as "Change a file." rather than as outside the workspace;
  - the running limit counts threads in Attention inside a turn (provisional: thread-tree's "At most 8 threads run at once" read as threads inside a turn);
  - the opener-message cap line gives its count;
  - a turn on a removed account fails with the reason before the harness starts (provisional: the owner may prefer refusing the reopen, or moving the thread to the harness's own sign-in);
  - interrupted OpenCode turns count usage: already true when OpenCode answers the cancel (CHG-0065); a process dying during an interrupt now keeps the earlier prompts' usage.
- **Low**, still open:
  - The desktop notification fires only for approval questions.
  - The depth and running limits are not adjustable.
  - Claude Code rules come from `~/.claude/settings.json` only, not from an added account's folder or the workspace's settings, and nothing tests that they are forwarded.
  - The model can call `answer_prompt` directly.

### Awaiting the owner

- The architecture pass's behavior changes (CHG-0062, [proof](verification/2026-11-07-architecture-pass.md)). All six audit candidates were applied at the owner's request. Still to accept:
  - the wider restart key;
  - `answer_prompt` hidden from Codex and OpenCode;
  - a failed prompt answer ending the turn;
  - open harness questions withdrawn at turn end;
  - the fake harness's new prompt echo;
  - the starting-context size now counting the instructions, workspace, and title and budget lines (Batch 17 above);
  - one announcement for SetMissionBudget and the auto-archive sweep;
  - one transaction each for the account, browsable-root, permission, and dismiss-prompt requests.
- Every intel deletion declining its awaiting changes: today only the owner's deletion, an undone save, and a merge decline them, and a thread's `forget_intel` does not. The intel store keeps that difference in one place.
- A glossary term for the harness, account, model, and effort bundle the code calls "runner". The glossary says to avoid "runner" for a harness.

### Left open on purpose

- Files still past about 250 lines after the pass:
  - `store.ts`: append-only migrations;
  - `service.ts`;
  - `intelStore.ts`: splitting it would expose the raw writers;
  - `approvals.ts`, `threadTools.ts`, `intel.ts`, `codex.ts`, `opencode.ts`, `suggestions.ts`, `threads.ts` (261);
  - `requests.ts`;
  - the large test files.
- Import cycles between `commands.ts`, `threads.ts`, and the modules that compose operations: they are safe, since each side is used only inside functions, and the bundled service starts.
- `JSON.parse … as` casts: decoding instead would change how malformed input is handled.
- Multi-behavior test titles, the `server.test.ts` frame casts, and the app client's pending-codec cast.

Quest tree batch (CHG-0095): the Quest and Side-quests menu restyled after the owner's mockup; typecheck, lint, and 458 tests pass; the look awaits the owner ([proof](verification/2026-11-10-quest-tree-menu.md)).

Thread handover batch (CHG-0096): the owner changes a quest's harness, account, Companion, and effort between turns from the message box; a harness or account change gives the new session the whole conversation, and earlier replies keep their provider's mark and name; typecheck, lint, and 473 tests pass; driven in the web export on the fake harness; the look and a live handover await the owner ([proof](verification/2026-11-10-thread-handover.md), [specification](capabilities/thread-handover/specifications.md)).

Rituals batch (CHG-0098): scheduled runs in a quest of their own, with an ordered list of fallback Companions, a card of its own on the board, Run now, and an edit panel; typecheck, lint, and 496 tests pass; driven in the web export on the fake harness; the look and a Ritual firing on a live harness await the owner ([proof](verification/2026-11-10-rituals.md), [specification](capabilities/rituals/specifications.md)).

Rituals place (CHG-0100): Rituals leave the quest board for a place of their own, with a rail category, a screen of cards, and a compact form; typecheck, lint, and 500 tests pass; driven in the web export on the fake harness; the look awaits the owner ([proof](verification/2026-11-10-rituals.md)).


Workshop batch (CHG-0101): the settings page as the owner's mockup, with provider logos and a pinned Settings guide; format, typecheck, lint, and 505 tests pass; driven in the web export on the fake harness; the look awaits the owner ([proof](verification/2026-11-10-workshop.md)).

Message attachments batch (CHG-0102): images attached to the owner's messages by paste, drop, or file button, uploaded first and referenced by the message, handed to Claude Code, Codex, and OpenCode in their own forms, refused when the harness cannot read them. Starting revision `77d925b`, with the uncommitted Workshop work (CHG-0101) in the tree and not mine. Specification: [message-attachments](capabilities/message-attachments/specifications.md). Provisional: a Companion whose vision support is unknown (every OpenCode model) is allowed; drafts older than a restart are erased; the thumbnail has no larger view. Status: built and checked (CHG-0103; [proof](verification/2026-11-10-message-attachments.md)); the look awaits the owner. Pasting very large text no longer freezes the box, and the service starts again.

## Delete a Ritual · 2026-11-10 · built and checked, owner look pending

Starting commit `ca173da`; branch `ritual-delete`. Delete added to the Ritual card (CHG-0108). Not decided by the owner: whether deleting should offer to delete the quest too (kept as agreed: the quest stays). Full suite not run.

## Conversation terminal · 2026-11-10 · owner review pending

Authorized by the owner's request for Delta's `!` interaction, default shell, home folder without a realm, realm root with one, and shell output included in context.
Implementation and verification are on branch `bang-terminal`, based on `e770774`, in `/private/tmp/gild-bang-terminal`.
The terminal appears as an interactive owner-message bubble in the conversation and renders as a frozen terminal block when sent.
The same serialized output travels through the existing SendMessage and harness context paths.
The progress-display side-quest fix is included: completed approvals no longer masquerade as current work.
Proof and current validation: [terminal verification](verification/2026-11-10-bang-terminal.md).
The owner requested integration onto local main, without pushing to the remote.

Terminal follow-up: the owner confirmed successful live use and requested a handoff and publication.
CHG-0120 keeps the soft blue throughout the live and saved terminal; the latest appearance awaits an explicit look.
The shared handoff is `.agents/handoffs/2026-11-10-1538-conversation-terminal.md`.
