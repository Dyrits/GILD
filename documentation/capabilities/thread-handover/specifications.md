# Thread handover

Status: built on 2026-11-10 by an agent under the owner's instruction ("make that we can change provider and model in the middle of a quest"), without questions (CHG-0096). Everything the owner did not decide is **provisional** until the owner reviews it.

## Problem and outcome

A quest runs on one harness and model for its whole life. When a limit is reached, a model is too weak for the next step, or a provider is down, the owner has to open a new quest and lose the conversation. A handover changes the harness, account, model, or effort of a quest or side-quest in the middle of it, and the new one carries on with everything said so far (ADR 0006).

## Agreed behavior

- **Where**: the quest's message box offers the same pickers as starting a quest: harness, account (when the harness has several), Companion (model), and effort. Choosing another value is the handover; no other confirmation.
- **When**: between turns. While the thread is in a turn or waits for an answer (Running or Attention), the pickers are not offered and the service refuses the change; the owner interrupts or stops it first. A Stopped, Idle, Waiting, Done, or Failed thread can be handed over.
- **Same harness and account, another model or effort**: the harness session carries on; the next turn uses the new model and effort.
- **Another harness or account**: a harness's session cannot be resumed by another harness or under another account, so the next turn starts a new session and its first message carries the whole conversation so far: the owner's messages, other threads' messages and results, and the thread's own replies, oldest first, under "Conversation so far".
- **Long conversations**: the oldest messages are left out, with a line saying how many, when the conversation would take over half the new model's context window (provisional: summarizing the oldest part, as ADR 0006 says, is staged).
- **Another harness's defaults**: choosing another harness takes its own sign-in and default model unless chosen, as when starting a quest.
- **Replies keep their author**: each reply keeps the harness and model that wrote it, with its provider's mark and name, after a handover.
- **The line**: each handover leaves a line in the conversation, for example "Handed over to Codex · gpt-5 · default effort · 14:02". A change that changes nothing leaves none.
- **A message waiting** for the thread (kept while it was Stopped, or undelivered after a failed turn) runs on the new runner as soon as the thread is not Stopped: a Failed thread retries at once on the new runner.
- **Budget**: the thread keeps drawing on its quest's budget.
- **Account**: an account that does not exist or belongs to another harness is refused with the reason.
- **Deleting** a thread erases its handover lines.

## Not built

- A thread's own handover through a thread tool (the architecture lets a thread change a thread's runner).
- Resolving skills and tools again for the new harness (tool-and-skill-loading is not built).
- Summarizing the oldest part of a long conversation.
- Replaying what the earlier harness did in its turns (its tool calls and results): only messages are stored, so only messages are replayed.
- Handing over the quest's Control or a routine's thread.

## Acceptance

- A model and effort change keeps the harness session; a harness change starts a new session with the history; a thread's first turn has no history (`handover.test.ts`).
- Replies keep the harness and model that wrote them (`handover.test.ts`, `companionLabel.test.ts`).
- Real Claude Code and Codex adapters on stand-ins: a thread handed over from Claude Code to Codex starts a new Codex thread whose first turn input holds the conversation (`harnesses.test.ts`).
- Refusals while in a turn and for a wrong account (`handover.test.ts`).
- In the running app on the fake harness: the pickers in the quest's message box, the handover line, the earlier reply keeping its mark, the pickers absent during a turn ([proof](../../verification/2026-11-10-thread-handover.md)).
- Not run: a handover between live harnesses.
