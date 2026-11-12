# Iskios

People who work with several AI agents lose goals, context, and spending across separate chats and tools. Iskios gives a single user one place where every piece of work is a mission carried out in a tree of threads: the user or any thread opens further threads on whichever harness, agent, model, and effort fits, hands a thread over to another harness without losing its history, and threads talk to each other in both directions. Success is a mission finished through delegated work the user can see, steer, and pay for knowingly, from the computer or a paired phone.

## Actors

The first build serves one user. The [architecture](architecture.md#future-multiplayer-open-architecture-questions) records the agreements for future hosted multiplayer and the remaining questions about collaboration across installations. Check these boundaries before designing the first build.

- **User**: the one person who owns the installation; starts missions, steers threads, grants approvals, and sets budgets.
- **Harness**: an external agent runtime (Claude Code, Codex, and others) that carries out turns.
- **Provider**: the user's own model account or API key that a harness bills.
- **Trigger source**: a clock, webhook, or external event that starts a routine or workflow run.
- **Connected service**: an outside service (mail, code host, chat) a thread acts on.
- **Paired device**: the user's phone, or the Iskios app on another computer, used to follow and steer threads on a host away from it.

## Capabilities

- **[mission-tracking](capabilities/mission-tracking/specifications.md)**: creating quests directly in realms or through Guildmaster, keeping them in realms or the Borderlands, moving whole quest trees with confirmation, and following their state, threads, and spending.
- **[mission-coordination](capabilities/mission-coordination/specifications.md)**: talking with Guildmaster in the Guild Hall to find information across Iskios, manage the app, and coordinate quests and their messages.
- **[mission-journal](capabilities/mission-journal/specifications.md)**: keeping each mission's briefing and change log, read by every thread in the mission and updated as it works.
- **[thread-tree](capabilities/thread-tree/specifications.md)**: opening threads beneath a thread, by the user or by a thread, each with its own harness, agent, model, and effort; every subagent a harness starts shows up as a thread beneath the one that started it, so the user can follow it.
- **[thread-messaging](capabilities/thread-messaging/specifications.md)**: thread messages in both directions along the tree, with replies and interruptions; the user can write in any open thread, including a subagent's.
- **[message-attachments](capabilities/message-attachments/specifications.md)**: attaching images to the owner's messages by pasting, dropping, or choosing files, stored by Iskios and read by the thread's harness.
- **[conversation-terminal](capabilities/conversation-terminal/specifications.md)**: opening the owner's shell inside a desktop message with `!` and sending its visible output as context.
- **thread-handover**: changing a thread's harness, agent, model, or effort mid-thread, with the full history given to the new one.
- **[workspace-attachment](capabilities/workspace-attachment/specifications.md)**: attaching threads to one workspace browsed under the allowed roots or cloned from a repository, or to none; with an optional own copy of a git workspace, and changing the workspace of a whole quest tree when moving it while no thread is running.
- **routine-running**: running a routine on its trigger, in its own thread or by opening new threads.
- **workflow-running**: running a workflow, each step as a thread.
- **[provider-accounts](capabilities/provider-accounts/specifications.md)**: running each thread on the harness and provider account chosen for it, with several accounts per harness, each signed in through the harness's own sign-in.
- **[tool-and-skill-loading](capabilities/tool-and-skill-loading/specifications.md)**: giving every thread its selected global and workspace MCP servers, required thread tools, and skill names and descriptions, with full instructions loaded when used and harness-specific skill preference.
- **[scoped-intel](capabilities/scoped-intel/specifications.md)**: gathering and recalling lore at thread, realm, or global scope.
- **[action-approval](capabilities/action-approval/specifications.md)**: asking the user in plain language before a risky action, one approval per action and thread, with standing permissions for what the user always allows.
- **[budget-control](capabilities/budget-control/specifications.md)**: budgets on each mission, on Guildmaster, and on all spending over a period, stopping new spending at the limit and shown as rings that fill as they are used.
- **[device-pairing](capabilities/device-pairing/specifications.md)**: pairing a phone or another Iskios with one pairing code and using a host's Iskios from it on any internet connection, with no account for the user.

See also the [requirements](requirements.md) and the [glossary](glossary.md).
