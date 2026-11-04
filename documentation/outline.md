# OpenMission

People who work with several AI agents lose goals, context, and spending across separate chats and tools. OpenMission gives a single user one place where every piece of work is a mission carried out in a tree of threads: the user or any thread opens further threads on whichever harness, agent, model, and effort fits, hands a thread over to another harness without losing its history, and threads talk to each other in both directions. Success is a mission finished through delegated work the user can see, steer, and pay for knowingly, from the computer or a paired phone.

## Actors

- **User**: the one person who owns the installation; starts missions, steers threads, grants approvals, and sets budgets.
- **Harness**: an external agent runtime (Claude Code, Codex, and others) that carries out turns.
- **Provider**: the user's own model account or API key that a harness bills.
- **Trigger source**: a clock, webhook, or external event that starts a routine or workflow run.
- **Connected service**: an outside service (mail, code host, chat) a thread acts on.
- **Paired device**: the user's phone, used to follow and steer threads away from the computer.

## Capabilities

- **mission-tracking**: starting missions and following their state, threads, and spending on the mission dashboard.
- **[mission-journal](capabilities/mission-journal/specifications.md)**: keeping each mission's summary and change log, read by every thread in the mission and updated as it works.
- **[thread-tree](capabilities/thread-tree/specifications.md)**: opening threads beneath a thread, by the user or by a thread, each with its own harness, agent, model, and effort; every subagent a harness starts shows up as a thread beneath the one that started it, so the user can follow it.
- **[thread-messaging](capabilities/thread-messaging/specifications.md)**: thread messages in both directions along the tree, with replies and interruptions; the user can write in any open thread, including a subagent's.
- **thread-handover**: changing a thread's harness, agent, model, or effort mid-thread, with the full history given to the new one.
- **workspace-attachment**: attaching a thread to a workspace, or to none.
- **routine-running**: running a routine on its trigger, in its own thread or by opening new threads.
- **workflow-running**: running a workflow, each step as a thread.
- **tool-and-skill-loading**: giving every thread, whatever its harness, the global and workspace MCP servers, the thread tools, and the skills in scope for it.
- **[scoped-intel](capabilities/scoped-intel/specifications.md)**: gathering and recalling intel at thread, workspace, or global scope.
- **action-approval**: asking the user before a risky action, one approval per action and thread.
- **budget-control**: budgets on missions and threads, drawn down by the threads beneath them.
- **device-pairing**: pairing a phone with one pairing code and using OpenMission from it on any network.

See also the [requirements](requirements.md) and the [glossary](glossary.md).
