# Handoff: Guildmaster as the one place quests start, increment A

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `guildmaster` (from `charter-rename` at `b913921`, which is from `markdown-replies`, which is from `main` at `7a089a1`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner found that two quests on one ticket were not seen as one, because the Guildmaster screen was only a start box that opened quests directly. The Guildmaster becomes one permanent conversation that searches existing quests, offers Continue in, opens new quests, and eventually orchestrates them, per the full quest-coordination specification, built in three increments (A, B, C). Done means all three are built, checked with a live harness, and accepted by the owner.

## State

- Increment A is built and committed on `guildmaster` (CHG-0106 records the agreement). Verified this session: 11 new service tests (`packages/service/test/guildmaster.test.ts`) pass; `bun run typecheck` and `bunx biome check .` pass; the full suite passed 562 with 10 skipped and 1 timing-sensitive failure under machine load (load average about 16) that passes alone; the window was driven in the web export on the fake harness (`documentation/verification/2026-11-10-guildmaster.md`, `drive.py`, six screenshots).
- The Guildmaster is stored as one hidden quest (`missions.is_guildmaster`, migration `0029_guildmaster`), made on first `ReadGuildmaster`. It is left out of every list and search and cannot be ended, renamed, or deleted. Code: `packages/service/src/guildmaster.ts`, `apps/app/src/guildmaster.tsx`.
- Tools: `open_mission` (Guildmaster only) and `suggest_mission` (the owner's Continue in or Open a new quest anyway card; no aside from the Guildmaster); `find_missions` also searches each quest's opening request and weighs ticket keys and links (20 points) over words; `open_thread` is refused to the Guildmaster.
- A realm the owner picks (right side panel tiles, or from a realm page's box) rides on the message as `messages.realm_path` and reaches the turn as a note line; the realm page's box now sends to the Guildmaster and no box starts a quest directly (`MissionStarter` is gone).
- Not verified: a live Claude Code, Codex, or OpenCode following the Guildmaster's instructions in `guildmasterInstructionsOf` (`packages/service/src/instructions.ts`); the look; narrow window and phone. Assumed: the fake harness's scripted tool calls stand in for a model.
- Not built: increments B and C (see Next).
- `.tmp.md` in the repository root is untracked, not part of the work, and left uncommitted.
- Run tests from an agent shell with `env -u CLAUDE_CONFIG_DIR bun run test`, or an account test fails on the leaked variable.

## Decisions

- Build the full specification in three increments, A first (CHG-0106): A conversation, matching, open and continue, cards, realm hand-off; B hearing back, `act_on_mission`, `@Guildmaster`, event lines, `read_control_history`; C tiers, the Guildmaster's budget, the hide setting, prefilled cheapest model.
- Every start goes through the Guildmaster; the realm on a realm page's message is fixed, not a suggestion.
- A match is always offered as Continue in with "Open a new quest anyway", never opened silently.
- Realm tiles stand in the right side panel of the Guildmaster screen.
- The spec and glossary say Guildmaster and quest; tool names, contracts, and the folder `mission-coordination` keep their names.
- Hidden quest storage rather than a quest-less thread, to reuse turns, messages, usage, and cards.

## Next

1. Increment B per `documentation/capabilities/mission-coordination/specifications.md` (Hearing back, References between quests, `act_on_mission`, `read_control_history`), test-first with the fake harness.
2. Increment C (tiers, the Guildmaster's budget, the hide setting, prefilled cheapest model).
3. Ask the owner to try a live run: the same ticket twice, and see whether the Guildmaster offers Continue in.
4. Merge `markdown-replies`, `charter-rename`, and `guildmaster` to `main` when the owner approves (`git push --no-verify` for `main` is the owner's call).

## Open questions

- Does a real model follow the Guildmaster's instructions (search first, never open a quest that fits, pass the realm)? Only a live run answers it.
- Should the owner's own message show its realm in the conversation? Today only the box's note and the delivered text carry it.

## Sources

- `documentation/capabilities/mission-coordination/specifications.md`
- `documentation/changelog.md` (CHG-0106), `documentation/work-in-progress.md` (Guildmaster batch)
- `documentation/verification/2026-11-10-guildmaster.md` and its folder
- `packages/service/src/{guildmaster,matching,suggestions,instructions,startingContext,threadTools,threadToolHandlers}.ts`, `packages/service/test/guildmaster.test.ts`, `apps/app/src/{guildmaster,suggestions,dashboard}.tsx`, `apps/app/App.tsx`
