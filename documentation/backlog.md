# Backlog

- **Thread panel and context gauge** (new capability, not named): a side panel per thread, like OpenBot's agent panel, showing its harness, agent, model, effort, workspace, intel, skills, budget, and spending; and a context gauge showing how full the context window is, broken down by instructions, intel, tools, skills, tool calls and results, and messages. Replaces the proposed Advanced view; no terminal. Decide whether budget-control's budget window joins the context gauge in one window.
- **Desktop shell and service runtime**: compare Electron with a Node service against Tauri with a Bun-compiled service as a sidecar (or Electrobun). Settle with a prototype: a stub service that opens SQLite, loads `sqlite-vec`, and runs one Claude Code turn, measured for app size, memory, and startup. A switch replaces decision record 0004 and changes 0010's runtime line.
- **Terminal** (workspace-attachment): a terminal in a thread's workspace or scratch folder, as a developer option.
- **DeltaDB** (workspace-attachment): Zed's version control for agent edits and conversations could replace own copies if it is published as open source.
