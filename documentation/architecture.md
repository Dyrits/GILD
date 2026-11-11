# Architecture

Gild is a desktop application whose local service owns all data in one SQLite file and runs every thread through harness adapters. One Expo app is the interface everywhere: its web build runs in the Electron desktop window and as the installable phone web app, and the same code builds native phone apps later. A relay Worker, deployed by each user to their own Cloudflare account, carries the phone's end-to-end encrypted traffic and receives webhook triggers. The first slice is built (batches 1–18 in `documentation/work-in-progress.md`): the local service, the harness adapters for Claude Code, Codex, OpenCode, and a fake, provider accounts, scoped lore, and the app in the desktop window. The phone web app, the relay Worker, routines, and workflows are not built yet.

## Future multiplayer: open architecture questions

Multiplayer must eventually support both invited people joining one host's missions and collaboration across people's own installations. The single-user design below describes the first build. Its modules and data model must preserve the hosted agreements below and identify assumptions that would block future execution or synchronization across installations.

For now, each shared mission has one host installation that owns its authoritative state. Collaborators join from a browser or their own installation. Collaboration pauses while that host is offline. The user accepted this working choice on 2026-11-04, subject to evolution; replicated state and offline edits remain possible future changes.

The following agreements define the first hosted version:

For the first hosted multiplayer version, all agents run on the mission host. Each guest has one of two permissions: triggering agents or discussing only. Discussion-only guests write in discussions beneath messages. Their discussion messages enter agent context only when the host explicitly submits selected messages. The host may instead write their own conclusion. The user confirmed these choices on 2026-11-05 (CHG-0016). Automatic discussion summarization is deferred in the [backlog](backlog.md).

Only the host approves risky actions, grants standing permissions, and changes budgets. Guest-triggered work uses the host's provider account and counts toward the mission and global budgets (CHG-0017). Guest permission to trigger agents does not grant approval or budget authority.

When sharing a mission, a toggle controls whether its agents retain access to the host's selected MCP connections, skills, and lore. It is on by default, and applies regardless of who triggers a turn. With it off, all turns in that shared mission use only resources the host explicitly selects. Guests see shared conversations and agent results; resource settings, credentials, and unshared lore remain hidden. Agent replies may reveal information obtained through enabled resources. The user confirmed this access and visibility boundary on 2026-11-05 (CHG-0018).

Guests use a separate identity approved by the host; no central Gild account is required. Each invitation is single-use and grants access to one mission, with discussion-only permission by default. The host may grant permission to trigger agents when inviting or later (CHG-0019). Opening an invitation creates a pending request with the guest's chosen name. The host verifies the person through a channel they already trust, then approves access; a name or possession of the link alone does not establish identity. An unused invitation expires after 24 hours, and the host may cancel it earlier or create a replacement (CHG-0021).

An invited guest sees the whole mission, including past conversations, all its threads, and results. Before sharing, the host sees that this is the scope of access. Removing a guest immediately blocks their access, cancels their queued requests, and stops turns they triggered that are still running. Completed results remain in the mission; removal cannot undo actions already performed. Changing a guest from triggering agents to discussion-only cancels their queued requests but lets turns already running finish. They retain discussion access and cannot start further turns. The user confirmed these choices on 2026-11-05 (CHG-0020).

- A paired device represents the owner. Guest access uses its own identity and mission grant; possession of a device pairing must not imply permission to all missions.
- Workspace paths and harness processes belong to the mission host in the first hosted version. Future execution across installations will need workspace identities beyond local paths.
- One local service owns mission state under the current working choice. If independently writable replicas are introduced later, they will require synchronization and conflict rules.

The first hosted version keeps mission documents and data on the host and transmits shared conversations and results to invited guests. Guest local copies are a future direction; their scope, synchronization, and retention rules remain to be designed (CHG-0021). Removing access cannot erase information a guest has already saved or copied.

Mission-state ownership is settled provisionally. Execution, guest discussion behavior, host authority, spending, resource access, guest identities, mission invitations, history access, revocation, permission downgrades, and host-held mission data are settled for the first hosted version. Future guest local copies and collaboration across installations remain design work. SQLite and the service boundary do not by themselves require replacement.

## Stack

- **Language**: TypeScript everywhere, in one Bun workspace.
- **Runtime**: Node for the local service; Bun for package management and scripts.
- **Effect**: Effect 4 in the local service and the relay Worker; in the UI only Effect Schema's decode and encode functions for shared contracts. See [0010](architecture-decision-record/0010-effect-in-the-service-and-relay.md).
- **Toolchain**: Expo CLI with Metro builds the app. Vite+ is excluded. Vitest with `@effect/vitest` tests on Node; Biome lints and formats (CHG-0025).
- **Service host and transport**: Electron runs the service in a utilityProcess on its bundled Node. SQLite is reached through Effect's Node driver over `node:sqlite`. The app talks to the service over one authenticated loopback WebSocket; shared records are Effect Schema definitions in `packages/contracts` (CHG-0025).
- **Desktop shell**: Electron. See [0004](architecture-decision-record/0004-electron-desktop-shell.md).
- **Installed app and development**: the owner runs a packaged "Gild"; development and checks run as "Gild Dev" with their own profile and data, so they never share the running app's window, lock, or database. See [0013](architecture-decision-record/0013-installed-app-apart-from-development.md).
- **Conversation terminals**: node-pty in the desktop process and xterm in the web composer, with sent transcripts persisted through ordinary owner messages; see [0012](architecture-decision-record/0012-desktop-conversation-terminals.md).
- **Storage**: one SQLite file, with full-text search for lore; `sqlite-vec` later if semantic search is needed. See [0002](architecture-decision-record/0002-one-local-service-owns-all-data.md).
- **Harness integration**: each harness's command-line tool driven directly: Claude Code over its JSON stream, Codex through its app server, OpenCode and others through the Agent Client Protocol (ACP). See [0008](architecture-decision-record/0008-drive-harness-tools-directly.md).
- **Thread tools**: a local MCP server. See [0005](architecture-decision-record/0005-thread-tools-over-mcp.md).
- **Relay and phone hosting**: a Cloudflare Worker with one Durable Object per pairing, on the user's own free account. See [0003](architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md).
- **License**: Apache 2.0.
- **UI**: one Expo app (React Native with `react-native-web`) for desktop, phone web, and later native phones; web-only widgets embedded as web components. See [0009](architecture-decision-record/0009-one-expo-app-everywhere.md).

## Parts

- **Local service**: a Node process the desktop app starts. It serves every capability, owns all data (missions, threads, turns, workspaces, thread messages, journals, lore, routines, workflows, approvals, budgets, pairings), runs the harness adapters and the routine and workflow scheduler, and hosts the MCP server that gives threads their tools.
- **Harness adapters**: a library inside the local service. Each one turns a harness's own protocol into one common event stream that the service stores as turns, and gives the harness the global and workspace MCP servers, the thread tools, and the skills in scope.
- **App**: the Expo app with every screen. It holds no product data and talks only to the local service's interface, directly on the desktop and through the relay Worker on a phone.
- **Desktop app**: the Electron shell that starts the local service and loads the app's web build. It serves device-pairing by showing the pairing code.
- **Phone web app**: the app's web build, installable from the browser and served by the relay Worker. It holds only its pairing keys. Native iOS and Android builds of the same app come later, through the stores.
- **Relay Worker**: the user's own Cloudflare Worker. Infrastructure for device-pairing and routine-running: it forwards encrypted traffic between the local service and paired devices without reading it, serves the phone web app, and forwards webhook triggers to the local service. It owns no product data; each pairing's Durable Object holds only the connection state and the messages queued for a device that is offline.

### Inside the local service (as built)

Source layout (`packages/service/src`, CHG-0125): a folder holds modules that depend only on folders before it, and each folder's `index.ts` is its interface, exporting only what other folders use.
`core/` is the shared base (errors, changes, settings, store, spending, execution types, tokens, words), `harness/` the adapters and the tools that ask them (everything under "Harnesses and accounts" except `accounts.ts`), `lore/` the lore store and its policy (`loreTools.ts` sits in `work/`, beside the other thread-tool bindings), and `policy/` the permission patterns, quotes, and questions.
`work/` holds the modules that call one another in a ring (threads, tree, lifecycle, missions, the Guildmaster, rituals, budgets, the tool server) and stays one folder until its own seams are settled; `service.ts`, `server.ts`, `main.ts`, and `index.ts` stay in `src/` as the entry points.
The files named below keep their names; find one by name under its folder.
The app (`apps/app/src`) groups by part, and its folders form one downward chain without cycles: `foundation`, `attachments`, `terminal`, `ui`, `editors`, `crest`, `realms`, `rituals`, `quests`, `lore`, `conversation`, `settings`, `shell`.
Tests mirror the folders under `test/`; shared fixtures stay in `test/fixtures/`.

- **Thread lifecycle** (`lifecycle.ts`): the only writer of a thread's state and blocker. Callers name a transition (start or end a turn, fail, hold in a turn or for a reason, release, stop, resume, recover at startup); each keeps the tree's rules, such as a parent left Waiting with nothing at work beneath it becoming Idle. It also works out the actions the owner can take on a thread.
- **Waiting on the owner** (`attention.ts`): one way for approval questions and off-topic suggestions to ask inside a turn, wait without a time limit, and be answered or withdrawn.
- **Thread inbox** (`messaging.ts`): a thread's message history, its order, and what waits to be delivered; `activity.ts` records a mission's latest activity.
- **Thread tool catalogue** (`threadTools.ts`): each thread tool defined once, with its MCP listing, argument decoding, and whether it runs unasked derived from that definition; `threadToolHandlers.ts` answers each through the module that owns it, and `mcp.ts` is the transport.
- **Commands** (`commands.ts`): owner requests and thread tools change state through one runner. A domain operation does its storage work and returns its follow-ups (whether owner-visible state changed, turns to cancel, threads and missions to wake); the runner commits it in one transaction, then announces the change once, cancels, and wakes, in that order, and does nothing of these when the transaction fails. Building blocks that run inside an operation's transaction still say "Callers run it in a transaction"; the turn fiber, Approvals, and Attention announce on their own, since they sit beneath Threads.
- **Endpoints** (`endpoints.ts`): each thread's secret MCP URL, between Threads (which needs a URL to run a turn) and the tool server (which calls Threads).
- **Missions** (`missions.ts`, `missionDetail.ts`, `dashboard.ts`): starting a mission and its summary, what the owner reads of one mission, and the dashboard's list.
- **Lore** (`lore.ts`, `loreFading.ts`, `loreChanges.ts`, `loreDecisions.ts`, `loreProposals.ts`, `loreUndo.ts`, `loreViews.ts`, `loreTools.ts`): each thread's lookup scope and recall (scoped lore in full, global lore as an index), kinds and fading worked out when read, changes by threads (`loreChanges.ts`) and the owner's decisions on them (`loreDecisions.ts`), widening and narrowing proposals, undo, and what the panel and `search_intel` read, ranked and counted as uses. **The lore store** (`loreStore.ts`) is the only writer of `intels`, `intel_history`, and `intel_uses`: each named operation (save, correct, move, replace, pin, delete, restore, merge, count uses, undo, erase a thread's lore) records its history entry and fading steps itself, and an owner's deletion declines the lore entry's awaiting changes; the other lore modules keep only policy and reads.
- **Harnesses and accounts** (`harnesses.ts`, `harnessCatalog.ts`, `harnessProcesses.ts`, `lineProcess.ts`, `claude.ts`, `claudeArgs.ts`, `codex.ts`, `opencode.ts`, `fakeHarness.ts`, `execution.ts`, `harnessTools.ts`, `accounts.ts`, `runners.ts`): each harness is defined once in the registry (`harnesses.ts`: its adapter, sign-in and model reads, over the facts in `harnessCatalog.ts`), and `makeHarnessRouter` sends each turn to its thread's harness. **Harness processes** (`harnessProcesses.ts`) own each thread's process for every adapter: start or reuse by the adapter's restart key (model, effort where taken, working folder, account, access), idle close, interrupt with a grace period, close when a steered message was not taken in, and close all at scope end; each adapter keeps only its protocol over one line-per-JSON transport (`lineProcess.ts`) with two framings, Claude Code's stream-json and JSON-RPC for Codex (app server) and OpenCode (ACP). A turn carries `askOwner`, bound to Approvals: Codex and OpenCode ask about their harness's permission requests in-process, and a failure ends the turn; `answer_prompt` stays on MCP only as Claude Code's `--permission-prompt-tool` and is listed only to Claude Code threads. `harnessTools.ts` asks each tool for its version, sign-in, and models, and opens its sign-in; `runners.ts` works out a new thread's harness, account, model, and effort from its opener. See [provider-accounts](capabilities/provider-accounts/specifications.md), [0005](architecture-decision-record/0005-thread-tools-over-mcp.md), and [0011](architecture-decision-record/0011-accounts-as-harness-folders.md).
- **Starting context** (`startingContext.ts`, with `turns.ts` for admitting, completing, and failing a turn): one module assembles a thread's starting context, its system part (working folder and the fixed thread, journal, lore, and approval instructions, no titles) and each turn's note (position line, journal, opener's messages, lore, budget line), and measures a thread about to be opened from the same sections, so the size warning counts what the harness receives. Titles stay in the note, so a rename never changes the system prompt (CHG-0058).
- **Budgets** (`budgets.ts`, `budgetViews.ts`, `budgetPeriods.ts`, `spending.ts`): stops and releases at limits, what the owner reads, and the release when a global period starts over. Spending rows outlive the threads and missions that spent them.

## Flows

- **Open a thread**: a thread calls `open_thread` on the MCP server, or the user opens one in the app. The local service checks the budget, records the thread beneath its parent, builds the starting context (the journal, the lore in scope, the request from the opening thread or user), and starts the chosen harness through its adapter.
- **Subagent as thread**: each harness adapter switches off the harness's built-in subagent tool where it can, so agents open subagents through `open_thread` and every subagent is a full thread; the harness's own agent definitions pass through as the thread's agent. Where a built-in subagent still runs, the adapter mirrors its events into a child thread beneath the one that started it. A message the user writes there is queued; when the subagent finishes, the thread continues as a full thread from its history with that message, unless the user chooses to interrupt and continue it at once. See [0007](architecture-decision-record/0007-subagents-become-threads.md).
- **Thread message**: a thread calls `send_thread_message`. The local service checks that the receiving thread is within reach (its parent, a thread directly beneath it, a thread or mission it references with `@`, or Guildmaster), stores the message, and delivers it into the receiving thread's current turn where the harness allows it, otherwise at its next turn, waking the thread if it is Waiting, Idle, or Done.
- **Guildmaster**: the user talks with Guildmaster in the Guild Hall.
  The local service stores this conversation as a hidden quest, reusing quest turns, messages, spending, and cards while excluding it from ordinary quest lists, searches, and ending actions.
  For requests sent to it, Guildmaster finds a matching mission or opens one with a tier from settings.
  Direct creation from a Realm or Free Realm instead uses the app's service interface, as agreed in CHG-0133; implementation remains pending.
  The service builds its dashboard context and notifies it when a mission it opened reports a result, needs the user, or fails.
  The expanded [Guildmaster role](capabilities/mission-coordination/specifications.md#what-guildmaster-does-itself) is agreed in CHG-0132; its additional tools need design and implementation under the service-enforced authority in [ADR 0005](architecture-decision-record/0005-thread-tools-over-mcp.md).
- **Handover**: the user or a thread changes a thread's harness, agent, model, or effort. The local service ends the old harness session and starts the new one with the thread's full history from its turns, summarizing the oldest part only when the history exceeds the new model's context window. See [0006](architecture-decision-record/0006-handover-replays-full-history.md).
- **Approval**: a thread calls `request_approval` before a risky action; at the stricter approval level, a harness's own permission request arrives through its adapter instead. The local service pauses the turn, sets the thread to Attention, shows the question in the thread and in the dashboard's list on every device, and resumes with the user's answer. Allow covers that one action only; Always allow also stores a standing permission, which the local service puts in the starting context of every thread it covers.
- **Budget**: each harness adapter reports spending events as the harness streams them. The local service totals them per mission, Guildmaster, and global period; at a limit it stops the turns under that budget through their adapters, sets the threads to Attention, and asks the user to raise the budget or stop. Each thread's starting context and turns carry one line on its budget use.
- **Workspace**: the user chooses a folder in the system's folder dialog on the desktop (CHG-0035), browses folders under the browsable roots through the local service from the phone, or gives a repository link; a thread does the same through `list_workspaces`, `open_thread`, and `clone_repository`. The local service clones into the clone location with the computer's own git, records the workspace by its path, and starts the thread's harness in that folder, in a git worktree for an own copy, or in the mission's scratch folder with no workspace. Before each turn it checks that the folder exists, otherwise it sets the thread to Attention.
- **Journal update**: a thread rewrites the briefing or adds a change log entry through its thread tools. The local service stores the change with its author thread and time.
- **Routine run**: the scheduler fires a timed trigger, or the relay Worker forwards a webhook and the local service verifies its signature. The local service then adds a turn to the routine's own thread or opens new threads with the routine's skill or instruction.
- **Pair a phone**: the desktop app makes a key pair and a room identifier and shows them as a pairing code: a link to the phone web app with the room and keys after `#`, which browsers never send to a server. The phone opens the link, connects to the room on the relay Worker, and both sides derive the shared key. On the same network, the phone can reach the local service directly with no relay.
- **Phone notification**: the local service sends a notification with no content (for example "a thread needs your approval") through the phone platform's push service; the phone loads the details over the encrypted connection when opened.
- **Use from the phone**: the phone web app and the local service exchange encrypted messages through the pairing's Durable Object over WebSockets, in both directions, asynchronously.

## Integrations

- **Harness installs and updates**: the local service uses the computer's installed command-line tools. Charter offers installation of missing harnesses through their official npm packages, using npm's configured global prefix and integrity verification; Node.js and npm are prerequisites. It offers updates through the installed harness's own updater. These operations run outside the command queue and refresh availability afterward. See [provider accounts](capabilities/provider-accounts/specifications.md). The earlier proposed app-managed download/cache is deferred.
- **Harnesses (Claude Code, Codex, OpenCode, ACP harnesses)**: the local service starts them as local processes, and exchanges turns, tool calls, and permission requests. A harness that is not installed or not signed in shows as unavailable when choosing one; a thread whose harness fails stops with an error, and the user can hand it over to another.
- **Providers**: reached only through each harness, with the user's own subscription or API key. Gild holds no provider credentials of its own; an added provider account is a folder the harness signs in to with its own sign-in ([0011](architecture-decision-record/0011-accounts-as-harness-folders.md)).
- **MCP servers (global and workspace)**: configured in Gild and passed to every harness, subject to the thread's selection. Importing existing harness configuration is deferred. Conflicting names ask the user. A failed external server produces a warning; failed Gild thread tools put the thread in Attention with Retry. See [tool-and-skill-loading](capabilities/tool-and-skill-loading/specifications.md).
- **Skills**: read from existing global and workspace skill folders and thread installations. The narrower scope wins; within a scope the chosen harness's folder wins, then `.agents/skills`, then other harness folders. Enabled skills' names, descriptions, and locations are available at turn start; full instructions load when used, with supporting files read as needed. Changes apply on the next turn; installation through the app is deferred. See [tool-and-skill-loading](capabilities/tool-and-skill-loading/specifications.md).
- **Git**: the computer's installed `git`, with its existing sign-in, clones repositories, creates own copies as worktrees, and merges them. Gild stores no git credentials.
- **Cloudflare**: the desktop app deploys the relay Worker to the user's account after one sign-in. When the relay is unreachable, phones on another network wait and reconnect, and webhook triggers are lost unless the sender retries.
- **Connected services**: reached by threads through MCP servers, never directly by the local service.

## Deployment

- **Desktop app**: a signed macOS build of Electron for version 1; Linux and Windows later.
- **Phone**: in version 1, the phone web app on any phone, and the native Android build for testers through Firebase App Distribution, which is free. App Store and Play Store releases later, since store accounts carry fees; an iOS test build also needs an Apple developer account, so it waits too.
- **Relay Worker and phone web app**: one Worker deployed by the desktop app to the user's own free Cloudflare account, and updated with each desktop release. Anyone can also deploy it from the repository with one command.
- **Environments**: local development only, until a first release.

## Requirements

| Requirement | How the architecture meets it |
| --- | --- |
| Fully open source | All parts are in one Apache 2.0 repository. |
| Respect upstream licenses | New codebase with no OpenBot code; MausBot modules (only from outside `enterprise/`) and Paseo's relay code keep their Apache 2.0 license and NOTICE attributions, and MausBot's brand is not reused ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md)). |
| Nearly free to run | Each user runs their own relay Worker on a free Cloudflare account; the same network needs no relay; the project runs no servers ([0003](architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md)). |
| Local data | The local service owns product data; the relay Worker holds only connection state and encrypted queued messages. Webhook bodies pass through the user's own relay Worker. Future hosted guests receive shared conversations and results under the local-data exception; mission documents and data remain on the host. |
| Bring your own provider | Providers are reached only through harnesses with the user's own accounts. |
| End-to-end encrypted phone traffic | Keys travel only in the pairing code, after `#`; the relay Worker forwards ciphertext only. |
| Approval per action | Every approval question stops at the local service, which asks the user for each action and never reuses a single answer across actions or threads; standing permissions are stored only when the user chooses Always allow, and listed on the Permissions page. |
| Single user | The first build serves the installation's owner through one local service and one SQLite file. |
| Future multiplayer | The hosted agreements above define identity, invitations, mission history access, host execution and authority, spending, resource sharing, and permission changes. Guest local copies, execution across installations, and synchronization remain undesigned. |
| End-to-end encrypted phone traffic (notifications) | Notifications carry no content; details travel only over the encrypted connection. |
| Comply with provider terms | Harnesses sign in through their own tools (`claude auth login` and equivalents); the local service never reads or stores their credentials. |
| Pair by QR code from anywhere | The pairing code opens the phone web app, which reaches the local service through the relay Worker from any network. |

## Decisions

- [0001: Start a new codebase and cherry-pick from MausBot and Paseo](architecture-decision-record/0001-new-codebase-not-a-fork.md)
- [0002: One local service owns all data in SQLite](architecture-decision-record/0002-one-local-service-owns-all-data.md)
- [0003: A per-user relay Worker carries all phone traffic](architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md)
- [0004: Electron as the desktop shell](architecture-decision-record/0004-electron-desktop-shell.md)
- [0005: Thread tools are served over MCP](architecture-decision-record/0005-thread-tools-over-mcp.md)
- [0006: A handover replays the full history](architecture-decision-record/0006-handover-replays-full-history.md)
- [0007: Subagents become threads](architecture-decision-record/0007-subagents-become-threads.md)
- [0008: Drive harness tools directly](architecture-decision-record/0008-drive-harness-tools-directly.md)
- [0009: One Expo app everywhere](architecture-decision-record/0009-one-expo-app-everywhere.md)
- [0010: Effect in the service and relay](architecture-decision-record/0010-effect-in-the-service-and-relay.md)
- [0011: Provider accounts are harness configuration folders](architecture-decision-record/0011-accounts-as-harness-folders.md)
