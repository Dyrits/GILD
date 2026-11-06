# First slice design

Status: technical design under review. The user accepted Claude Code, the staged slice, and the package and module boundaries (CHG-0024). Detailed interfaces, storage behavior, dependency gates, and tooling remain proposals. No implementation or harness conformance check has run.

## Boundary

The slice lets the owner start a mission, open threads beneath it, exchange text messages, report results, stop individual threads, and continue them. It runs locally through one Claude Code adapter and a fake adapter for automated checks. It does not complete the three capabilities' full specifications. Their blueprints identify every acceptance check as included or staged.

Continuing includes waking Done threads with a message and explicitly resuming Stopped threads. Reopening Done or Archived missions is staged with mission-ending behavior. Workspace attachment is immutable after first start; later changes to harness, agent, model, or effort belong to handover, which is staged.

Use the agreed Node local service, SQLite, Effect, Electron, Expo CLI/Metro, TypeScript, and Bun workspace. Keep the runtime comparison in the backlog. No relay, phone pairing, second harness, Control, hosted guest, or native phone build belongs to this slice.

## Modules and dependencies

Agreed code homes are `apps/app` for the Expo UI, `apps/desktop` for Electron, `packages/service` for the local service, and `packages/contracts` for shared transport records and validation. Harness adapters and persistence stay inside the service. The contracts package has no database access or harness dependencies.

The agreed service modules and their proposed detailed interfaces are:

| Module | Interface and responsibility |
| --- | --- |
| Missions | `start`, `rename`, `list`, `read`, `continue`. Owns mission metadata and dashboard queries. Starting records the mission, its top thread, and first user message together before scheduling work. |
| Threads | `open`, `readTree`, `stop`, `resume`. Owns parentage, configuration, lifecycle, and admission of turns. Only this module changes thread state. |
| Messaging | `send`, `reportResult`, `interrupt`, `readConversation`. Owns messages, reply relationships, delivery order, and the chatter guard. It requests lifecycle changes through Threads. |
| Execution | `startTurn`, `deliver`, `interrupt`, and a normalized event stream. Owns live harness processes and translates their output into persisted turn events. |
| Context | `prepareTurn`. Returns the request, conversation, execution settings, and a versioned snapshot of available context sources. It never starts a process itself. |
| Store | `transaction`, plus internal reads and writes used by the modules above. Owns SQLite migrations and atomic persistence; callers never receive a connection. |

App commands and MCP calls enter the same modules. The app never mutates SQLite or launches a harness. MCP binds the caller to a service-issued thread session; a tool argument cannot substitute a different caller identity. A user command is authenticated as the installation owner, not as whichever sender identifier the client supplies.

Use Effect scopes to supervise a turn's process and interrupt it when the service cancels the turn. Serialize commands that affect one mission, including its concurrency check, while unrelated missions may progress independently. Store commits precede UI events and harness delivery. Never keep a SQLite transaction open while waiting for a process or user answer.

## Data and ordering

All records live in the service's one SQLite database. Generate opaque identifiers independently of paths or harness session IDs. Proposed records:

| Record | Key fields and invariants |
| --- | --- |
| Mission | Identifier, top thread, host installation identifier, title, user-renamed flag, lifecycle, last activity. The top thread belongs to this mission and has no parent. |
| Thread | Identifier, mission, parent, opener, harness/agent/model/effort, workspace identifier or none, state, stop generation, version. A parent belongs to the same mission; parentage is immutable. |
| Turn | Identifier, thread, triggering messages, execution settings snapshot, context snapshot, adapter session reference, generation, status, start/end times. At most one active turn per thread. |
| Message | Identifier, mission, receiving thread, sender kind and identifier, text, reply-to, wants-reply, requested delivery mode, sequence, time. Sender identity comes from the authenticated command. |
| Delivery | Message, turn, status, attempt identifier. Distinguishes persisted, queued, accepted by the adapter, and delivery uncertain. |
| Turn event | Turn, adapter event identifier or service sequence, event kind and payload. Repeated events must not duplicate messages, results, or usage. |
| Usage | Turn, provider, billing unit, amount, adapter event identifier. Cumulative reports replace the corresponding cumulative value instead of adding it twice. Unknown usage is shown as unknown. |

Persist configuration defaults and local owner/installation identifiers separately. Do not use a filesystem path as a workspace identity. The first slice may run with no workspace in its mission scratch folder; selecting a workspace requires the workspace checks below.

Messages have stable order per receiving thread. Sending commits the message, delivery record, and activity update atomically. A worker then delivers it. A failed delivery retains the message and reports its status. Repeating a command with its request identifier returns the original outcome. After a crash between adapter acceptance and persistence, mark delivery uncertain rather than automatically replaying work that may already have performed actions. Live processes do not survive as trustworthy Running state: recovery records interrupted execution and exposes an explicit continuation decision.

Stopping increments the thread's generation and cancels its active turn before reporting it stopped. Output arriving from an older generation may be retained as late output but cannot wake the thread, change its state, or execute a new tool action. Threads beneath it continue. Resume schedules retained messages in sequence and does not replay already accepted messages automatically.

`reportResult` records the result, sets the sender Done, and stores its parent message in one transaction. On a mission's top thread it records the result and the dashboard's "Mark as done?" prompt. It never marks the mission Done. Ordinary completion of a harness turn means Idle unless a domain event establishes Waiting, Attention, Done, or Stopped.

## Harness seam

Execution uses two adapters: Claude Code in production and a deterministic fake in tests. Its interface declares support for mid-turn delivery, interruption, native subagent suppression or observation, settings, usage reporting, MCP configuration, and skill discovery. Unsupported features return a typed outcome; the service never pretends a message steered a turn when it was queued.

Claude Code is selected, but its concrete protocol mapping remains unverified. Before production implementation, verify the installed CLI and official documentation for stream input/output, permission interaction, process shutdown, subagent events, and configurable MCP/skill loading. Record version and evidence. Do not infer protocol flags from this design. No vendor SDK replaces the direct-tool agreement.

Where verified mid-turn input exists, deliver Steer and thread messages into the active turn. Otherwise queue them for the next turn and show that outcome. Interrupt ends the current turn and becomes Idle; pending messages may start a subsequent turn. Stop remains the way to prevent further turns until resume.

Prefer full OpenMission threads through `open_thread`. Native subagents must either be disabled through a verified mechanism or observed as mirrored threads. If neither is possible, that harness configuration cannot claim the thread-tree acceptance checks. Mirrored-thread continuation requires the staged handover design.

## Dependency gates

Staging a dependency does not allow the live slice to invent its data or claim its acceptance checks passed.

| Dependency | First-slice treatment and later integration |
| --- | --- |
| Journal | Context exposes a journal snapshot slot. Until journal behavior exists, show that the slice lacks shared briefing/history inheritance; do not describe a request-only thread as having the specified complete starting context. Journal entries for results and mission endings remain staged. |
| Intel and skills | Context has scope-aware source records, but no pretend recall. A real turn must receive the selected enabled skill inventory and required instructions through a verified adapter path. Unreadable selected instructions block launch in Attention. Intel recall and management remain staged. |
| MCP | Required thread tools are a live-launch gate. Missing tools produce Attention and Retry. Only implemented tool contracts are advertised. External server configuration and management remain staged; their absence is explicit. |
| Workspace | Initially use mission scratch folders. A selected workspace requires an existing folder, chosen in the system's folder dialog (CHG-0035), stable workspace identity, immutable attachment after start, and its selected instructions. Cloning, own copies, relocation UI, and workspace management remain staged. |
| Approval | A live turn needs `request_approval`, a persisted question, owner answer, withdrawal on interrupt/stop, and no approval conveyed by thread messages. Until this exists, run only fake-harness checks. Standing permissions and the full Permissions page remain staged. Never enable unattended risky actions to bypass this gate. |
| Budget | Show reported usage in its original provider unit. Budget settings and enforcement remain staged and unavailable in the slice; do not display a configured but unenforced limit. If enabled later, admission and streaming stops must use the same Threads interface. |
| Phone | Desktop UI only at this stage. All phone acceptance checks remain open until pairing and encrypted transport exist. |

## Transport and UI

The service exposes validated commands, queries, and a sequenced subscription to committed changes on loopback. The desktop shell supplies the owner connection credential; it is not a provider credential. MCP credentials are separate and scoped to a thread session. The concrete HTTP/WebSocket libraries and Electron credential bootstrap remain design questions.

On reconnect, the app obtains a snapshot with its sequence, then changes after that sequence. A subscription gap forces a new snapshot. A command carries a request identifier for retries and an expected version where it would overwrite user-visible state. Errors distinguish invalid input, stale version, access refusal, unsupported operation, missing dependency, and execution failure.

The initial screens are a dashboard list, a mission's tree, and a selected thread's conversation. Show Running, Waiting, Attention, Idle, Done, Failed, and Stopped distinctly. Show whether a message was queued or accepted for steering. A Stop action affects one thread; it does not imply stopping a branch. Preserve user message text and sender identity in the conversation.

## Future hosted access

Keep actor identity separate from sender kind, provider identity, host installation, and paired-device identity. Commands contain an authenticated actor supplied by the transport, so future guest-triggered work can retain its origin without granting owner approval authority. Resource configuration stays outside conversation projections. No guest access is implemented here.

The host service remains the authoritative writer. Stable identifiers avoid a dependency on local paths, but do not solve execution across installations or synchronization. A future design must specify those behaviors; this proposal does not claim replicated writes or offline edits.

## Tooling proposal

Use Bun for workspace scripts and dependency management, Node for service execution, and Expo CLI/Metro for the app. Proposed tests use Node's test runner for the service and adapter contract checks, so SQLite and process behavior run on the production runtime. Use fake clocks for inactivity and scheduling checks, temporary SQLite databases for persistence checks, and the fake adapter for deterministic turn interleavings.

Recommend TypeScript checking, ESLint, and Prettier as separate workspace commands. UI component and browser test tooling should be chosen when the first screens are designed. Versions, SQLite driver, schema validation, migrations, and transport libraries remain unselected. A successful Bun-only test does not establish Node compatibility.

## System requirements coverage

| Requirement | Design or remaining gate |
| --- | --- |
| Fully open source and respect upstream licenses | Keep the Apache 2.0 repository and direct harness integration. Review each selected dependency's license before adding it; independently written modules contain no OpenBot code. |
| Nearly free to run | This slice runs locally and adds no project-hosted infrastructure. Phone free-tier validation is staged with the relay. |
| Local data | Host SQLite owns product records; only context required for a turn reaches the harness/provider. Local app and MCP connections are authenticated. |
| Bring your own provider and comply with provider terms | Invoke the user's installed harness and its own sign-in. Store no provider credentials. Verify the selected CLI's integration requirements before live launch. |
| Approval per action | The live-launch approval gate binds each answer to one action and thread. Message text cannot grant another thread approval. |
| Single user | The initial command interface accepts the installation owner only. |
| Future multiplayer | Separate actor, host, sender, workspace, and provider identities. Preserve host authority and private resource projections; hosted participation and independent-installation synchronization remain staged. |
| End-to-end encrypted phone traffic and pairing from any network | No phone transport ships in this slice. Retain the existing pairing/relay architecture and require its encrypted transport before phone acceptance. |

## Review decisions

1. Package and module boundaries are accepted (CHG-0024). Review detailed command contracts, ordering, and recovery before implementation.
2. Accept the dependency gates and honest staged acceptance. Recommendation: prove persistence and scheduling with the fake adapter before enabling live turns.
3. Choose the concrete libraries after Claude Code protocol verification. Recommendation: Node-runtime service tests, TypeScript, ESLint, and Prettier; keep the Expo build choices already agreed.

The next design round settles these proposals before production code. The capability blueprints contain acceptance coverage for review.
