# Provider accounts

Status: built in batch 18 (CHG-0059) by an agent under the owner's instruction of 2026-11-07, without questions; not yet agreed or accepted by the owner. Every rule below is provisional until the owner agrees it.

## Problem and outcome

The owner works with several harnesses and, for some, several subscriptions: two Claude accounts, a ChatGPT plan for Codex, providers behind OpenCode. Each thread must run on the harness and account chosen for it, with its own sign-in and conversations, so Gild can build Gild with whichever harness and account fits each part of the work.

## Agreed behavior

### Harnesses

- A thread runs on one harness: **Claude Code**, **Codex**, or **OpenCode**. A mission's top thread takes the harness chosen at mission start; a thread opened beneath another takes its opener's unless the opener chooses another. A thread can open a thread on another harness through `open_thread`'s `harness`.
- A thread keeps its harness for its whole life; changing it mid-thread is thread-handover, not built.
- Each harness offers its own models: Claude Code its aliases (Fable, Opus, Sonnet, Haiku), Codex the models its app server lists for the signed-in account, OpenCode the models `opencode models` lists. **Default model** is the harness's own default. On another harness than its opener's, a thread takes that harness's default model unless one is chosen.
- Effort applies to Claude Code and Codex. OpenCode takes no effort.
- A harness that is not installed shows as "(not installed)" in the pickers and says why in Settings.

### Accounts

- Every harness has the **computer's own sign-in** ("This computer"): what the harness uses outside Gild.
- The owner adds more accounts in Settings, **Harnesses and accounts**, by name (for example "Work"). Each added account has its own folder, where the harness keeps that account's sign-in and conversations: `CLAUDE_CONFIG_DIR` for Claude Code, `CODEX_HOME` for Codex, `XDG_DATA_HOME` for OpenCode.
- **Sign in** opens the harness's own sign-in (`claude auth login`, `codex login`, `opencode auth login`) in a Terminal window, pointed at the account's folder. Gild never sees, reads, or stores the credentials (requirements, Comply with provider terms). **Refresh** reads each account's state again.
- Settings shows each account's state as the harness's own status command reports it: Signed in (with who, such as an email and plan), Signed out, or unknown.
- A thread runs on the account chosen when it starts; a thread beneath keeps its opener's account on the same harness, and takes the computer's own sign-in on another harness.
- **Remove** deletes an added account and its folder. It is refused while a mission that is not ended has a thread on that account, since the thread's conversation lives in that folder. Threads of ended missions keep the account's identifier and show "Removed account".
- The mission start remembers the last mission's harness and account with its model and effort. Settings holds the default harness, model, and effort before any mission.

### Approvals on every harness

- The approval level applies to every harness (action-approval). Claude Code keeps its own sandbox (CHG-0031).
- **Codex** runs in its workspace-write sandbox. At **Risky actions only** it asks only to leave the sandbox, and Gild answers that as a Claude Code prompt: unasked unless sensitive. At **Also commands and edits** every command Codex does not trust asks.
- **OpenCode** has no sandbox here: every shell command asks Gild, which runs it unasked unless it is sensitive. Edits ask only at **Also commands and edits**.
- Native subagents stay off on every harness; threads open threads with `open_thread` (ADR 0007).

### Steering

- Claude Code and Codex take a message steered into a running turn. OpenCode cannot take one mid-turn: a steered message waits for its next turn.

## Acceptance

- A mission started on Codex or OpenCode runs, reaches its thread tools, and reports its usage. Verified live on 2026-11-07 (`liveHarnesses.test.ts`, and in the window).
- A thread on one harness opens a thread on another, whose result comes back. Verified with stand-ins and in the window.
- An added account's folder is the harness's configuration folder for its threads, and its own sign-in is separate from the computer's. Verified with stand-ins; in the window, an added Claude Code account read as Signed out while the computer's read as signed in.
- A sensitive command on Codex or OpenCode asks the owner; an ordinary one runs unasked. Verified with stand-ins only.

## Not decided

- Choosing an account for Control, routines, and workflows when those are built.
- Whether removing an account should also remove the Claude Code sign-in kept in the system keychain.
- Whether the owner's own Codex and OpenCode settings (their MCP servers, skills, and agents) should load in Gild's threads, as they do now, or be switched off as they are for Claude Code.
