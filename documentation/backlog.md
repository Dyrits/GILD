# Backlog

- **Multiplayer architecture**: both joining one host's missions and collaboration across installations are required later. Before designing the first build, review identities, access, approvals, billing, private MCP connections and intel, execution hosts, shared-state ownership, and synchronization. See [architecture](architecture.md#future-multiplayer-open-architecture-questions).
- **Discussion summarization** (multiplayer): automatic summaries of guest discussions are deferred. The user set this aside after discussing the extra model use; it is not required for the first multiplayer version.
- **Hosted sync and pricing**: revisit DeltaDB-style synchronization through Durable Objects and an optional managed service, possibly priced per seat. The user deferred this exploration; no price, commercial service, cloud history storage, or requirement change is agreed. Keep the current local-data architecture and relay deployed to each user's Cloudflare account.

- **Skill installation** (tool-and-skill-loading): install skills through the app; version 1 reads existing skill folders.
- **MCP configuration import** (tool-and-skill-loading): import existing harness MCP configuration; version 1 manages global and workspace servers in OpenMission.

- **Thread panel and context gauge** (new capability, not named): a side panel per thread, like OpenBot's agent panel, showing its harness, agent, model, effort, workspace, intel, skills, budget, and spending; and a context gauge showing how full the context window is, broken down by instructions, intel, tools, skills, tool calls and results, and messages. Replaces the proposed Advanced view; no terminal. Decide whether budget-control's budget window joins the context gauge in one window.
- **Desktop shell and service runtime**: compare Electron with a Node service against Tauri with a Bun-compiled service as a sidecar (or Electrobun). Settle with a prototype: a stub service that opens SQLite, loads `sqlite-vec`, and runs one Claude Code turn, measured for app size, memory, and startup. A switch replaces decision record 0004 and changes 0010's runtime line.
- **Terminal** (workspace-attachment): a terminal in a thread's workspace or scratch folder, as a developer option.
- **DeltaDB** (workspace-attachment): Zed's version control for agent edits and conversations could replace own copies if it is published as open source.
