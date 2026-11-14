# Provider accounts

Status: built in batch 18 (CHG-0059) by an agent under the owner's instruction of 2026-11-07, without questions; not yet agreed or accepted by the owner. Every rule below is provisional until the owner agrees it.

## Problem and outcome

The owner works with several harnesses and, for some, several subscriptions: two Claude accounts, a ChatGPT plan for Codex, providers behind OpenCode. Each thread must run on the harness and account chosen for it, with its own sign-in and conversations, so Iskios can build Iskios with whichever harness and account fits each part of the work.

## Agreed behavior

### Harnesses

- A thread runs on one harness: **Claude Code**, **Codex**, or **OpenCode**. A mission's top thread takes the harness chosen at mission start; a thread opened beneath another takes its opener's unless the opener chooses another. A thread can open a thread on another harness through `open_thread`'s `harness`.
- A thread keeps its harness until the owner hands it over to another between turns ([thread-handover](../thread-handover/specifications.md)).
- Each harness offers its own models: Claude Code its four families by version (Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5), Codex the models its app server lists for the signed-in account, OpenCode the models `opencode models` lists. No list offers a "Default model": a model is always chosen. A new quest starts on Sonnet 5.5 until the owner picks another, and on another harness than its opener's a thread takes that harness's first listed model unless one is chosen. A thread that began with the harness's own default (`default`) keeps running on it and shows as "Default model".
- Effort applies to Claude Code and Codex. OpenCode takes no effort.
- A harness that is not installed shows as "(not installed)" in the pickers and says why in Settings. The Workshop offers **Install** on its row. Install runs `npm install --global <official-package>@latest` using the computer's npm configuration, shows "Installing…", and refreshes harnesses when done. Node.js and npm must already be installed, and npm's global prefix must be writable. Failures show a reason and allow retry; an installation whose configured executable still cannot run reports the PATH or configured-path issue. Installed harnesses retain Update. Installation never signs the owner in.

### Accounts

- Every harness has the **computer's own sign-in**: what the harness uses outside Iskios. It is named after the computer: the host's name (the machine's until the owner renames it in the Workshop's **Computer name** card, the Providers section's first card; a blank name returns to the machine's). Accounts, plan-limit rings, budgets, usage and a thread's header all show that name, and follow a rename (CHG-0257).
- **Any account can be renamed, apart from the computer's name** (the owner, 2026-11-13: "We should be able to rename an account, independently of the device name we are on", CHG-0265). Each account's row in the Workshop's Providers section has **Rename**, for added accounts and for each harness's own sign-in alike. A harness's own sign-in keeps the host's name until the owner names it, after which a rename of the computer no longer changes it; saving it blank returns it to the host's name. The new name shows everywhere the account does (pickers, a thread's header, plan limits, budgets, usage). Names are per harness, so the computer's Claude sign-in and its Codex one can be named differently.
- The owner adds more accounts in the Workshop's **Providers** section, with **Add account** at the foot of the harness's card, by name (for example "Work"). Each added account has its own folder, where the harness keeps that account's sign-in and conversations: `CLAUDE_CONFIG_DIR` for Claude Code, `CODEX_HOME` for Codex, `XDG_DATA_HOME` for OpenCode.
- **Sign in** opens the harness's own sign-in (`claude auth login`, `codex login`, `opencode auth login`) in a Terminal window, pointed at the account's folder. Iskios never sees, reads, or stores the credentials (requirements, Comply with provider terms). **Refresh** reads each account's state again.
- The Workshop's Providers section has one card per harness, holding its logo, name, version, state, and accounts (the former Harnesses and Accounts cards, merged at the owner's request, CHG-0268). Each account's row shows its name, its detail, a Signed in badge, **Rename**, and a "⋯" menu with **Sign in** (**Sign in again** once signed in) and, for an added account, **Remove**. A harness's card offers **Update** beside a harness whose newest release (the `latest` tag of its npm package: `@anthropic-ai/claude-code`, `@openai/codex`, `opencode-ai`) is higher than the installed version, saying "Ready" and "Update available · 2.1.325". Update runs the harness's own command (`claude update`, `codex update`, `opencode upgrade`), which updates it the way it was installed, then lists the harnesses again; a failure shows its last lines. A newest release that cannot be read (offline) offers nothing; one lower than the installed version is ignored. Threads already running keep the version they started on until they restart.
- Settings shows each account's state as the harness's own status command reports it: Signed in (with who, such as an email and plan), Signed out, or unknown.
- An account's row also carries its **account budget** and **credits**, and a subscription's **plan limits** where its harness reports them, agreed in [budget-control](../budget-control/specifications.md#account-budgets-and-credits) (CHG-0126). Each turn records the **billing kind** of the sign-in it ran with.
- A thread runs on the account chosen when it starts; a thread beneath keeps its opener's account on the same harness, and takes the computer's own sign-in on another harness.
- **Remove** deletes an added account and its folder. It is refused while a mission that is not ended has a thread on that account, since the thread's conversation lives in that folder. Threads of ended missions keep the account's identifier and show "Removed account".
- **The Companion picker has a tab for each account** (the owner, 2026-11-13: "I'd like the companions selection to also be based on account. If I have 2 Claude subscriptions for example, I should see both as different options", CHG-0264). Each harness has one tab for each account it can sign in with, so two Claude subscriptions are two tabs, each marked with its account's name and listing that account's own models; a harness with one account keeps its single tab. Choosing a model in a tab chooses the harness, the account, and the model together; the separate Account menu is gone from the picker. A signed-out account's tab is dimmed and lists no models; an uninstalled harness stays dimmed; a thread, backup, or preset on a removed account keeps a "Removed account" tab so its Companion still shows. The host reads each signed-in account's models itself (kept per account for 10 minutes), since what a plan offers can differ. The Companion's summary names the account when the harness has several. The Workshop's default Companion shows each harness's own sign-in only, because it carries no account (above); its Presets, backups, a quest's Companion, and a side-quest's show every account. The form's Harness, Account, and Companion fields list the chosen account's models.
- A new mission always starts on the Workshop's default Companion (harness, model, effort) and the computer's own sign-in; only the folder is remembered from the last mission (CHG-0257, replacing the last mission's harness, account, model, and effort). The account is chosen per mission.

### Approvals on every harness

- The approval level applies to every harness (action-approval). Claude Code keeps its own sandbox (CHG-0031).
- **Codex** runs in its workspace-write sandbox. At **Risky actions only** it asks only to leave the sandbox, and Iskios answers that as a Claude Code prompt: unasked unless sensitive. At **Also commands and edits** every command Codex does not trust asks.
- **OpenCode** has no sandbox here: every shell command asks Iskios, which runs it unasked unless it is sensitive. Edits ask only at **Also commands and edits**.
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
- Whether the owner's own Codex and OpenCode settings (their MCP servers, skills, and agents) should load in Iskios's threads, as they do now, or be switched off as they are for Claude Code.
