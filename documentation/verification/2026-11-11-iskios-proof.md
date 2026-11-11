# Proof: Iskios, the assistant (CHG-0173 to CHG-0180)

Starting commit `f492434`; end state: the working tree after review and refactor (uncommitted when written). Run from the repository root. Tests: `ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run <files> --testTimeout=60000 --maxWorkers=2`. The machine was heavily loaded (load average 30 to 70), which makes the default 5 s timeouts fail unrelated tests: use the flags above.

## Claims and verdicts

| # | Claim (source) | Evidence | Shown able to fail | Verdict |
| --- | --- | --- | --- | --- |
| C1 | Iskios never opens a quest by itself: no `open_mission` tool, a quest opens only from the owner's choice on the card (CHG-0173) | `guildmaster.test.ts` "has no tool to open a quest by itself, only the card", "proposes it as a card with no match, opens nothing until the owner chooses..."; live run with Claude Code: the request produced a card, the quest opened after the click | Mutation: adding an `open_mission` entry to `threadTools.ts` fails the first test | proven |
| C2 | `create_realm` and `rename_realm` act only on the owner's quoted words and refuse: a quest's thread, an unknown realm, a name another realm has, a folder that already has a realm (CHG-0174, CHG-0175) | Seven tests under "managing realms at the owner's request"; live run: realm "Shop" made, renamed "Store" | Mutations: dropping the duplicate-name check in rename, and the folder check in create, each fail their test | proven |
| C3 | The card shows the realm Iskios named, lets the owner pick another or the Borderlands, refuses an unknown folder, and `suggest_mission` with a nonexistent or folderless realm makes no card | Four tests under "proposing a quest"; screenshots `2026-11-11-iskios-live/card*.png` | Mutations: ignoring the owner's `realmPath` fails 3 tests; removing the unknown-realm refusal fails 1 | proven (appearance awaiting human judgment) |
| C4 | The card offers Default and each tier set in the Workshop, one selected, the proposed one preselected; with none set it states the default (CHG-0179) | `apps/app/test/conversation/suggestionChoices.test.ts` (5 tests); live run with and without tiers, screenshots | Mutation: selecting the last match instead of the first fails "selects only the first..." | proven for the logic; look awaiting human judgment |
| C5 | Reading the Guild Hall place announces a change only when it makes the place, so the Guild Hall does not reload in a loop (CHG-0178) | `guildmaster.test.ts` "announces a change only when it makes the place..."; live: Guild Hall stable, 0 "Maximum update depth" errors | Mutation: always `changed(place)` fails it | proven |
| C6 | Visible texts and the assistant's instructions say Iskios; an old stored title "Guildmaster" becomes "Iskios" (CHG-0177) | `grep -rn '"[^"]*Guildmaster[^"]*"' apps/app/src packages/service/src` finds only identifiers and the old-title SQL; migration `0041_assistant_renamed_iskios`: its two UPDATE statements run on a copy of a database whose titles were set back to "Guildmaster" gave "Iskios" for the quest and the thread, other quests untouched | Before/after on the copy (titles "Guildmaster" then "Iskios") | proven for the SQL; the migrator wiring is exercised by every service test (the migration runs on each fixture) |
| C7 | No regression: typecheck, Biome, the suite | `bun run typecheck`, `npx biome check .`; full suite 795 pass, 5 fail: `prices.test.ts` "stamps an estimated cost...", `loreOverTime.test.ts` "never fades a rule or a pinned lore entry", `harnesses.test.ts` (steered message, interrupted turn, added account's folder) | The same 5 fail on `f492434` in a separate worktree (also in 2 earlier runs there, with up to 109 failures under load) | proven: the 5 failures are pre-existing |

## Not proven
- Light mode, a narrow window, a phone; the card with matching quests; Codex and OpenCode as Iskios's harness.
- The owner's look at the card and the Guild Hall (awaiting human judgment).
- `check-package.ts` (the packaged check) was edited and not run.

## Reproduce
Run in a throwaway copy of the tree with `node_modules` (a git worktree), never in the checkout. `T` is the test command above.
1. `T packages/service/test/work/guildmaster.test.ts apps/app/test/conversation/suggestionChoices.test.ts packages/service/test/core/store.test.ts`: all pass (guildmaster 44, suggestionChoices 5, store 3 at the time of writing).
2. `bun run typecheck` and `npx biome check .`: no error.
3. Mutations, each in the copy only, restoring the file after; the named test must fail:
   - `packages/service/src/work/guildmaster.ts`: `return isCreated ? changed(place) : unchanged(place);` to `return changed(place);` fails "announces a change only when it makes the place...".
   - `packages/service/src/work/guildmasterRealms.ts`: `if (other !== undefined) return refused` to `if (false) return refused` fails "refuses to rename an unknown realm, or to a name another realm has".
   - same file: `if ((yield* countRealms) === before)` to `if (false)` fails "refuses a name another realm has, and a folder that already has a realm".
   - `packages/service/src/work/suggestions.ts`: `if (isGuildmaster && givenRealm !== "" && realm === null)` to `if (false)` fails "makes no card for a realm that does not exist or has no folder...".
   - same file: `chosen.realmPath === undefined ? suggestion.realmPath : chosen.realmPath` to `suggestion.realmPath` fails 3 tests under "proposing a quest".
   - `apps/app/src/conversation/suggestionChoices.ts`: `choices.find((choice) => sameRunner(choice.runner, runner)) ?? null` to `choices.filter((choice) => sameRunner(choice.runner, runner)).at(-1) ?? null` fails "selects only the first..." in `suggestionChoices.test.ts`.
   - `packages/service/src/work/threadTools.ts`: add an `open_mission` entry before `open_thread` fails "has no tool to open a quest by itself, only the card".
4. Full suite on the end state and on `f492434` with the same flags: the failing names listed in C7 must appear in both.
