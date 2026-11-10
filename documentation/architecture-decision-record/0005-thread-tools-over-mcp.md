# Thread tools are served over MCP

The local service gives threads their tools (`open_thread`, `find_missions`, `suggest_mission`, `send_thread_message`, `interrupt_thread`, `request_approval`, journal and intel tools, `report_result`) through one local MCP server, because Claude Code, Codex, and ACP harnesses all support MCP.
The service enforces each thread's authority over itself and its descendants.
`find_missions` can read other missions' titles, journal summaries, and states; Continue in routes a message to the mission the user selects.
CHG-0009 added messaging to threads and missions referenced with `@`, and let Control open, message, and act on any mission at the user's request.

CHG-0132 extends Control's authority to the [Guildmaster role](../capabilities/mission-coordination/specifications.md#what-guildmaster-does-itself).
The service must distinguish Guildmaster's app-wide authority from ordinary thread authority and enforce each operation's rules, approvals, and budgets.
The additional tools still need design and implementation.
