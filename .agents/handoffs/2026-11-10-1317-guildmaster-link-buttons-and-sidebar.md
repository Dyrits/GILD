# Handoff: Guildmaster on `main`, with link buttons beside its replies and finished quests off the sidebar

Supersedes: `2026-11-10-1133-guildmaster-complete.md`
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Guildmaster is the one place quests start and the control panel over them (CHG-0106, CHG-0107): one permanent conversation that routes work to quests and Rituals, avoids duplicate quests, and reports and acts on quests. Done means the owner has used it with a live model and accepts how it behaves and looks.

## State

- Everything the superseded handoff lists as built (increments A, B, and C) is on `main`. Verified by `git log`: `4b8931f` (A) and `ca173da` (B and C) are ancestors of `main`. The branches `markdown-replies`, `charter-rename`, and `guildmaster` no longer exist, locally or on the remote (verified by `git branch -a` and `git ls-remote --heads origin`); another session removed them after they were merged.
- Follow-up `9935fbe`, links after replies: a quest or Ritual the Guildmaster opened, created, or continued, and each report from a quest (result, Summons, failure), leads to a link placed after the Guildmaster's reply. Messages carry `fromMissionId`, null for the Guildmaster's own (`packages/contracts/src/records.ts`, `packages/service/src/missionDetail.ts`).
- Follow-up `6d8b7ca`, link buttons (the owner asked for "a big button on the right of the message"): each such link is now a gold button on the right of the reply, with what happened ("Opened quest", "Continued in quest", "Created Ritual", "Open quest") above the title. It wraps beneath the reply, right-aligned, where the column is too narrow, and stands on its own only until the reply is written. A reply's entry carries its links (`links` on the `Message` entry in `apps/app/src/entries.ts`; `QuestButton` and `AgentReply` in `conversationEntries.tsx`; `questButton*`, `replyLinks`, `replyWithLinks`, `messageRowLinked` in `styles.ts`). Verified now: `apps/app/test/entries.test.ts` passes (9 tests); driven in the window on the fake harness at 1440px and 1000px (`drive-button.py`, screenshots 14 to 16, row C18 of the verification record). Not driven: the button of a Ritual and of a continued quest (tested only); a live model's reply; the phone. `drive-links.py` no longer finds its link text.
- Follow-up `f4d5a33`, sidebar: the rail no longer lists finished (Done) quests by default; the Charter toggle "Show finished quests in the sidebar" (`shouldShowFinishedQuests`) brings them back, and a finished quest stays listed while it is open (`apps/app/src/railQuests.ts`, `sidebar.tsx`, `settings.tsx`). The board and the realm counts are unchanged. Verified by `apps/app/test/railQuests.test.ts`. Not driven in the window.
- Verified now, on a separate checkout of `main` holding only this thread's changes: `bun run typecheck` and `bunx biome check .` pass; the app's tests and `guildmaster.test.ts` pass (144 tests, `env -u CLAUDE_CONFIG_DIR bunx vitest run apps/app packages/service/test/guildmaster.test.ts --maxWorkers=3`). The full suite passed 591, 10 skipped, in the shared folder, which also held another session's uncommitted thread-panel work at the time.
- Push: `9935fbe`, `f4d5a33`, `6d8b7ca`, and this handoff's commit are pushed to `origin/main` right after this file is written. Assumed here; check with `git status -sb` on `main`.
- The shared folder was moved to branch `one-side-panel` by another session during this work (same commit as `main` before `6d8b7ca`), with its own uncommitted changes in `apps/app/src/{conversation,questPanel,threadPanel}.tsx`, one line of `styles.ts`, and `packages/service/scratch-serve.ts`. This thread left those alone and committed to `main` from a temporary checkout. The shared folder still holds uncommitted copies of the button's code (`entries.ts`, `conversationEntries.tsx`, three hunks of `styles.ts`, `entries.test.ts`), identical to `6d8b7ca`, so the app run from that folder shows the button. Drop those copies before merging `main` into that branch.
- None of the three follow-ups has a changelog entry (verified by searching `documentation/changelog.md`). They are recorded in the specification, the verification record, and `documentation/work-in-progress.md`.
- Not verified, carried over: a live Claude Code, Codex, or OpenCode following `guildmasterInstructionsOf` (`packages/service/src/instructions.ts`); the look and the phone; saving a tier's Companion in the Charter; ending a quest with threads at work through a real owner reply. If the owner's running desktop app already ran an earlier build of migration `0030_guildmaster_reports`, check the schema.
- Not built, carried over: messages between quests by `@` reference and their event lines; the 20-message window with summarized older messages; the Guildmaster's spending on the quests' dashboard.
- At 560px the realms panel covers the Guildmaster's conversation (seen while driving the window; not investigated, and older than this work).
- `.tmp.md` in the repository root is untracked, not part of the work, and left uncommitted. Two stale worktrees, `/private/tmp/wt-start` and `/private/tmp/wt-end`, are marked prunable and left alone. Run tests from an agent shell with `env -u CLAUDE_CONFIG_DIR`; under heavy load, timing-sensitive tests (Codex and OpenCode interrupts, Lore fading) can time out, and pass alone.

## Decisions

- A link never precedes the Guildmaster's confirmation, and it is a button on the right of that reply (the owner's two requests; specification, mission-coordination).
- Finished quests are off the sidebar by default. The owner said "by default", so a Charter toggle lists them again; the toggle is this session's reading of that word, not a stated request.
- The owner's words authorize `act_on_mission`: the `quote` must appear in the message that started the Guildmaster's turn; this cannot prove intent for one action (specification, Provisional choices).
- The owner asked for all the work to be on `main`. A push to `main` is refused by `.githooks/pre-push`; an agent asks the owner first (`AGENTS.md`), and the owner approved this thread's pushes.
- Other sessions switch the shared folder's branch. Check the branch before committing, and commit only your own paths.
- Handoffs are shared and committed.

## Next

1. Ask the owner for the live run: the same ticket twice (expect Continue in, then a "Continued in quest" button), an "every hour" request (expect a Ritual and its button), a finished quest (expect a relay with an "Open quest" button), "mark that quest done" (expect the question when threads run). Fix the prompt in `guildmasterInstructionsOf` from what a real model does.
2. Have the owner look at the button and the narrow layout; adjust size or wording from what they say.
3. Drive the sidebar in the window: a finished quest leaves the rail, stays while open, and returns with the Charter toggle.
4. Write the changelog entries for the three follow-ups if the project's conventions require them (`documentation/conventions.md`).
5. Press a tier's Companion save in the Charter and check it reaches the next quest.
6. If wanted, build the not-built items listed in State.

## Open questions

- Does a real model follow the Guildmaster's instructions (search first, Ritual for repeating work, never open a quest that fits, act only when asked)? Only a live run answers it.
- Is quote-based authorization enough for `act_on_mission`, or should the owner confirm each action with a card? Asked, not yet answered by the owner.
- Should the owner's own message show its realm in the conversation?
- Should the two stale worktrees be removed? The owner decides.

## Sources

- `documentation/capabilities/mission-coordination/specifications.md` (Provisional choices to review), `documentation/capabilities/rituals/specifications.md`
- `documentation/changelog.md` (CHG-0106, CHG-0107), `documentation/work-in-progress.md` (Guildmaster batch and its sidebar follow-up)
- `documentation/verification/2026-11-10-guildmaster.md` and its folder (rows C17 and C18, `drive-button.py`)
- Commits `4b8931f`, `ca173da`, `9935fbe`, `f4d5a33`, `6d8b7ca`
- `packages/service/src/{guildmaster,guildmasterReports,matching,suggestions,instructions,missionDetail,settings}.ts`, `packages/service/test/guildmaster.test.ts`, `apps/app/src/{entries.ts,conversationEntries.tsx,styles.ts,railQuests.ts,sidebar.tsx,settings.tsx,guildmaster.tsx,guildmasterSettings.tsx}`, `apps/app/test/{entries,railQuests}.test.ts`
