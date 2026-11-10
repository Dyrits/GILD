# Proof: the Guildmaster as the one place quests start (increment A)

- **Verdict:** partly proven. The service rules are proven by 11 new fake-harness tests; the screen and the Realm hand-off were driven once in the web export at 1440px on the fake harness. The look, a live model following the Guildmaster's prompt, and increments B and C are not proven.
- **Work:** working tree on `b913921` (branch `charter-rename`), uncommitted when proven
- **Agreement:** CHG-0106 (the owner's request of 2026-11-10 after two quests on one ticket were not seen as one)
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
| C10 | No regression | typecheck and Biome pass; full suite 562 passed, 10 skipped, 1 timing-sensitive failure under load (see below); web export builds | proven with the caveat below |

## Found by driving, then fixed

- The side panel did not open on this screen (the frame passed no panel toggle); it is now pinned open like the board's.
- The header and sub-line were dark on the dark wood; they now use the on-wood colours.
- The realm tiles overflowed the 360px panel; the panel now scrolls with padding and the foot row wraps.

## Regressions

| Check | Command | End state |
| --- | --- | --- |
| Tests | `bun run test` (with `env -u CLAUDE_CONFIG_DIR` from an agent shell) | 562 passed, 10 skipped, 1 failed under load |
| Typecheck | `bun run typecheck` | pass |
| Lint and format | `bunx biome check .` | pass |
| Web export | `cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export` | pass |

- Under machine load (load average about 16, the owner's desktop app also running) different timing-sensitive tests timed out from run to run (Codex steering and interrupt, OpenCode interrupt, three Lore fading tests); each passed when its file ran alone, and "cancels an interrupted prompt and counts the usage OpenCode reports" passed 3 of 3 alone. None touches code this batch changed. Not re-run on a quiet machine.
- Run from an agent's shell, `harnesses.test.ts` "runs a thread with an added account's own folder" fails because the shell's `CLAUDE_CONFIG_DIR` leaks into the harness environment (the service passes its whole environment on, as the Batch 3 notes record); it passes with `env -u CLAUDE_CONFIG_DIR`.

## Not proven

- A live model (Claude Code, Codex, OpenCode) following the Guildmaster's instructions: calling `find_missions` first, never opening a quest when one fits, passing the realm. Only the fake harness, which runs scripted tool calls, was used.
- The look against the owner's taste; the narrow window and the phone.
- The owner's own message does not show its realm in the conversation (only the box's note before sending, and the delivered text); the choice is kept in `messages.realm_path`.
- Increments B and C: hearing back, `act_on_mission`, `@Guildmaster` forwarding, tiers, the Guildmaster's budget, and the hide setting.
- Not reproduced by a fresh-context agent.

## Reproduce

```sh
bun run typecheck && bunx biome check . && bun run test
```

The window drive: copy `2026-11-10-guildmaster/serve.ts.txt` to `packages/service/scratch-serve.ts` and run `GILD_DATA_DIR=/tmp/gild-guildmaster ELECTRON_RUN_AS_NODE=1 ../../node_modules/.bin/electron scratch-serve.ts > /tmp/gild-serve.log` from `packages/service`; export the app (`cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export`) and serve it with `python3 -m http.server 8099` in that folder; then `python3 documentation/verification/2026-11-10-guildmaster/drive.py documentation/verification/2026-11-10-guildmaster`. Remove the scratch file afterwards.
