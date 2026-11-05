# Thread messaging blueprint

Status: proposed technical design under the [first slice design](../../first-slice-design.md). Retaining messages in Stopped threads until explicit resume is agreed. No acceptance check has run.

## Modules and data

Messaging exposes `send`, `reportResult`, `interrupt`, and `readConversation`. It persists messages, sender identity, sequence, requested delivery mode, delivery status, reply relationship, and result status. Threads owns lifecycle and scheduling; Messaging never starts a second turn beside an existing one.

Bind MCP calls to their sending thread. Permit its parent and direct descendants. A later reference resolver will issue validated target references for cross-tree and cross-mission messages; plain text that claims an `@` reference grants no access. Replies use the persisted originating message's authorized return target. Before reference support exists, refuse unsupported targets explicitly rather than accepting arbitrary thread identifiers.

An owner message can request Steer or Queue; Steer is the default. Execution returns whether it accepted mid-turn delivery. When unsupported, queue for the next turn and expose that outcome. Waiting, Idle, and Done receivers wake; Stopped receivers retain messages without waking. A failed receiver retains delivery for explicit recovery rather than retrying a broken process indefinitely.

Track the chatter count per unordered pair of threads. Reset it on a user message to either participant or a result in their exchange. At the configured threshold, default 20, Threads pauses both in Attention and admits no further automatic turn between them until the owner decides. Keep all triggering messages. Tests must exercise simultaneous sends at the threshold.

Interruption requires the owner or the direct parent, ends the active turn, and becomes Idle. Pending messages may then schedule another turn; Stop prevents that until resume. An interruption does not delete messages or approve actions. Lifecycle changes reject stale events by generation as defined in the shared design.

## Seams

- Execution delivery: verified Claude Code and deterministic fake adapters; the fake supports both mid-turn and next-turn modes.
- Persistence: production SQLite and temporary SQLite databases in tests. Exercise commit/retry/recovery behavior through Messaging commands, without replacing transaction semantics with a map.

## Acceptance

| Specification check | Module and test interface; stage |
| --- | --- |
| Parent/direct descendants allowed; siblings/farther refused unless referenced | Messaging `send` via bound MCP identity; basic reach included, validated references staged. |
| Cross-mission referenced target and direct reply | Reference resolver plus Messaging `send` and reply-to; staged. |
| Running-turn and next-turn delivery | Messaging `send`, fake Execution capability modes and event observations; included. Claude Code behavior needs conformance evidence. |
| Owner Steer/Queue and default setting | Messaging `send` and persisted defaults; included. |
| Wake Waiting/Idle/Done and mutually waiting threads | Messaging `send` plus Threads state and Execution observation; included. |
| Retain messages for Stopped | Messaging `send`, `readConversation`, Threads `resume`; included, including sends racing with Stop. |
| Owner and parent interruptions | Messaging `interrupt`, fake Execution cancellation; included, with refusal for other thread callers. |
| Chatter guard pauses both at limit | Messaging concurrent sends and Threads states with adjustable threshold; included. |
| Human walkthrough: steer, queue, subagent asks parent and receives answer | Desktop app with full threads through Messaging; included after live-launch gates. Phone and mirrored-subagent walkthroughs remain staged. |

## Requirements

| Requirement | Design |
| --- | --- |
| Approval per action | Messages store text and provenance, never approval grants. Only the authenticated owner's approval command may answer an approval question. |
| Local data | Messages and delivery records remain in host SQLite; future device transport follows the encrypted pairing design. |
| Future multiplayer | Sender thread, human actor, and execution host are separate identities; conversation projections exclude resource settings and credentials. |

## Open

Review the proposed delivery records, recovery behavior, and chatter reset interpretation before implementation. Cross-mission reference resolution remains staged with mission-coordination.
