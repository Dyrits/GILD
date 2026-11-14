# Thread handover

Status: built on 2026-11-10 by an agent under the owner's instruction ("make that we can change provider and model in the middle of a quest"), without questions (CHG-0096). Everything the owner did not decide is **provisional** until the owner reviews it.

## Problem and outcome

A quest runs on one harness and model for its whole life. When a limit is reached, a model is too weak for the next step, or a provider is down, the owner has to open a new quest and lose the conversation. A handover changes the harness, account, model, or effort of a quest or side-quest in the middle of it, and the new one carries on with everything said so far (ADR 0006).

## Agreed behavior

- **Where**: under the quest's message box, at its right, the same pickers as starting a quest: harness, account (when the harness has several), Companion (model), and effort. Choosing another value is the handover; no other confirmation (CHG-0157).
- **Effort**: only the levels the provider offers for the chosen model, after the model's own default: Codex's from its model list, Claude Code's from its own model list (fixed in Iskios, read on 2026-11-11), OpenCode's asked of OpenCode when the model is picked (its variants, such as `none` or `max`; CHG-0158). A model with none shows no effort picker. Changing to a model that lacks the chosen level, or whose levels are only known once asked, returns to the default (CHG-0157).
- **When** (CHG-0278): at any time, in a turn too. The pickers stay in the message box while the thread works, and the service accepts the change in any state. The running turn finishes on the runner it started on, its reply keeping that runner's mark; the thread's next turn (the next message, a message that arrived during the turn, or Retry) runs on the new runner. When the harness or account changed in the turn, the turn's own session is not kept, so the next turn starts a new session with the conversation. If the turn fails after the owner chose another runner, no backup or Ritual fallback replaces their choice: the thread stays Failed until Retry, which runs on the chosen runner. A running turn still shows the new runner's mark while it works (provisional).
- **Same harness and account, another model or effort**: the harness session carries on; the next turn uses the new model and effort.
- **Another harness or account**: a harness's session cannot be resumed by another harness or under another account, so the next turn starts a new session and its first message carries the whole conversation so far: the owner's messages, other threads' messages and results, and the thread's own replies, oldest first, under "Conversation so far".
- **A session the harness cannot resume** (CHG-0208): when a sandboxed OpenCode cannot load the thread's earlier session, it starts a new one, whose first message carries the same conversation so far; the thread shows a line saying the earlier conversation could not be picked up and that these notes were passed on.
- **Long conversations**: the oldest messages are left out, with a line saying how many, when the conversation would take over half the new model's context window (provisional: summarizing the oldest part, as ADR 0006 says, is staged).
- **Another harness's defaults**: choosing another harness takes its own sign-in and default model unless chosen, as when starting a quest.
- **Replies keep their author**: each reply keeps the harness and model that wrote it, with its provider's mark and name, after a handover.
- **The line** (CHG-0168): a handover leaves its line in the conversation, for example "Handed over to Codex · gpt-5 · default effort · 14:02", only when a turn starts on the new runner: the owner's next message, or Retry after a failed turn. Changing the pickers leaves nothing; changing them several times leaves one line, for the runner that runs, and changing them back to the runner the thread last ran on leaves none. A change that changes nothing leaves none. A backup's or a Ritual's fallback runs at once, so its "Fell back to …" line is written when it happens.
- **Nothing runs on the change itself** (CHG-0157): a message waiting after a failed turn runs on the new runner when the owner presses Retry on the failure notice or sends another message; a Stopped thread's messages wait until Resume. A backup's or a Ritual's fallback after a failure still retries at once.
- **Budget**: the thread keeps drawing on its quest's budget.
- **Account**: an account that does not exist or belongs to another harness is refused with the reason.
- **Deleting** a thread erases its handover lines.

## Not built

- A thread's own handover through a thread tool (the architecture lets a thread change a thread's runner).
- Resolving skills and tools again for the new harness (tool-and-skill-loading is not built).
- Summarizing the oldest part of a long conversation.
- Replaying what the earlier harness did in its turns (its tool calls and results): only messages are stored, so only messages are replayed.
- Handing over the Guildmaster or a routine's thread.

## Acceptance

- A failed thread handed over stays Failed until Retry, which runs its message on the new runner and leaves the line then (`handover.test.ts`).
- A change leaves no line until a message runs on it; then one line for the final runner; none when changed back (`handover.test.ts`).
- A model and effort change keeps the harness session; a harness change starts a new session with the history; a thread's first turn has no history (`handover.test.ts`).
- Replies keep the harness and model that wrote them (`handover.test.ts`, `companionLabel.test.ts`).
- Real Claude Code and Codex adapters on stand-ins: a thread handed over from Claude Code to Codex starts a new Codex thread whose first turn input holds the conversation (`harnesses.test.ts`).
- A change in a turn is accepted, the turn finishes, and the next turn runs on the new runner with a new session or the kept one (`handover.test.ts`); a failing turn takes no fallback over the owner's choice (`backups.test.ts`); a wrong account is refused (`handover.test.ts`).
- In the running app on the fake harness: the pickers in the quest's message box, the handover line, the earlier reply keeping its mark; the pickers absent during a turn were the earlier behavior, changed by CHG-0278 and not driven in a window ([proof](../../verification/2026-11-10-thread-handover.md)).
- Not run: a handover between live harnesses.
