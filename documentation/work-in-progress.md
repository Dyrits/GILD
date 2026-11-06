# Work in progress

## Goal

Build the first slice iteratively (CHG-0025): each batch leaves a runnable application with its checks. Design under review: [first-slice-design.md](first-slice-design.md) and the mission-tracking, thread-tree, and thread-messaging blueprints. Starting revision: `e445b44`.

## Batch 1: delivered

Delivered in CHG-0026 (commit 649e232). Provisional behavior still in place until decided: on startup, threads left Running become Idle and interrupted turns are not replayed; the desktop app loads only the Metro dev server; rollback of a failed mission start is not directly tested.

## Batch 2: delivered

Delivered in CHG-0030 (commits ddb888d to d62a904). Provisional behavior still in place until decided: a failed turn's messages become undelivered and are retried with the next message; the live check runs only with `OPENMISSION_LIVE_CLAUDE=1`; a missing `claude` executable is covered by the stand-in checks only.

## Batch 3: delivered

Delivered in CHG-0033; the owner skipped the run-through and the desktop notification is unverified. Agreed in CHG-0031: Claude Code's built-in tools behind action approval. The user's own MCP servers, skills, and Claude settings stay off.

### Behavior

- **Approval level** in Settings: **Risky actions only** (default) or **Also commands and edits**.
- **Default level**: Claude Code runs sandboxed with in-workspace edits and sandboxed commands unasked. The thread's instructions list the risky actions (action-approval, Asking); the thread calls `request_approval` before one.
- **Harness prompts** reach OpenMission through `--permission-prompt-tool` on the local MCP server. A prompt matching the action just allowed in that thread runs once without a question; one matching a standing permission's pattern runs unasked; any other prompt becomes a question. At **Also commands and edits**, every prompt is a question.
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
- Live check behind `OPENMISSION_LIVE_CLAUDE=1`: done, 44 of 44 pass with Haiku.
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

- Settled in CHG-0032: the sandbox protects `.git` (its write settings cannot lift a protected path, per Claude Code's settings reference), so OpenMission answers prompts for local git itself at the default level when the sandbox runs. Verified in the window: a mission created a repository, committed, and branched with no question.
- The desktop notification was not observed by an agent.
- The service passes its whole environment to Claude Code except `OPENMISSION_` variables. Launched from an agent's shell, that leaked the agent's `CLAUDE_*` and `GIT_CONFIG_*` variables; a normal launch is not affected. Not changed.

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

## Batch 9: agreed, in progress

Mission tracking, agreed in CHG-0045, built here test-first. Sources: mission-tracking specifications; mission-journal specifications (When a mission ends).

Resumption status (2026-11-06): implementation is present, including dashboard row ending actions added after recovery. Tests pass (175, five opt-in live checks skipped), typecheck, lint, desktop build, and diff whitespace checks pass. Recovered mutation evidence catches 15/15 mutations. See [verification and remaining checks](verification/2026-11-06-mission-tracking.md). Next: drive the new dashboard actions in the Electron window, plus rename and workspace filtering, from the main chat (desktop control is unavailable in this side thread). Visual polish is deferred by the owner. Changes remain uncommitted on `63d4b15`; no delivery or acceptance recorded.

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

## Open questions, settled when a batch needs them

- Dependency gates and fake-first live launch (first-slice-design, Dependency gates).
- Recovery of turns interrupted by a crash or restart, and uncertain delivery.
- Idle as the mission state when no thread is urgent, including all Done or Stopped.
- Claude Code protocol verification; installed version 2.1.302.
