# Backlog

- **Thread worktrees** (thread-tree): decide whether each thread, or each thread attached to a repository workspace, gets its own git worktree so parallel threads do not overwrite each other's files.
- **Thread panel and context gauge** (new capability, not named): a side panel per thread, like OpenBot's agent panel, showing its harness, agent, model, effort, workspace, intel, skills, budget, and spending; and a context gauge showing how full the context window is, broken down by instructions, intel, tools, skills, tool calls and results, and messages. Replaces the proposed Advanced view; no terminal.
- **Desktop shell and service runtime**: compare Electron with a Node service against Tauri with a Bun-compiled service as a sidecar (or Electrobun). Settle with a prototype: a stub service that opens SQLite, loads `sqlite-vec`, and runs one Claude Code turn, measured for app size, memory, and startup. A switch replaces decision record 0004 and changes 0010's runtime line.
