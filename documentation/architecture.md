# Architecture

OpenMission is a desktop application whose local service owns all data in one SQLite file and runs every thread through harness adapters. One Expo app is the interface everywhere: its web build runs in the Electron desktop window and as the installable phone web app, and the same code builds native phone apps later. A relay Worker, deployed by each user to their own Cloudflare account, carries the phone's end-to-end encrypted traffic and receives webhook triggers. Nothing is built yet; this is the agreed shape.

## Stack

- **Language**: TypeScript everywhere, in one Bun workspace.
- **Runtime**: Node for the local service; Bun for package management and scripts.
- **Effect**: Effect 4 in the local service and the relay Worker; not in the UI. See [0010](architecture-decision-record/0010-effect-in-the-service-and-relay.md).
- **Toolchain**: Vite+ (builds, Vitest, Oxlint, formatting) for every package except the app, which builds with Expo's own bundler.
- **Desktop shell**: Electron. See [0004](architecture-decision-record/0004-electron-desktop-shell.md).
- **Storage**: one SQLite file, with full-text search for intel; `sqlite-vec` later if semantic search is needed. See [0002](architecture-decision-record/0002-one-local-service-owns-all-data.md).
- **Harness integration**: each harness's command-line tool driven directly: Claude Code over its JSON stream, Codex through its app server, OpenCode and others through the Agent Client Protocol (ACP). See [0008](architecture-decision-record/0008-drive-harness-tools-directly.md).
- **Thread tools**: a local MCP server. See [0005](architecture-decision-record/0005-thread-tools-over-mcp.md).
- **Relay and phone hosting**: a Cloudflare Worker with one Durable Object per pairing, on the user's own free account. See [0003](architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md).
- **License**: Apache 2.0.
- **UI**: one Expo app (React Native with `react-native-web`) for desktop, phone web, and later native phones; web-only widgets embedded as web components. See [0009](architecture-decision-record/0009-one-expo-app-everywhere.md).

## Parts

- **Local service**: a Node process the desktop app starts. It serves every capability, owns all data (missions, threads, turns, thread messages, mission journals, intel, routines, workflows, approvals, budgets, pairings), runs the harness adapters and the routine and workflow scheduler, and hosts the MCP server that gives threads their tools.
- **Harness adapters**: a library inside the local service. Each one turns a harness's own protocol into one common event stream that the service stores as turns, and gives the harness the global and workspace MCP servers, the thread tools, and the skills in scope.
- **App**: the Expo app with every screen. It holds no product data and talks only to the local service's interface, directly on the desktop and through the relay Worker on a phone.
- **Desktop app**: the Electron shell that starts the local service and loads the app's web build. It serves device-pairing by showing the pairing code.
- **Phone web app**: the app's web build, installable from the browser and served by the relay Worker. It holds only its pairing keys. Native iOS and Android builds of the same app come later, through the stores.
- **Relay Worker**: the user's own Cloudflare Worker. Infrastructure for device-pairing and routine-running: it forwards encrypted traffic between the local service and paired devices without reading it, serves the phone web app, and forwards webhook triggers to the local service. It owns no product data; each pairing's Durable Object holds only the connection state and the messages queued for a device that is offline.

## Flows

- **Open a thread**: a thread calls `open_thread` on the MCP server, or the user opens one in the app. The local service checks the budget, records the thread beneath its parent, builds the starting context (the mission journal, the intel in scope, the request from the opening thread or user), and starts the chosen harness through its adapter.
- **Subagent as thread**: each harness adapter switches off the harness's built-in subagent tool where it can, so agents open subagents through `open_thread` and every subagent is a full thread; the harness's own agent definitions pass through as the thread's agent. Where a built-in subagent still runs, the adapter mirrors its events into a child thread beneath the one that started it. A message the user writes there is queued; when the subagent finishes, the thread continues as a full thread from its history with that message, unless the user chooses to interrupt and continue it at once. See [0007](architecture-decision-record/0007-subagents-become-threads.md).
- **Thread message**: a thread calls `send_thread_message`. The local service stores it and delivers it to the receiving thread's next turn, waking that thread when it is idle and the message asks for a reply.
- **Handover**: the user or a thread changes a thread's harness, agent, model, or effort. The local service ends the old harness session and starts the new one with the thread's full history from its turns, summarizing the oldest part only when the history exceeds the new model's context window. See [0006](architecture-decision-record/0006-handover-replays-full-history.md).
- **Approval**: a harness asks permission for a risky action through its adapter. The local service pauses the turn, shows the request in the app on every device, and resumes with the user's answer. The approval covers that one action only.
- **Journal update**: a thread rewrites the summary or adds a change log entry through its thread tools. The local service stores the change with its author thread and time.
- **Routine run**: the scheduler fires a timed trigger, or the relay Worker forwards a webhook and the local service verifies its signature. The local service then adds a turn to the routine's own thread or opens new threads with the routine's skill or instruction.
- **Pair a phone**: the desktop app makes a key pair and a room identifier and shows them as a pairing code: a link to the phone web app with the room and keys after `#`, which browsers never send to a server. The phone opens the link, connects to the room on the relay Worker, and both sides derive the shared key. On the same network, the phone can reach the local service directly with no relay.
- **Phone notification**: the local service sends a notification with no content (for example "a thread needs your approval") through the phone platform's push service; the phone loads the details over the encrypted connection when opened.
- **Use from the phone**: the phone web app and the local service exchange encrypted messages through the pairing's Durable Object over WebSockets, in both directions, asynchronously.

## Integrations

- **Harness installs and updates**: for each harness, the local service runs the user's installed command-line tool when one is found, or a copy it downloads from the harness's official package and checks against the published hash. It checks for new versions and offers each update to the user, never running a tool's own updater. Approach learned from OpenBot's documentation; written independently.
- **Harnesses (Claude Code, Codex, OpenCode, ACP harnesses)**: the local service starts them as local processes, and exchanges turns, tool calls, and permission requests. A harness that is not installed or not signed in shows as unavailable when choosing one; a thread whose harness fails stops with an error, and the user can hand it over to another.
- **Providers**: reached only through each harness, with the user's own subscription or API key. OpenMission holds no provider credentials of its own.
- **MCP servers (global and workspace)**: read from the user's and the workspace's configuration and passed to every harness. One that fails to start is reported in the thread, and the rest still load.
- **Skills**: read from `~/.agents/skills`, `~/.claude/skills`, the workspace's `.agents/skills` and `.claude/skills`, and the skills installed in a thread and the threads above it. When two share a name, the narrower scope wins.
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
| Local data | All product data lives in the local service's SQLite file; the relay Worker holds only connection state and encrypted queued messages. Webhook bodies pass through the user's own relay Worker. |
| Bring your own provider | Providers are reached only through harnesses with the user's own accounts. |
| End-to-end encrypted phone traffic | Keys travel only in the pairing code, after `#`; the relay Worker forwards ciphertext only. |
| Approval per action | Harness permission requests stop at the local service, which asks the user for each action and never reuses an answer across actions or threads. |
| Single user | One local service and one SQLite file per installation. |
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
