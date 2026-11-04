# Thread tools are served over MCP

The local service gives threads their tools (`open_thread`, `suggest_mission`, `send_thread_message`, `interrupt_thread`, `request_approval`, journal and intel tools, `report_result`) through one local MCP server, because MCP is the tool mechanism that Claude Code, Codex, and ACP harnesses all support. A thread may act only on itself and the threads beneath it, enforced by the server, not by the harness.
