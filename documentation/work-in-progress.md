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

## Batch 4: agreed, built, awaiting the owner's run-through

Workspace attachment, first step, aimed at self-hosting: start a mission on a folder such as this repository and let its thread work there. Built as a draft while the owner was away, then agreed in CHG-0034 with three changes: Show hidden, Retry on a missing folder, and download hosts for workspace threads. CHG-0035 then made threads autonomous (only sensitive actions ask), rewrote questions for casual users, and replaced the in-app folder browser with the system's folder dialog. Agreed sources: CHG-0034, CHG-0035, `capabilities/workspace-attachment/specifications.md`, and the first-slice design's Workspace row.

### Behavior

- **Choosing**: the dashboard's start form has **Workspace: none** with **Choose folder…**, which opens the system's own folder dialog (Finder, Explorer), with its New Folder and hidden-file controls. Any existing folder may be chosen; a path that is not one is refused and nothing is saved. No workspace keeps the mission's scratch folder. The in-app browser (with **Up**, **New folder**, and **Show hidden**) and the browsable roots stay in the service and in `apps/app/src/folderBrowser.tsx`, checked but not shown, for phone browsing (CHG-0035). The service still refuses browsing outside the roots.
- **Workspace identity**: a folder becomes a workspace the first time it is chosen, named after the folder, kept by identifier; choosing the same folder again reuses it. The top thread's workspace is fixed at start.
- **Running there**: the thread's harness runs in the folder. Its starting context names the workspace and path, or says it has none and names the scratch folder.
- **Instructions**: the folder's `AGENTS.md` and `CLAUDE.md` are put into the starting context, each cut at 50,000 characters, and re-read each turn; a change restarts the Claude Code process, resuming its conversation. Probe (2026-11-06, Claude Code 2.1.302): with `--setting-sources ""`, Claude Code reads no `CLAUDE.md` itself. `@` imports inside them are not followed.
- **Standing permissions**: Always allow in a workspace thread saves the permission for the workspace; it applies to every mission's threads in that workspace, not to a nested workspace or the scratch folder. Threads with no workspace keep mission scope. Allow everywhere widens either. The Permissions page shows "In workspace <name>".
- **Shown**: the workspace name on the dashboard row; the workspace and path, or "No workspace", under the conversation title, with "folder missing" when it is gone.
- **Missing folder**: a thread about to start a turn in a workspace whose folder is gone goes to Attention and says "The workspace folder <path> no longer exists." with **Retry**. Its messages wait undelivered, new ones join them, and a restart keeps the thread waiting. Retry runs them once the folder is back, or returns the thread to Attention. Stop ends the wait. Relocate and Clone again stay staged. No desktop notification yet: it follows open questions only.
- **Sandbox in a workspace**: at the default level, a workspace thread's sandbox also reaches `registry.npmjs.org`, `github.com`, `objects.githubusercontent.com`, and `release-assets.githubusercontent.com`, writes Bun's and Electron's caches (`~/.bun/install/cache`, `~/Library/Caches/electron`, `~/.cache/electron`), listens on loopback, and runs with `NODE_USE_ENV_PROXY=1` so Node's downloads go through the sandbox proxy. Threads with no workspace keep the closed sandbox. Probe (2026-11-06, Claude Code 2.1.302, Bun 1.4.3, Electron 45.2.3, on a fresh clone): the hosts alone were not enough. `bun install` needed the cache write, Electron's download needed the proxy variable, and the tests needed loopback; with all four, `bun run test` passed 61 of 61 (2 skipped) inside the sandbox.
- **Autonomy (CHG-0035)**: at **Sensitive actions only**, a harness prompt runs without a question unless OpenMission's sensitive list recognizes it (`sensitivityOf` in `patterns.ts`): push, publish, deploy, posting on GitHub, mail or `osascript`, `curl` that sends data, `ssh`/`scp`/`rsync` to a host, `rm` outside the workspace or of `.git`, git commands that discard work, system changes (`sudo`, `defaults write`, global installs, `brew install`, …), secrets (`~/.ssh`, `~/.aws`, `security`, `gh auth token`), and file-tool writes outside the workspace. Each such run leaves a line "Ran · <Claude Code's reason> · time". This holds with or without a sandbox. The thread's instructions list the sensitive actions and tell it to work autonomously otherwise. The local-git special case (CHG-0032) is gone: local git is ordinary work. At **Also commands and edits**, every prompt still asks.
- **Questions (CHG-0035)**: a sensitive harness prompt reads "<Claude Code's reason, or the kind of action>. <What it affects>", for example "Push the branch to GitHub. This sends your commits off this computer, where everyone with access to the repository can see them." Buttons: **Allow**, **Always allow**, **Deny**, with an optional message field used by Deny. Discard is gone; the kind of action ("Push code") is what Always allow saves.
- **Out**: cloning, own copies, the Workspaces page (rename, hide, delete), relocation, thread-opened workspaces, phone browsing, workspace skills and harness settings (Claude Code still runs with `--setting-sources ""`), workspace MCP servers, intel.

### Checks

- Automated with the fake harness and temporary folders: `packages/service/test/workspaces.test.ts` (browsing, roots, New folder, refusal outside roots and through a link, identity reuse, folder and context, scratch folder, missing folder, workspace-scoped permissions incl. nested and scratch). Adapter check with the stand-in: Claude Code starts in the workspace with its `AGENTS.md` in `--append-system-prompt`.
- After CHG-0035: `bun run test` passes 71 with 2 skipped (the local-git checks were removed with their code; the sensitive-list, autonomy, and any-folder checks were added; the browsing checks stay); the live run with `OPENMISSION_LIVE_CLAUDE=1` passed 65 of 65 before the browsing code was kept. The desktop shell builds. Not driven in the window: the native dialog and the new question card. After CHG-0034: `bun run test` passed 68 with 2 skipped, and with `OPENMISSION_LIVE_CLAUDE=1` 70 of 70; `bun run typecheck` and `bun run check` pass. The new checks (Show hidden, the five missing-folder checks, the workspace sandbox settings) failed before their code was written. The draft's workspace checks were shown able to fail by mutation: [proof](verification/2026-11-06-workspace-batch.md).
- Driven in the Electron window with Claude Code and Haiku, on a clone of this repository under a browsable root. The thread quoted `AGENTS.md` without reading files, created a file, and committed it locally with no question.
- Reviewed (review-and-refactor, Standards and Specifications): the refactors are applied and verified by the same reviewers. Open: `@` imports and a check for restart on instruction change. Retry and the hidden-folders choice were settled in CHG-0034.
- Owner run-through: pending. Start a mission on this repository (or a copy), ask for a small change, and watch the thread follow `AGENTS.md`, run `bun run test` unasked, and commit. Rename a workspace folder, send a message, see Retry, rename it back, and choose Retry. Choose the folder with Finder. Check that reading and listing files raises no question, and that a push asks in plain words.

### Open, for the owner

- In a fresh clone, `bun install` still ends with an error in the sandbox: the `prepare` script runs `git config core.hooksPath`, and the sandbox protects `.git/config`. The dependencies are installed by then. An existing checkout, such as this repository, is not affected.
- Whether a workspace should also load its own Claude Code settings and skills (`--setting-sources project`), which would also let project hooks run.
- A missing-folder wait raises no desktop notification.
- The sensitive list is best effort: a command it does not recognize runs, at the default level, unless the thread flags it. The stricter level remains for owners who want every prompt to ask.

## Open questions, settled when a batch needs them

- Dependency gates and fake-first live launch (first-slice-design, Dependency gates).
- Recovery of turns interrupted by a crash or restart, and uncertain delivery.
- What resets the chatter count.
- Idle as the mission state when no thread is urgent, including all Done or Stopped.
- Claude Code protocol verification; installed version 2.1.302.
