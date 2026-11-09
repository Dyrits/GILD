# Thread tree blueprint

Status: proposed. Uses the [first slice design](../../first-slice-design.md). Claude Code and the staged scope are agreed; technical design remains under review. No acceptance check has run.

## Modules and data

Threads owns tree structure, configuration, state, generation, and turn admission. Workspace attachment is immutable after first start. Changes to harness, agent, model, or effort belong to the later handover capability (CHG-0024). Its proposed interface is `open`, `readTree`, `stop`, and `resume`. Execution supplies normalized turn events; Messaging supplies delivery and result events. App and MCP calls use the same authorization and admission logic.

Opening by a thread creates a direct descendant only. Opening by the owner may choose a parent. Validate parent and mission together, inherit settings with explicit overrides, and reserve a running slot atomically before starting execution. Proposed limits retain the specifications' defaults of four user-opened levels and eight running threads per mission. A refused opening records its reason without creating an executable thread. Budget refusal is staged with budget enforcement.

Thread, Turn, and configuration records live in SQLite. Tree queries return view folding separately from existence and lifecycle. Use a deterministic fake Execution adapter, temporary SQLite, and fake context sources for tests; live execution uses the verified Claude Code adapter. Stop-generation handling and recovery follow the shared design.

## Acceptance

| Specification check | Module and test interface; stage |
| --- | --- |
| Owner and agent opening | Threads `open`, through app commands and MCP respectively; included. |
| Inherited defaults and overrides | Threads `open` then `readTree`; included for supported settings. |
| Starting context and summarization | Context `prepareTurn`; request and conversation source tracking included; journal, intel, context-window warning, and summarization staged. Full starting-context acceptance remains open. |
| Every state change | Threads event handling through fake Execution and Messaging; included for slice transitions, approval Attention gated on approval integration, budget Attention staged. |
| Results reach parent | Messaging `reportResult` then conversation read; included. |
| Continue Done | Messaging `send` and Execution start observation; included. |
| Stop does not cascade; messages retained | Threads `stop`, Messaging `send`, Threads `resume`; included. |
| Delete with count | Proposed Threads deletion preview and confirmation; staged with scratch-folder and subtree cleanup. |
| Every limit refusal | Threads `open` under concurrent requests; depth/concurrency included, budget staged. |
| Mirrored subagents and queued messages | Execution native-subagent events and Threads queries; staged pending verified Claude Code observation and handover design. Live configuration must suppress native subagents or expose them. |
| Fold agent-opened threads, count, reveal Attention/Failed | App tree projection from Threads `readTree`; included in desktop tree design. |
| Off-topic suggestion, fresh mission, aside, moved link, automatic setting | Proposed routing module over Missions/Threads/Context; staged with journal and mission matching. |
| Aside informs parent when topic returns | Context instructions plus Messaging `send`; staged with asides. |
| Match Done/Idle missions, exclude deleted, Continue in wakes | Proposed matching query and Messaging `send`; staged with routing and briefing search. |
| Desktop and phone: three levels, two harnesses, message subagent, stop branch | App through Threads/Messaging; desktop full threads on Claude Code included; phone, second harness, and mirrored continuation staged. Stop affects the selected thread only. |

## Requirements

| Requirement | Design |
| --- | --- |
| Approval per action | Thread session identity is service-bound. An opener's approvals never enter a new thread as authority. Live execution waits for the approval gate in the shared design. |
| Nearly free to run | Local service and processes require no project infrastructure. |
| Bring your own provider | Adapter invokes the user's harness; no provider credentials enter Gild storage. |
| Future multiplayer | Stable thread/workspace identities and separate host/actor identity avoid tying execution authority to a display name or local path. Synchronization remains undesigned. |

## Open

Review shared module interfaces, context dependencies, and live-launch gates. Adapter conformance must establish native-subagent handling before live thread-tree behavior is claimed.
