# Handoff: Guildmaster on `main`, with links after its replies and finished quests off the sidebar

Supersedes: `2026-11-10-1133-guildmaster-complete.md`
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Guildmaster is the one place quests start and the control panel over them (CHG-0106, CHG-0107): one permanent conversation that routes work to quests and Rituals, avoids duplicate quests, and reports and acts on quests. Done means the owner has used it with a live model and accepts how it behaves and looks.

## State

- Everything the superseded handoff lists as built (increments A, B, and C) is on `main`. Verified by `git log`: `4b8931f` (A) and `ca173da` (B and C) are ancestors of `main`, and `origin/main` held them before this session's two follow-ups. `main` is the only branch left, locally and on the remote (verified by `git branch -a` and `git ls-remote --heads origin`); another session removed `markdown-replies`, `charter-rename`, and `guildmaster` after they were merged.
- Follow-up `9935fbe`, links: the link to a quest or Ritual the Guildmaster opened, created, or continued is drawn after its confirmation, not before (`apps/app/src/entries.ts`, `conversationEntries.tsx`). Each report from a quest (result, Summons, failure) is followed by the Guildmaster's reply and then an "Open quest: …" link. Messages carry `fromMissionId`, null for the Guildmaster's own (`packages/contracts/src/records.ts`, `packages/service/src/missionDetail.ts`). Verified now: `apps/app/test/entries.test.ts` and `packages/service/test/guildmaster.test.ts` pass. Driven in the window on the fake harness earlier this session (`drive-links.py`, screenshots 12 and 13, row C17 of the verification record); not re-driven for this handoff.
- Follow-up `f4d5a33`, sidebar: the rail no longer lists finished (Done) quests by default; the Charter toggle "Show finished quests in the sidebar" (`shouldShowFinishedQuests`) brings them back, and a finished quest stays listed while it is open (`apps/app/src/railQuests.ts`, `sidebar.tsx`, `settings.tsx`). The board and the realm counts are unchanged. Verified now: `apps/app/test/railQuests.test.ts` passes. Not driven in the window.
- Verified now: the three test files above pass (41 tests, `env -u CLAUDE_CONFIG_DIR bunx vitest run <files> --maxWorkers=3`); `bun run typecheck` and `bunx biome check .` pass. The full suite passed 590 after both follow-ups earlier this session; not re-run for this handoff.
- Push: both follow-ups and this handoff's commit are pushed to `origin/main` right after this file is written. Assumed here; check with `git status -sb`.
- Neither follow-up has a changelog entry (verified by searching `documentation/changelog.md`). The links are recorded in the specification and the verification record, the sidebar in `documentation/work-in-progress.md`.
- Not verified, carried over: a live Claude Code, Codex, or OpenCode following `guildmasterInstructionsOf` (`packages/service/src/instructions.ts`); the look and the narrow window; saving a tier's Companion in the Charter; ending a quest with threads at work through a real owner reply. If the owner's running desktop app already ran an earlier build of migration `0030_guildmaster_reports`, check the schema.
- Not built, carried over: messages between quests by `@` reference and their event lines; the 20-message window with summarized older messages; the Guildmaster's spending on the quests' dashboard.
- `.tmp.md` in the repository root is untracked, not part of the work, and left uncommitted. Two stale worktrees, `/private/tmp/wt-start` and `/private/tmp/wt-end`, are marked prunable and left alone. Run tests from an agent shell with `env -u CLAUDE_CONFIG_DIR`; under heavy load, timing-sensitive tests (Codex and OpenCode interrupts, Lore fading) can time out, and pass alone.
- Other sessions work in this repository at the same time and switch its branch (one moved it to `main` and committed CHG-0108 during this work). Check the branch before committing.

## Decisions

- A link follows the Guildmaster's confirmation and never precedes it, and every report from a quest gets its own link after the reply (the owner's request; specification, mission-coordination).
- Finished quests are off the sidebar by default. The owner said "by default", so a Charter toggle lists them again; the toggle is this session's reading of that word, not a stated request.
- The owner's words authorize `act_on_mission`: the `quote` must appear in the message that started the Guildmaster's turn; this cannot prove intent for one action (specification, Provisional choices).
- The owner asked for all the work to be on `main`; the three branches were fast-forwarded into it and work now lands on `main` directly.
- Handoffs are shared and committed.

## Next

1. Ask the owner for the live run: the same ticket twice (expect Continue in), an "every hour" request (expect a Ritual), a finished quest (expect a relay followed by a link), "mark that quest done" (expect the question when threads run). Fix the prompt in `guildmasterInstructionsOf` from what a real model does.
2. Drive the sidebar in the window: a finished quest leaves the rail, stays while open, and returns with the Charter toggle.
3. Write the changelog entries for the two follow-ups if the project's conventions require them (`documentation/conventions.md`).
4. Press a tier's Companion save in the Charter and check it reaches the next quest.
5. If wanted, build the not-built items listed in State.

## Open questions

- Does a real model follow the Guildmaster's instructions (search first, Ritual for repeating work, never open a quest that fits, act only when asked)? Only a live run answers it.
- Is quote-based authorization enough for `act_on_mission`, or should the owner confirm each action with a card? Asked, not yet answered by the owner.
- Should the owner's own message show its realm in the conversation?
- Should the two stale worktrees be removed? The owner decides.

## Sources

- `documentation/capabilities/mission-coordination/specifications.md` (Provisional choices to review), `documentation/capabilities/rituals/specifications.md`
- `documentation/changelog.md` (CHG-0106, CHG-0107), `documentation/work-in-progress.md` (Guildmaster batch and its sidebar follow-up)
- `documentation/verification/2026-11-10-guildmaster.md` and its folder (row C17, `drive-links.py`)
- Commits `4b8931f`, `ca173da`, `9935fbe`, `f4d5a33`
- `packages/service/src/{guildmaster,guildmasterReports,matching,suggestions,instructions,missionDetail,settings}.ts`, `packages/service/test/guildmaster.test.ts`, `apps/app/src/{entries.ts,conversationEntries.tsx,railQuests.ts,sidebar.tsx,settings.tsx,guildmaster.tsx,guildmasterSettings.tsx}`, `apps/app/test/{entries,railQuests}.test.ts`
