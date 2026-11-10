# Proof: the Guildmaster as the one place quests start (increments A, B, and C)

- **Verdict:** partly proven. The service rules are proven by 29 fake-harness tests; the screen, the Realm hand-off, a created Ritual, hearing back, the budget link, and the Charter's Guildmaster card were driven in the web export at 1440px on the fake harness. The look and a live model following the Guildmaster's prompt are not proven.
- **Work:** working tree on `b913921` (branch `charter-rename`), uncommitted when proven
- **Agreement:** CHG-0106 and CHG-0107 (the owner's request of 2026-11-10 after two quests on one ticket were not seen as one)
- **Environment:** macOS, Bun workspace, Electron 45 as Node (service and tests), Expo web export, Playwright (Python) with Chromium
- **Date:** 2026-11-10

## Claims

| # | Claim | Evidence | Verdict |
| --- | --- | --- | --- |
| C1 | One hidden Guildmaster quest exists, made once, in no list, search, or archive, and cannot be ended, renamed, or deleted | `packages/service/test/guildmaster.test.ts` ("is made once, hidden from every list ...") | proven |
| C2 | Its turn starts from its own instructions, the realms, and the quests as a list, and has no journal and no `open_thread` advice | same file ("starts a turn from its own instructions ...") | proven |
| C3 | `open_mission` opens a quest in the named realm, wakes its thread on the request, and leaves a card; only the Guildmaster may call it; an unknown realm is refused | same file ("opens it from the Guildmaster ...", "is the Guildmaster's alone ...") | proven |
| C4 | The Guildmaster opens no threads | same file ("opens no thread beneath itself") | proven |
| C5 | `find_missions` finds a quest on the same ticket key or link though its title and briefing never name it, ranks a shared ticket above shared words, and never offers the Guildmaster | same file ("finds the quest on the same ticket ...", "ranks a shared ticket ...") | proven |
| C6 | `suggest_mission` from the Guildmaster offers Continue in and a new quest, no aside; Continue in sends the owner's words to the chosen quest; a new quest opens in the named realm | same file ("offers Continue in ...", "opens a new quest in the realm ...") | proven |
| C7 | A realm attached to a message reaches the Guildmaster's turn with the message; an ordinary quest's messages carry no realm note | same file ("a realm chosen for a message", "an ordinary quest") | proven |
| C8 | The Guildmaster screen shows the conversation with the realm tiles in the right side panel; choosing a tile shows "The next quest opens in <realm>"; the card offers Continue in and "Open a new quest anyway", no aside; the opened quest shows as a line with a link | `drive.py` probes (all True), [empty](2026-11-10-guildmaster/01-empty.png), [continue in](2026-11-10-guildmaster/02-continue-in.png), [opened](2026-11-10-guildmaster/03-opened-anyway.png), [card](2026-11-10-guildmaster/04-open-mission-card.png) | observed; appearance awaits the owner |
| C9 | The message box at the foot of a realm's page goes to the Guildmaster with that realm attached, and the screen then shows the Guildmaster's conversation | `drive.py` probes, [realm page](2026-11-10-guildmaster/05-realm-page.png), [after](2026-11-10-guildmaster/06-after-handoff.png) (the echo shows the realm note) | observed |
| C11 | `create_ritual` makes a Ritual in its own quest (in no quest list) with a card, is the Guildmaster's alone, refuses an unknown realm, and its turn knows the Rituals that exist | `guildmaster.test.ts` ("creating a Ritual"), [card](2026-11-10-guildmaster/07-ritual-card.png) | proven; the card observed |
| C12 | A quest it opened tells it once of a result, of needing the owner, and of failure (with the reason); quests it did not open do not | `guildmaster.test.ts` ("hearing back ..."), [message](2026-11-10-guildmaster/08-hearing-back.png) | proven |
| C13 | `act_on_mission` renames and ends a resting quest only on the owner's quoted words, asks first when threads are at work, and is the Guildmaster's alone | `guildmaster.test.ts` ("acting on quests ...") | proven; the snapshot-confirmed second call is covered only by its refusal without the owner's words |
| C14 | `read_journal` of another quest and `read_control_history`; any thread may message the Guildmaster, which may message a quest's top thread, and no other cross-quest message | `guildmaster.test.ts` ("reading and messaging across quests") | proven |
| C15 | Tiers: a quest or Ritual starts on the tier chosen, else the Settings default; the offered new quest is prefilled with it; the turn knows the tiers; the Guildmaster starts on the cheapest Claude model and has no inherited budget, and can be given one that stops it | `guildmaster.test.ts` ("tiers, the Guildmaster's own Companion, and its budget"), [budget](2026-11-10-guildmaster/09-budget.png) | proven |
| C16 | The Charter's Guildmaster card sets and clears tiers and hides the rail entry | `drive-b-c.py`, [card](2026-11-10-guildmaster/10-charter-guildmaster.png), [hidden](2026-11-10-guildmaster/11-guildmaster-hidden.png) | observed; saving a tier's Companion not pressed |
| C17 | The link to a quest or Ritual the Guildmaster opened, created, or continued stands after its confirmation, and each report from a quest is followed by its reply and then a link that opens that quest | `apps/app/test/entries.test.ts` (5 tests), `guildmaster.test.ts` (report labelled with its quest), `drive-links.py`, [order](2026-11-10-guildmaster/12-links-after-reply.png), [opened quest](2026-11-10-guildmaster/13-link-opened-quest.png) | proven; observed in the window |
| C10 | No regression | typecheck and Biome pass; full suite 581 passed, 10 skipped (run with `--maxWorkers=3` on a loaded machine); web export builds | proven |

## Found by driving, then fixed

- The side panel did not open on this screen (the frame passed no panel toggle); it is now pinned open like the board's.
- The header and sub-line were dark on the dark wood; they now use the on-wood colours.
- The realm tiles overflowed the 360px panel; the panel now scrolls with padding and the foot row wraps.

## Regressions

| Check | Command | End state |
| --- | --- | --- |
| Tests | `bun run test` (with `env -u CLAUDE_CONFIG_DIR` from an agent shell) | 581 passed, 10 skipped |
| Typecheck | `bun run typecheck` | pass |
| Lint and format | `bunx biome check .` | pass |
| Web export | `cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export` | pass |

- Under machine load (load average about 16, the owner's desktop app also running) different timing-sensitive tests timed out from run to run (Codex steering and interrupt, OpenCode interrupt, three Lore fading tests); each passed when its file ran alone, and "cancels an interrupted prompt and counts the usage OpenCode reports" passed 3 of 3 alone. None touches code this batch changed. Not re-run on a quiet machine.
- Run from an agent's shell, `harnesses.test.ts` "runs a thread with an added account's own folder" fails because the shell's `CLAUDE_CONFIG_DIR` leaks into the harness environment (the service passes its whole environment on, as the Batch 3 notes record); it passes with `env -u CLAUDE_CONFIG_DIR`.

## Not proven

- A live model (Claude Code, Codex, OpenCode) following the Guildmaster's instructions: calling `find_missions` first, never opening a quest when one fits, passing the realm. Only the fake harness, which runs scripted tool calls, was used.
- The look against the owner's taste; the narrow window and the phone.
- The owner's own message does not show its realm in the conversation (only the box's note before sending, and the delivered text); the choice is kept in `messages.realm_path`.
- Messages between quests by `@` reference with event lines in the Guildmaster, the 20-message window with summarized older messages, and the Guildmaster's spending on the quests' dashboard (not built; see the specification's provisional choices).
- The snapshot-confirmed ending of a quest with threads at work, end to end through a real owner reply.
- Not reproduced by a fresh-context agent.

## Reproduce

```sh
bun run typecheck && bunx biome check . && bun run test
```

The window drive: copy `2026-11-10-guildmaster/serve.ts.txt` to `packages/service/scratch-serve.ts` and run `GILD_DATA_DIR=/tmp/gild-guildmaster ELECTRON_RUN_AS_NODE=1 ../../node_modules/.bin/electron scratch-serve.ts > /tmp/gild-serve.log` from `packages/service`; export the app (`cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export`) and serve it with `python3 -m http.server 8099` in that folder; then `python3 documentation/verification/2026-11-10-guildmaster/drive.py documentation/verification/2026-11-10-guildmaster`. Remove the scratch file afterwards.
