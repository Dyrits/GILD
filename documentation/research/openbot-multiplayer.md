# OpenBot multiplayer: primary-source notes

Researched 2026-11-14. Ideas only: OpenBot is under PolyForm Noncommercial 1.0.0 ([inspirations](../inspirations.md), [0001](../architecture-decision-record/0001-new-codebase-not-a-fork.md)); no code was copied and everything below is in my own words.

## Question

How does OpenBot let several people work together through one shared host? In particular: invitations, accounts, roles, shared channel chats, task ownership and delegation, how clients connect (WebRTC, Signal, coturn), what the cloud holds against what stays on the host, per-member visibility of agents, permissions, and conflicts between people.

## Method and sources read

- Source: `https://github.com/nightly-labs/openbot`, shallow clone (depth 1) of `main`, **commit `b51a1aabc078851cefcc399b85d4be245406c66d`** (committed 2026-11-14 12:05 +0100, "Move a Claude agent to its backup when the monthly spend limit stops it (#9398)"). The clone had no tags, so the release is taken from `CHANGELOG.md`, whose newest section is **0.70.0, 2026-11-13**.
- The clone sat in a new directory under `$TMPDIR`. Nothing in it was run, installed or built; files were only read.
- Primary sources only: source code, `README.md`, `docs/`, `remote/README.md`, `PRIVACY.md`, `CHANGELOG.md`, `LICENSE`, D1 migrations. No blog posts, aggregator pages or search summaries.
- Paths below are relative to the repository root at that commit. Line numbers are from that commit.
- I read the parts that answer the question. I did **not** read the whole 4,375-line `channel-service.ts`, the 2,898-line `team-api-server.ts`, or the mobile and web clients end to end.

## Findings

### 1. Who is a "person" here: accounts, hosts, memberships

- **Roles are three: owner, admin, member.** `TeamRole` is defined in `packages/contracts/src/ipc-team-host.ts:15`. `canAdministerServer` (same file, lines 24-26) is true for owner and admin only, and is the single check shared by clients and the host (`docs/architecture/team-api.md:112-113`).
- **Accounts are central, one per person.** Sign-in is by one-time email code on a Cloudflare Worker with D1 (`README.md:35`; one-time codes expire after 10 minutes and are stored hashed, `README.md:685-687`). The account service is `apps/auth-api`.
- **The cloud holds membership, the host holds almost everything else.** D1 tables created in `apps/auth-api/migrations/0012_remote_control_plane.sql`: `remote_hosts` (host id, owner, name, device public key, machine-token hash, `auth_epoch`), `remote_memberships` (role; status `active` or `revoked`), `remote_invites` (token hash, optional email, role admin or member, expiry, use counts, revoked time), `remote_sessions` (one row per logical connection, with start, end and expiry).
- **A host key is pinned by the client.** A client refuses to connect to a host whose public key it has not pinned, and the account directory never replaces a pinned key (`src/main/team-webrtc-client-transport.ts:282-290` and `:944-952`).
- **Member limits.** A host with no plan and no entitled licence allows 3 active members including the owner (`packages/contracts/src/input-limits.ts:149-152`, `DEFAULT_TEAM_MEMBER_LIMIT = 3`). Hosted-server plans carry 1, 5 or 10 (`packages/contracts/src/billing.ts:54-56`). Joining takes a seat inside the same D1 statement as the membership insert, so two joins cannot both take the last seat (`apps/auth-api/src/server/remote-control-plane.ts:1293-1500`).
- **Licence.** The README says versions up to 0.11 stay under Apache-2.0 and later ones are PolyForm Noncommercial, with a paid Starter (1 user) or Team (2 to 10 users) licence for commercial use (`README.md:723-731`). The multiplayer work described here is far newer than 0.11 (see 0.70.0 above), so it falls under PolyForm.

### 2. Invitations

- **Who may invite.** Only an active owner or admin (`remote-control-plane.ts:971-980`, `#requireRole(... ["owner","admin"])`). An invitation names the role it grants, `admin` or `member`, never `owner`.
- **Two kinds.** A single-use link, default life 7 days, between 5 minutes and 30 days; and a **permanent** link, reusable and non-expiring, which cannot be bound to an email (`remote-control-plane.ts:981-1000`). Up to 50 outstanding single-use and 5 permanent invitations per host (`remote-control-plane.ts:76-77`). The permanent cap exists because a leaked permanent link is open enrolment (`input-limits.ts:142-145`).
- **Only the token hash is stored** (`remote-control-plane.ts:999`; `remote_invites.token_hash`).
- **Acceptance** (`remote-control-plane.ts:1293-1420`): the invitee must be signed in; an email-bound invitation refuses a different account (403); the owner cannot accept (409); an already-active member keeps their role and sessions; a revoked member is brought back by a valid invitation only if the invitation was not created before the removal (`0036_membership_removed_at.sql` comment: "An invitation from before a removal cannot bring the member back").
- **An invitation dies with its creator's authority.** If the admin who made it leaves, is removed or is demoted, their open invitations are revoked in the same batch (`remote-control-plane.ts:1620-1623`; `0037_close_invites_of_former_admins.sql`).
- **Delivery.** The desktop shows a link or QR code (`team-api.md:97-99`); email invitations are sent through an account-service endpoint, and a failed send revokes the invitation (`team-api.md:118-120`). On a self-hosted account service the app does not send email; the admin copies the `openbot://join` link (`docs/self-hosting.md:20-22`).
- **Invitations are for one host.** Accepting joins one server (`team-api.md:97-100`).

### 3. How clients connect

- **The host publishes itself.** The desktop keeps its Team API on loopback only, and a hidden, sandboxed Electron page owns the `RTCPeerConnection` to invited clients (`README.md:499-503`; `team-api.md:5-8`).
- **Three ordered DataChannels**: `rpc`, `events`, `files` (`team-api.md:5-7`).
- **Signal carries only setup.** The Signal service relays SDP and ICE, issues a 10-minute resume token and time-limited coturn credentials, and has no database; room and presence exist only in process memory (`remote/README.md:1-20`). Its exceptions are the Slack, Discord and Telegram bots, which pass through Signal (`remote/README.md:3-5`).
- **Connection order** (`remote/README.md:9-17`): sign in to the Worker; D1 checks the membership and creates a logical session; the Worker signs a short ES256 ticket naming host, user, role, protocol range and `authEpoch`; client and host open a Signal WebSocket; Signal checks the ticket locally against the Worker's public keys; WebRTC then picks a direct path or the coturn relay.
- **coturn.** Signal hands out time-limited TURN credentials and reuses them for 5 minutes (`remote/api/src/signal-service.ts:326-329`); with several relays, a host and all its clients get the same one (`remote/README.md:275-282`). A host owner can set a "private" network route so no ICE servers are given and any non-private candidate is stripped, which forces direct LAN-only connections (`team-api.md:13-19`).
- **Multiple devices per host.** A host opts in to multiplexing, so each device gets its own peer connection and its own authentication, caches and event stream; an older host allows one peer (`team-api.md:269-273`).
- **Reconnects** are handled for several minutes without new account calls: a 10-minute resume token, ICE restarts, and a recovery that replaces the peer on the same session when the network changes (`team-api.md:26-67`).
- **Self-hosting** is possible: your own Worker, Signal and TURN, with your own signing keys; the official Worker will not issue a ticket for another Signal. Accounts are then separate from `openbot.run` (`docs/self-hosting.md:1-22`).

### 4. Authentication and encryption of the WebRTC channel

- **The ticket is bound to a client key.** Its claims include host, session, user, membership, role, an `authEpoch`, a protocol range and, for a client, the client's Ed25519 public key (`packages/contracts/src/signal-protocol/ticket.ts:36-62`).
- **A second handshake runs inside the DataChannel** (`src/main/team-webrtc-host-peer.ts:428-545`). The client sends the ticket, its public key, a nonce and a signature. The host checks that the ticket's claims match what Signal told it (host, session, user, membership, role, client key, expiry), then verifies the client's signature over a transcript. The host answers with its own nonce and a signature made with the host device key, and the client confirms.
- **The transcript includes both DTLS fingerprints**, the host id, session id, ticket and both nonces (`packages/contracts/src/team-protocol/v2.ts:263-283`). So a Signal that tampered with the SDP, giving each side a different fingerprint, would break the signatures.
- **The client verifies the host signature against the pinned host key** (`packages/team-client/src/remote-peer.ts:1868-1890`). I traced the signature check and the pin lookup; I did not trace every failure path.
- **Encryption itself** is WebRTC's DTLS. The README says traffic over a coturn relay stays encrypted (`PRIVACY.md:53`; `README.md:681-684`). I did not read Chromium's DTLS; I rely on the fact that the fingerprints are bound into the handshake above.
- **Per request, the host authenticates a session token it made itself** after the handshake: the peer opens a local session (`src/main/team-store.ts:1031-1059`), and every request is checked with `store.authenticate(token)` (`src/main/team-api-server.ts:591`). The session role is **fixed at open time** (`team-store.ts:1036-1044`).

### 5. How the Team API is authorised per member

- **Request context carries the member and an `agentLevel(agentId)` function** (`src/main/team-api/request-context.ts:29-46`), bound per request at `team-api-server.ts:2801`.
- **Four agent levels per member** (`docs/architecture/servers.md:1121-1161`): `none` (the agent is hidden: not in lists or events, and its routes answer 404), `view` (read only, writes answer 403), `chat` (send, answer prompts and approvals, use tasks), `manage` (change settings, routines, memories, skills). Owners and admins always get `manage`. Deleting an agent stays admin only.
- **Roles are custom groups of members with a level per agent**, plus an **Everyone** role. The member gets the highest level across the roles that name them; a server with no roles behaves as before, and new agents are open to every member until an admin closes them (`servers.md:1130-1137`).
- **Stored on the host, not in the cloud**, in a preference file (`openbot-agent-access-v1.json`). A save carries the revision it read, and a stale save gets 409 (`servers.md:1139-1147`).
- **Visible set is cut per member everywhere**: lists, events, push, Live Activity (`servers.md:1127-1129`).
- **Many admin-only routes** use one gate, `requireAdmin` (`src/main/team-api/request-helpers.ts:256-258`): server settings, providers, background processes, Hermes import, and so on (`team-api.md:434-584`).
- **MCP servers** have a per-member level of `none`, `use` or `manage`; a member can change only servers they added (`src/main/team-api/mcp-member-access.ts:1-30`).
- **Known gaps the docs state themselves** (`servers.md:1156-1161`): the composer does not show a `view` agent as read only; the attachment route does not check the attachment's agent; **a send to a channel does not check the levels of the agents in it**; only a save that adds an agent checks `chat`.
- **Audit log** of access changes for owner and admin: joins, leaves, removals, role changes, level changes; newest 500 entries per server, in a host file (`servers.md:1163-1202`).

### 6. Shared channel chats

- **What a channel is.** Several agents with a purpose and a lead; "Agent membership selects who can receive work. It does not restrict human access: each authenticated server member can read and use its channels" (`docs/architecture/channels-and-messaging.md:191-195`). The only filter is that a channel whose agents a member cannot see at all is hidden from them (`src/main/team-api/route-channels.ts:190-194` and `:215-222`; owners and admins see all, `:95-97`).
- **Storage is on the host**: transcript, tasks, assignments, summaries, per-member read positions in the host's SQLite. The account service and Signal add no channel storage (`channels-and-messaging.md:201-205` and `:540`).
- **The "task owner" is an agent, not a person.** `ChannelTask.ownerAgentId` (`packages/contracts/src/ipc-chat-channels.ts:158`) names the agent that does the task. People author messages (`author.kind` is `member`, `agent` or `coordinator`, `ipc-chat-channels.ts:181`) but do not own tasks.
- **Routing.** A message goes to the agent named by an @mention, a selected recipient, a reply, or an unambiguous follow-up, with no model call; otherwise the channel's lead agent routes it, and the lead's choice is shown as a visible message so a person can correct it (`channels-and-messaging.md:223-250`). One request can create one root task per addressed agent.
- **Delegation is between agents.** Tools let an agent assign a child task, transfer ownership, reply to another agent, or report a result. A child keeps its parent's owner unless transferred. Limits: 8 automatic assignments per root request and 2 active assignments per channel (`channels-and-messaging.md:272-276`). A member reply costs a short child task, with a cap of 2 per request (`:334-361`). Agents may change a channel only when a **person** authored the request: routine runs, other agents' hand-offs and agent-only requests are refused, so untrusted run input cannot change the channel (`:303-319`). A message from another agent to a channel carries a line naming it as an agent, so a member does not read it as the user's words (`:278-293`).
- **Person controls on a task**: `stop`, `resume`, `reassign`, `cancel` (`ipc-chat-channels.ts:285`). Stop pauses a task and its descendants with a reason; Reassign gives one task to another member agent and restarts the stopped part of its run; Cancel ends a whole run and works only on a stopped or failed task (`channels-and-messaging.md:516-531`; `src/backend/channel-service.ts:1106-1146`).
- **Archive, restore, delete** are owner and admin only (403 otherwise) (`route-channels.ts:155-173`).
- **Anyone who sees the channel can do the rest**: send, stop, resume, reassign, cancel, change channel settings. For the task commands the route checks only visibility (`route-channels.ts:168-181`). Channel settings and its picture can be changed by any member who sees the channel, "as on the desktop" (`route-channels.ts:379-381`). A save that adds an agent needs `chat` on that agent (`:303-319`).
- **Delete messages**: a member deletes their own channel messages; owner and admin delete any (`team-api.md:349-353`). Clearing a channel's history is owner and admin only (`:364-368`).
- **Each member has a private read position**, shared across that member's devices; moving it notifies only that member (`team-api.md:122-125`).
- **A person's turn in a channel can ask a question**, and the question, the plan card and any visual reply are copied into the channel, so every member who reads it can answer (`channels-and-messaging.md:401-406`).

### 7. Conflicts and simultaneous action

- **Commands to one channel are serialised in arrival order.** Each channel has a queue of pending commands, and each runs after the previous one (`src/backend/channel-service.ts:304-318` and `:408-432`). Stop and archive skip the queue so they act immediately (`:314-317`).
- **Duplicate delivery is harmless.** Every command carries an operation id; a repeated id finds its stored receipt and does nothing (`channel-service.ts:746-748`).
- **No per-command revision check for task controls.** The task command carries only channel, task, recipient (`ipc-chat-channels.ts:285-290`). The command is applied to the task's state at the moment it runs: a terminal task is refused, a cancel is refused unless the task is stopped or failed (`channel-service.ts:1106-1115`). So two people pressing Reassign for different agents each succeed in order; the later one wins.
- **A channel settings `save` sends the whole draft and is merged over the stored channel** (`channel-service.ts:800`, `{ ...channel, ...command.draft }`). I found no revision compare on a channel save. Two people saving settings at once: last write wins. (Some fields, such as the browser setting, are kept when a save omits them, and a save that arrives after a deletion is refused when it says it is an update, `channel-service.ts:757-762`.)
- **Task revisions protect the agent side.** A task's own `revision` number increments on each change, and a running assignment completes only if the revision it started with is still current, so an old assignment cannot finish a corrected request (`channels-and-messaging.md:516-517`; `channel-service.ts:2423` and onward).
- **Roles settings use real optimistic concurrency**: an admin's save carries the revision it read; a stale one gets 409 and the client reloads (`servers.md:1139-1147`).
- **Approvals and questions: first answer wins.** If another client answered first, or the turn ended, the host answers 409 and the client shows that the request is gone (`src/main/team-api/route-agents.ts:401-409`). Answering needs `chat` on the agent (`route-agents.ts:111-117`).
- **Privileged answers are for owner and admin.** A UI-block action marked dangerous or needing confirmation, and a free-text answer on a block that has one, get 403 for a member (`servers.md:505-512`; `route-agents.ts:323-324`). Some approvals, such as using a saved card, are passed `owner: member.role === "owner"` so only the owner can allow them (`route-agents.ts:329-340`).
- **Browser control and remote desktop.** When a member is removed, the host releases any browser "user control" they held and revokes their remote-screen session (`src/main/host-service.ts:1698-1722` and `:1909-1927`). I did not read how two people contend for the same browser tab.

### 8. Whose permissions a guest's turn runs under

- **A member's message is stamped with the member as its sender** (`request-helpers.ts:245-247`, used at `route-agents.ts:319`), so the chat shows who wrote it and a member may delete only their own messages (`docs/architecture/agents.md:706-707`).
- **The turn itself runs on the host, in the agent's own configuration**: the host's provider sign-ins, workspace and access mode. A member's role does not carry its own provider account or filesystem rights into the turn; the role only decides which agents they can see and talk to, and whether they can change them. The README states that full local access is a product decision, "not a security boundary" (`README.md:700`).
- **Widening an agent's access** (Ask first against Full access, local scripts) is described as the user's alone (`docs/architecture/agents.md:929`) and the settings routes I read are admin gated (`src/main/team-api/route-agent-admin.ts:63` and others; `route-agent-session-settings.ts:25`). I did **not** verify whether `manage` on one agent lets a plain member change that agent's access mode through the general agent update route.
- **Instructions from outside a person**: an agent hand-off, a routine run or another agent's message is never treated as a person's request for the powerful channel tools (`channels-and-messaging.md:303-319`; `:376-384`).
- **Member import of agents** uses the skills the server already has rather than changing them (`README.md:394`). Any member can import, not only owner or admin (`README.md:392`).
- **Which agents a member sees** also depends on their app's protocol and providers: Cursor and Cline agents are host-only; Hermes agents need protocol 8 or later; OpenCode agents need Team API v4 (`README.md:210`, `:228-231`, `:238-240`, `:283`; `src/main/team-api/provider-visibility.ts`).

### 9. Removal, leaving and revocation

- **Removing or leaving a member** sets their membership to revoked, ends all their sessions, closes their open invitations if they were an admin, and bumps the host's `authEpoch` (`remote-control-plane.ts:1568-1700`). "A new epoch makes Signal drop the host and every connected member" (comment at `remote-control-plane.ts:1624-1625`), so other members reconnect.
- **A role change** ends only that member's sessions (same comment), because a WebRTC session keeps the role it opened with until closed (`host-service.ts:1909-1916`).
- **Nobody can change or remove the owner**; only the owner ends the owner's sessions (`team-api.md:110-112`; `remote-control-plane.ts:1582-1590`).
- **Leaving is the same as removal**, on all the member's devices (`servers.md:164-172`).
- **Revocation reaches Signal reliably** through a durable D1 outbox that is retried by a scheduled task; Signal validates reconnects locally and checks the control plane only on the first use of a resume token after a restart or after expiry (`team-api.md:278-285`; `remote/README.md:19-30`).
- **The host re-syncs the directory** and closes the sessions of anyone D1 removed, disabled or gave another role (`team-api.md:113-115`; `host-service.ts:1842-1858`). The event connection is also re-checked against the member store every 15 seconds and closed with code 1008 if access was revoked (`team-api-server.ts:645-651`).
- **Host-side cleanup on removal**: the member's roles, notification levels and sidebar pins are forgotten (`host-service.ts:1698-1708`).
- **Not found: cancelling the removed member's queued or running work.** In the removal path I read I found no step that cancels the turns a removed member triggered or their queued messages. Messages they wrote remain in the history. I did not search the agent service for a separate hook, so this is "not found", not "does not happen".

### 10. What stays on the cloud and what stays on the host

- **Cloudflare (D1, R2):** accounts, email challenges, hashed sessions, hosts, memberships, invitations, logical remote sessions, avatars, hosted sites, plus billing and licence data (`README.md:499-503`, `:593`; `0012_remote_control_plane.sql`). Cloudflare is never on the data path (`remote/README.md:16`).
- **Signal:** in-memory room and presence only; no tokens, SDP, ICE, file names or message contents stored (`remote/README.md:18-20`). Exception: a sleeping hosted server's pending bot event is held in memory, sealed to the host's key, for at most 10 minutes (`remote/README.md:19-21`).
- **Host:** chats, channels, files, commands, memory, roles file, audit file (`README.md:637-692`; `servers.md:1139-1202`).
- **Analytics are separate.** The apps and Signal send usage events (counts and metadata) to a product-analytics service; `PRIVACY.md` lists them. Signal sends a TURN allocation count every 5 minutes (`PRIVACY.md:99-100`; `remote/api/src/capacity-report.ts`). I read the relevant lines of `PRIVACY.md` only, not the whole file.

## What differs from the README summary

1. **"One task owner" means one agent, not one person.** The README line (`README.md:30`) reads as if a person owned a shared chat. In the code a task's owner is an agent (`ownerAgentId`). Human members are equals in a channel: every member who sees the channel can send, stop, resume, reassign and cancel. Only archive, restore, delete and clearing history are limited to owner and admin. There is no human "task owner" and no human-to-human delegation or ownership transfer in channels. "Explicit delegation" is agents handing work to agents, by tool calls.
2. **"Reassign" gives a task to another agent in the channel**, not to another person.
3. **Versions.** "Team API v4" and "protocol 8" are not the current versions. They are the minimums at which clients can see OpenCode agents (v4) and Hermes agents (8) (`README.md:210`, `:283`). The current Team API is **protocol 9** over three WebRTC DataChannels (`team-api.md:5`), and the frames on the wire carry `version: 2` (`packages/contracts/src/team-protocol/v2.ts:3`). The README's "WebRTC protocol v3" (`README.md:681-682`) matches none of those numbers as I read them; I could not find a source that defines it. The first-pass note in `inspirations.md` called these versions "Team API v4 and protocol 8"; that should be corrected.
4. **Roles are richer than owner/admin/member.** On top of those three, there are custom roles holding a level per agent (`none`, `view`, `chat`, `manage`) plus an Everyone role, kept on the host. The README mentions only the three.
5. **Invitation details are missing from the README:** permanent links (cap 5 per host), email-bound single-use links, revocation of an admin's invitations when they lose authority, and a default of 3 members on a free host.
6. **Agents "import" by any member** is as the README says, but it is one capability among many; most administrative routes are owner/admin only.
7. **The README does say Cloudflare carries no chats, files or commands**, and the code agrees (`remote/README.md:3-4`), with Slack, Discord and Telegram as the stated exceptions the README summary leaves out.
8. **Licence.** The README adds that versions up to 0.11 remain Apache-2.0 (`README.md:729-730`). The notes in `inspirations.md` give only PolyForm.

## What could not be verified or found

- **No release date for the multiplayer feature.** `CHANGELOG.md` dates entries per version; the earliest mention of WebRTC is under 0.4.1 (2026-09-01) and of channels under 0.5.0 (2026-09-07), but I did not read those entries to say which first shipped team access. The clone is shallow, so I could not read the git history or tags.
- **Whether a removed member's running or queued turns are cancelled** (see section 9).
- **Whether `manage` on an agent lets a plain member change the agent's access mode** (section 8).
- **How two people contend for the same browser tab or remote-desktop control**, beyond the release on removal.
- **The DTLS layer itself**; I read the application handshake that binds to it, not Chromium's implementation.
- **The meaning of "WebRTC protocol v3"** in the README (section on versions above).
- **The web client at `openbot.run/app`**, the mobile apps, and the macOS Host Manager were not read beyond what `docs/` says.
- **Cloudflare runtime behaviour.** I read the Worker code and migrations, not a deployment; I cannot say what the production service enforces beyond that code.
- **Claims in the README or docs that I did not trace to code** are marked above by citing the document only.

## What bears on Iskios's multiplayer backlog

No decisions are made here. The Iskios agreements are in [architecture](../architecture.md#future-multiplayer-open-architecture-questions) and the [backlog](../backlog.md) (multiplayer architecture, discussion summarization, guest local copies).

- **Who is the "owner" of delegated work.** In OpenBot work is owned by an agent and people are peers; there is no concept of work delegated *from a guest's turn*, because anyone can control any task. Iskios's open question, "how removal affects work delegated from a guest-triggered turn", has no OpenBot answer to borrow: I found no cancellation of a removed member's work. What OpenBot does show is that a person-authored request is the basis for letting an agent use powerful channel tools (section 6), which is a way to tell a guest's request from untrusted run input.
- **Reconnecting guest identity.** OpenBot's identity is a central account; the ticket is bound to a client key, and a reconnect reuses the same logical session with a resume token for 10 minutes, after which the control plane re-checks. Iskios guests have no central account, so the comparison is limited to the pattern: a short-lived signed ticket, a client key bound into the handshake, and a handshake transcript that includes the transport fingerprints.
- **Invitation expiry and approval.** OpenBot invitations are links that sign in an account, with an optional email binding; they have no pending request that the host approves. Iskios's pending request with host approval is stricter. Worth noting from OpenBot: invitations are revoked when their creator loses authority, an invitation made before a removal cannot restore the member, a limit on permanent links exists because a leaked one is open enrolment, and the member seat is taken atomically with the join.
- **Host authority and spending.** OpenBot gives members no separate budget or provider account; turns run on the host's providers. Approvals are first-answer-wins with 409 for the loser, and some approvals are owner-only. That is close to Iskios's "only the host approves risky actions".
- **Per-guest visibility.** OpenBot cuts what a member sees per agent with four levels. Iskios's agreed model is per mission with two permissions. The `none`, `view`, `chat` split is a finer ladder than "trigger agents" against "discuss only"; OpenBot's own docs list gaps where the ladder is not enforced (a channel send, attachments).
- **Transport.** Direct-then-relay with a stateless signalling service, a per-host room, a signed ticket naming the role and an epoch that makes access changes take effect, and a durable outbox so revocation is not lost. This relates to [0003](../architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md) and [0016](../architecture-decision-record/0016-shared-relay-on-the-owners-free-cloudflare-account.md); I made no comparison of costs.
- **Roles changing mid-session.** A session keeps the role it opened with until closed, so OpenBot closes the member's sessions when the role changes. This bears on Iskios's "changing a guest from triggering to discussion-only".
- **Conflicts.** Serialised commands per channel, idempotent operation ids and last-write-wins on settings are what OpenBot does; it has real optimistic concurrency only on the roles file. Iskios's single-host design already serialises through one service; the point to carry is how the second of two simultaneous controls (stop, reassign) is treated.
