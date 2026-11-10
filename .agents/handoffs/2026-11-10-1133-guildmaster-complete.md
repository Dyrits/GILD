# Handoff: Guildmaster built (increments A, B, C) and awaiting a live run

Supersedes: `2026-11-10-1118-guildmaster-increment-a.md`
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `guildmaster` (from `charter-rename` at `b913921`, which is from `markdown-replies`, which is from `main` at `7a089a1`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Guildmaster is the one place quests start and the control panel over them (CHG-0106, CHG-0107): one permanent conversation that routes work to quests and Rituals, avoids duplicate quests, and reports and acts on quests. Done means the owner has used it with a live model and accepts how it behaves and looks.

## State

- All three increments are built and committed on `guildmaster`. Verified this session: `guildmaster.test.ts` (29 tests) passes; `bunx biome check .` and `bun run typecheck` pass; the full suite passed 581, 10 skipped (`env -u CLAUDE_CONFIG_DIR ... vitest run --maxWorkers=3`); the window was driven on the fake harness for A (`drive.py`) and B and C (`drive-b-c.py`) with screenshots in `documentation/verification/2026-11-10-guildmaster/`.
- Increment A (pushed earlier): hidden Guildmaster quest (`missions.is_guildmaster`), `open_mission`, `suggest_mission` as Continue in or Open a new quest anyway, ticket-key matching in `find_missions`, realm on a message, the screen with realm tiles in the right panel, the realm page's box sending to it.
- Increment B: `create_ritual` (added after the owner's live run turned "Say hello every hour" into a quest); hearing back (`guildmasterReports.ts` listens to every change and tells it once of Reported, Attention, and Failed quests it opened, `missions.opened_by_guildmaster` and `guildmaster_told`); `act_on_mission` (authorized by the owner's quoted words in the message that started the turn, snapshot confirmation before ending a quest with threads at work); `read_journal` with `mission`; `read_control_history`; any thread may message the Guildmaster and it may message any quest's top thread (`isWithinReach` in `tree.ts`); every other thread's instructions name the Guildmaster's thread id.
- Increment C: `Settings.tiers` (Light, Balanced, Heavy, each optional) and `shouldShowGuildmaster`; `tier` on `open_mission`, `suggest_mission`, and `create_ritual`; a tier not set or none falls back to the Settings default; the Guildmaster starts on Claude's cheapest model (Haiku) and with no default quest budget; its budget is set on its own screen; the Charter has a Guildmaster card (`apps/app/src/guildmasterSettings.tsx`).
- Migrations `0029_guildmaster` and `0030_guildmaster_reports`. If the owner's running desktop app already ran an earlier build of 0030, check the schema.
- Not verified: a live Claude Code, Codex, or OpenCode following `guildmasterInstructionsOf` (`packages/service/src/instructions.ts`); the look and the narrow window; saving a tier's Companion in the Charter (only Set and Clear and the hide toggle were pressed); the snapshot-confirmed ending end to end through a real owner reply (the unit test covers the question and the refusal).
- Not built (recorded in the specification's provisional choices): messages between quests by `@` reference and their event lines; the 20-message window with summarized older messages; the Guildmaster's spending on the quests' dashboard.
- `.tmp.md` in the repository root is untracked, not part of the work, and left uncommitted. Run tests from an agent shell with `env -u CLAUDE_CONFIG_DIR`; under heavy load, timing-sensitive tests (Codex and OpenCode interrupts, Lore fading) can time out, and pass alone.

## Decisions

- The owner's words authorize `act_on_mission`: the `quote` must appear in the message that started the Guildmaster's turn; this cannot prove intent for one action (specification, Provisional choices).
- Quests report once their turn has ended, so the closing reply travels with the report.
- The Guildmaster creates Rituals and does not hear back from their runs.
- Hiding the Guildmaster only removes its rail entry and opens the window on the quests; the realm page still sends to it.
- Handoffs are shared and committed; pushes to `main` are the owner's call.

## Next

1. Ask the owner to try a live run: the same ticket twice (expect Continue in), "every hour" requests (expect a Ritual), a finished quest (expect a relay), "mark that quest done" (expect the question when threads run). Fix the prompt in `guildmasterInstructionsOf` from what a real model does.
2. Press a tier's Companion save in the Charter and check it reaches the next quest.
3. If wanted, build the not-built items: `@` messages between quests with event lines, the 20-message window, the quests' dashboard showing the Guildmaster's spending.
4. Merge `markdown-replies`, `charter-rename`, and `guildmaster` to `main` when the owner approves.

## Open questions

- Does a real model follow the Guildmaster's instructions (search first, Ritual for repeating work, never open a quest that fits, act only when asked)? Only a live run answers it.
- Should the owner's own message show its realm in the conversation?
- Is quote-based authorization enough for `act_on_mission`, or should the owner confirm each action with a card?

## Sources

- `documentation/capabilities/mission-coordination/specifications.md` (Provisional choices to review), `documentation/capabilities/rituals/specifications.md`
- `documentation/changelog.md` (CHG-0106, CHG-0107), `documentation/work-in-progress.md` (Guildmaster batch)
- `documentation/verification/2026-11-10-guildmaster.md` and its folder
- `packages/service/src/{guildmaster,guildmasterReports,matching,suggestions,suggestionStore,instructions,startingContext,threadTools,threadToolHandlers,tree}.ts`, `packages/service/test/guildmaster.test.ts`, `apps/app/src/{guildmaster,guildmasterSettings,suggestions,settings,sidebar}.tsx`, `apps/app/App.tsx`
