# Changelog

## CHG-0001 · 2026-11-04 · Thread tree and thread messaging specified

Type: Documentation
Event: Agreement
Scope: Thread tree and thread messaging

Summary: Agreed the observable behavior and acceptance of thread-tree and thread-messaging:
- opening threads, with copied and editable defaults;
- the starting context, including the opener's messages since the last journal entry;
- subagents as threads;
- the seven thread states;
- results that reach the parent whenever they come;
- stopping without cascade, and deleting with confirmation;
- user-only depth limit, running-thread cap, and budget guard;
- tree-bound messaging, with delivery into the current turn where possible;
- steer or queue for user messages;
- interruptions and the chatter guard.
Reason: Every other capability builds on threads and their messages.
References: documentation/capabilities/thread-tree/specifications.md, documentation/capabilities/thread-messaging/specifications.md
Validation: Authorized by the user in the specification interview, rounds 1 and 2, on 2026-11-04.
Evidence: The user's answers in that interview.

## CHG-0002 · 2026-11-04 · Off-topic requests become missions or asides

Type: Documentation
Event: Agreement
Scope: Thread tree

Summary: When a user's message clearly shares nothing with the mission's journal summary, the thread suggests a new mission instead of answering. Declining opens an aside beneath the thread, kept out of the mission journal. Both start fresh with only the off-topic part of the message, and the original thread keeps a link to where it went. A setting can skip the suggestion. The thread tool for this is `suggest_mission`.
Reason: Missions stay focused, and their journals free of unrelated work.
References: documentation/capabilities/thread-tree/specifications.md#off-topic-requests
Validation: Authorized by the user on 2026-11-04.
Evidence: The user's answers to the off-topic request questions.
