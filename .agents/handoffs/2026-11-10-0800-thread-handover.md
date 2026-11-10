# Handoff: Thread handover (changing harness, account, model, and effort in the middle of a quest)

Supersedes: none
Workspace: Gild repository, `main` from `b7a0f16`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner can change a quest's or side-quest's harness, account, Companion (model), and effort between turns, and the new one carries on with the whole conversation; earlier replies keep the provider mark and name of whoever wrote them. Done when the owner has seen it in the running window and accepted it, and a live handover between real harnesses has worked.

## State

- **Built (committed and pushed to `main` with this handoff):** `ChangeThreadRunner` request (`packages/contracts/src/requests.ts`), `packages/service/src/handover.ts` (the change, the handover lines, the conversation replayed to a new session), migrations 0025 (`handovers` table) and 0026 (`messages.harness`, with backfill) in `store.ts`, per-reply harness and model recorded (`messaging.ts`, `turns.ts`), `handovers` in `MissionDetail`, and the pickers in the quest's message box (`apps/app/src/conversation.tsx`), the handover line (`conversationEntries.tsx`, `entries.ts`), and `replyWriterOf` (`formatting.ts`).
- **Verified (run this session):** `bun run typecheck`, `bun run check`, `bun run test` (473 passed, 10 skipped); `handover.test.ts` (11) and the new Claude Code to Codex check in `harnesses.test.ts` (31 in that file), each shown able to fail by mutation; the migration backfill by script; the window drive on the fake harness (pickers in the message box, "Handed over to Codex" line, earlier reply still Anthropic, pickers absent during a turn). A fresh-context agent reproduced all of it from the proof ([proof](../../documentation/verification/2026-11-10-thread-handover.md)).
- **Assumed / not run:** the look (the owner has not seen it); a handover between live Claude Code, Codex, and OpenCode; the Account picker (one account per harness in the drive); a Companion or Effort change in the window; the history's token cost on a live model.
- **Recorded:** CHG-0096 in `documentation/changelog.md`, [the specification](../../documentation/capabilities/thread-handover/specifications.md), an entry in `documentation/work-in-progress.md`, and the provider-accounts specification's line on keeping a harness.
- **Left from the previous thread (not touched):** the quest tree menu look and the conversation cards still await the owner (see `2026-11-10-0736-quest-tree-menu.md`).

## Decisions

- A handover is per thread, between turns only; the service refuses it in Running or Attention. Reason: a running turn cannot change runner safely. Recorded in the specification.
- Model or effort change alone keeps the harness session; harness or account change drops `session_id` and the next turn's note carries "Conversation so far" (owner, thread, and result messages, and the thread's replies). Reason: ADR 0006; sessions do not cross harnesses or accounts.
- The replayed history is capped at half of the model's context window (oldest left out with a count). Provisional: ADR 0006 says to summarize instead; that is staged.
- Each reply stores the harness and model that wrote it, because the interface labelled every reply with the thread's current harness (found by driving the window). The owner stated this requirement.
- A change wakes the thread, so a Failed thread retries its message on the new runner at once.

## Next

1. Ask the owner to look at the quest's message box with the pickers, the handover line, and replies after a handover, in the running window; adjust the look.
2. Run a live handover (Claude Code to Codex, and back) with real harnesses, and judge the replayed history on a long conversation.
3. Decide with the owner whether to summarize the oldest part of a long history instead of leaving it out, and whether a thread tool should let an agent hand a thread over.
4. Optional: replay tool calls and results (only messages are stored today); resolve skills and tools again for the new harness once tool-and-skill-loading exists.

## Open questions

- Is the half-window cap on replayed history right, or should the history be summarized? The owner can answer.
- Should the handover pickers also appear for a thread that is in a turn, queued for after it? The owner can answer.

## Sources

- `documentation/capabilities/thread-handover/specifications.md`, `documentation/architecture-decision-record/0006-handover-replays-full-history.md`, `documentation/capabilities/provider-accounts/specifications.md`
- `packages/service/src/handover.ts`, `packages/service/test/handover.test.ts`, `packages/service/test/harnesses.test.ts`, `apps/app/src/conversation.tsx`, `apps/app/src/formatting.ts`
- `documentation/changelog.md` (CHG-0096), `documentation/verification/2026-11-10-thread-handover.md`
