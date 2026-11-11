# Handoff: Claude Code tool listing fault and the moved quest that stayed held

Supersedes: none
Workspace: ISKIOS repository, branch `main`, commit `9d275ae` on top of `f82aa4f`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Find and fix two faults the owner met in the dev app: a quest moved between realms that never answered, and a new quest that failed at once with "MCP tool mcp__iskios__answer_prompt (passed via --permission-prompt-tool) not found. Available MCP tools: none". Done means both fixed with regression tests and the owner's two stuck quests running again.

## State

- Fault 1, the stuck quest. Verified by reading the owner's dev database (`~/Library/Application Support/Iskios Dev/iskios.sqlite`, read only): the "Test." and "Sword" realm folders (`~/Downloads/gild-100-crests`, `~/Downloads/guildmaster_silver_icons`) no longer exist, so their quests were held in Attention with blocker `MissingWorkspace`, their messages undelivered, no turn ever started. `moveQuest` rewrote the realm but left the hold. Fixed in `packages/service/src/work/questMoves.ts` (frees and wakes the held threads); test in `packages/service/test/work/questMoves.test.ts`.
- Fault 2, the failed turn. Verified: `read_settings` (CHG-0193) has no arguments and its empty struct encodes as `{"not":{"type":"null"}}`, no object schema; Claude Code 2.1.322 drops the whole MCP tool listing, and only a turn that needs a permission prompt shows it. Found by reproducing with the real service and `claude`, then removing tools from the listing until only `read_settings` still broke it. Fixed in `definitionOf`, `packages/service/src/work/threadTools.ts`; test in `packages/service/test/work/threadTools.test.ts`.
- Verified now: both new tests failed before their fix and pass after; `questMoves`, `workspaces`, `threadTools` tests 48 of 48; Biome and the workspace typecheck pass (the pre-commit hook ran them). A retry of the owner's failed quest on a copy of their database completed after the fix.
- Verified now: the full service suite shows a few timeout failures that change from run to run, and they also occur on the unchanged `f82aa4f` (checked in a temporary worktree, since removed).
- Assumed, not checked: the running app after a restart. The dev app was not running during the work. The owner's three held or failed quests are still in their old state in the real database; Retry on each should run them (Retry frees a `MissingWorkspace` hold, and a failed turn retries on the current runner).
- Recorded as CHG-0197 in `documentation/changelog.md`.
- The Iskios assistant (OpenCode) told the owner the quest might have lost access to its old folder, and that the failed quest was a launch problem. The first was close, the second came from fault 2. Nothing was changed in the assistant.

## Decisions

- Both fixes are in the service, not in the harness adapter: the listing must be valid for any MCP client, and a move owns the state it invalidates (CHG-0197).
- A thread freed by a move is woken, not left Idle: if the destination folder is missing too, the existing admit check returns it to Attention there.
- Hand-offs are shared and committed in this repository, and `AGENTS.md` keeps only the three newest links, so the oldest line was dropped.

## Next

1. Restart the dev app and press Retry on "Analyse quest stuck after realm move", then on the two "Test." quests in Borderlands and Sword; confirm each runs.
2. Run a Claude Code quest in a real workspace that asks for a permission, in the app, and confirm the prompt reaches the owner.
3. Optional: the owner decides whether a held quest should say, on its page or in its journal, that its folder is missing, since the held quests showed only "Attention".

## Open questions

- Does the owner want the missing-folder hold made visible on the quest (Next, step 3)? The owner answers.
- Is any other tool's schema a non-object one in another harness? The new test covers every listed tool, so it would now fail; no other harness was run.

## Sources

- `documentation/changelog.md`, CHG-0197, and CHG-0172 (quest moves), CHG-0193 (settings tools).
- `packages/service/src/work/questMoves.ts`, `packages/service/src/work/threadTools.ts`, `packages/service/src/work/turns.ts` (the `MissingWorkspace` hold), `packages/service/src/harness/claudeArgs.ts` (the permission prompt tool).
- `packages/service/test/work/questMoves.test.ts`, `packages/service/test/work/threadTools.test.ts`.
- Commit `9d275ae`.
