# Handoff: the Companion's model label and Summons for the agent's own questions

Supersedes: none
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner saw the Companion answer a "multiple choice question, waiting for my answer" request in plain text. Two things follow: Summons (the Attention column) stays empty for such a question, and the Companion's label should name the model. Done when the label reads "Provider - Model name version" (delivered, below) and a new `ask_question` thread tool raises the agent's own questions, with choices, into Summons (not started).

## State

- Verified (full suite, typecheck, and check pass: 450 tests; mutation checks fail as expected, see the proof): Claude Code's `message.model` is saved on each agent reply (`messages.model`, migration `0024_message_model`), exposed as `Message.model` in `packages/contracts/src/records.ts`, and `companionLabelOf` in `apps/app/src/formatting.ts` turns it into "Anthropic - Sonnet 5.5"; the label shows above replies and the "writing…" draft (`conversationEntries.tsx`, `conversation.tsx`).
- Verified by file read: the model company comes from the model id (`claude-*` Anthropic, `gpt-*` OpenAI); otherwise the harness's own (Anthropic, OpenAI, OpenCode) with the thread's chosen model name.
- Assumed: Codex and OpenCode events carry a model Gild could read; neither adapter reads one now, so their replies carry null and show the fallback. Not probed live.
- Verified by file read: Summons holds only approval questions (`packages/contracts/src/questions.ts`; raised by `request_approval` in `packages/service/src/threadTools.ts` and by harness permission prompts). A free-text question from the agent never enters it.
- Not seen: the label in the running window; a migration over an older database.
- Also done: Crest (pauljoda/Crest, the source of the realm crest system) added to `documentation/inspirations.md` under "Interface and design".
- This handoff and everything above are committed and pushed to `main` together. No CHG record or changelog entry was written for the label.

## Decisions

- Owner chose a new `ask_question` tool over doing nothing or guessing from text: the agent calls it with a question and choices, the quest goes to Summons, a card with buttons shows, and the answer returns to the agent. It is a new capability, so a specification in `documentation/capabilities/` comes before code ([AGENTS.md](../../AGENTS.md)).
- Owner chose the model the harness reports on each reply over catalog labels with versions, which would be wrong for the default model.
- Owner chose the model's company as the provider in the label, not the harness name.
- Fallback for a reply with no reported model: the thread's chosen model under the harness's company.

## Next

1. Specify `ask_question` (observable behavior, edge cases, acceptance): what a question holds (text, choices, free answer), how it enters Summons and the notification, what happens when the owner answers in the composer instead, withdrawal when the thread is stopped, and how it relates to the approval `Question` type or sits beside it.
2. After the owner agrees, build it test-first, in a batch.
3. Read what Codex (`packages/service/src/codex.ts`) and OpenCode (`opencode.ts`) report about the model per reply, and pass it in the Reply event's `model` field.
4. Look at the label in the running window; write the CHG record and changelog entry for the label.

## Open questions

- Does `ask_question` reuse `Question` and its cards or need its own type? The owner decides during the specification.
- Do Codex and OpenCode report the real model? A live probe answers it.

## Sources

- Proof: `documentation/verification/2026-11-09-companion-label.md`
- Label code: `apps/app/src/formatting.ts`, `apps/app/src/conversationEntries.tsx`, `packages/service/src/claude.ts`, `packages/service/src/messaging.ts`, `packages/service/src/store.ts`
- Approvals as questions: `documentation/capabilities/action-approval/specifications.md`, `packages/service/src/threadTools.ts`, `packages/service/src/instructions.ts`
- Inspiration entry: `documentation/inspirations.md`
