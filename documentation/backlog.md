# Backlog

- **Thread worktrees** (thread-tree): decide whether each thread, or each thread attached to a repository workspace, gets its own git worktree so parallel threads do not overwrite each other's files.
- **Ending missions** (mission-tracking): the user marks a mission Done by hand; an option archives missions after a time; or, after X days without activity, the mission asks "Archive it or mark it as done?".
- **Control** (mission-coordination): one permanent thread outside every mission that never does the work itself, opens a mission for each task, and reports how missions stand, so a less experienced user has one chat to talk to. Specify after scoped-intel; open: whether it has a journal or intel, and how it hears back from missions.
- **Thread panel and context gauge** (new capability, not named): a side panel per thread, like OpenBot's agent panel, showing its harness, agent, model, effort, workspace, intel, skills, budget, and spending; and a context gauge showing how full the context window is, broken down by instructions, intel, tools, skills, tool calls and results, and messages. Replaces the proposed Advanced view; no terminal.
