# Handoff: Handover without auto-retry, pickers under the message box, provider effort levels

Supersedes: none
Workspace: ISKIOS, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Changing a thread's harness, account, model, or effort must not start a turn; the runner pickers sit under the message box at its right; the effort picker offers only the levels the provider gives for the chosen model. Done when the owner accepts it in the running app.

## State

- Verified by the handover test run: the owner's `ChangeThreadRunner` no longer wakes the thread; fallbacks (backups, Rituals) still do. `RetryThread` also retries a failed turn, and the failure notice in the quest shows a Retry button.
- Verified by typecheck: `ModelOption.efforts` (contracts) lists a model's levels; `EffortChoice` moved to `packages/contracts/src/harnesses.ts` and gained `ultra`. Codex levels are read from `model/list` (`supportedReasoningEfforts`); Claude Code levels are fixed in `harnessCatalog.ts`, read on 2026-11-11 from Claude Code's initialize reply (`supportedEffortLevels`: low to max for every offered model).
- Verified by source reading: `RunnerPickers` offers default plus the model's levels, hides effort when the model has none (OpenCode, the fake harness), and drops to default when a new model lacks the chosen level. The composer renders its accessory in a row under the pill, right-aligned.
- Verified: typecheck and Biome pass; `handover.test.ts` passes (11). The full suite had timeouts under a machine load of 35 to 55 that varied between runs; the account-folder test in `harnesses.test.ts` fails when the running session exports `CLAUDE_CONFIG_DIR`. Neither touches these changes.
- Not driven in the running app.

## Decisions

- Bottom right rather than the window top bar, by this session's choice (the owner offered either): smaller change, pickers stay beside the message they apply to.
- "Default effort" stays offered: it sends no level, so the model's own default applies; it is not an invented level.
- Claude Code levels are fixed rather than read live, since its models list is already fixed; recorded in CHG-0157.

## Next

1. Drive the app: change a failed quest's model, check nothing runs until Retry or a message; check the pickers' placement and effort lists for Claude Code, Codex, and OpenCode; obtain owner acceptance.
2. If the owner wants live Claude Code levels, read them from Claude Code's initialize control reply instead of the fixed list.

## Open questions

- Whether the owner prefers the pickers in the window top bar instead. The owner answers.

## Sources

- `documentation/changelog.md` (CHG-0157), `documentation/capabilities/thread-handover/specifications.md`
- `packages/service/src/work/handover.ts`, `packages/service/src/work/threads.ts`, `packages/service/src/harness/harnesses.ts`, `packages/service/src/harness/harnessCatalog.ts`
- `packages/contracts/src/harnesses.ts`, `apps/app/src/editors/runners.tsx`, `apps/app/src/ui/controls.tsx`, `apps/app/src/conversation/conversation.tsx`
- `packages/service/test/work/handover.test.ts`
- Starting revision `806d2ac`.
