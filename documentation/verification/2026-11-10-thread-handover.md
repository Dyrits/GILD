# Proof: changing harness, account, model, and effort in the middle of a quest

- **Verdict:** partly proven. The service behavior is proven by tests shown able to fail; the interface was driven once in the web export on the fake harness; the look and a handover between live harnesses await the owner.
- **Work:** working tree on `b7a0f16` (CHG-0096)
- **Agreement:** the owner's request of 2026-11-10 ("Make that we can change provider and model in the middle of a quest"); [thread-handover specification](../capabilities/thread-handover/specifications.md), ADR 0006
- **Environment:** macOS (Darwin 25.6.0), Bun workspace, Electron 45 as Node (service), Expo web export, Playwright (Python) with Chromium
- **Date:** 2026-11-10

## Claims

| # | Claim | Evidence | Verdict |
| --- | --- | --- | --- |
| C1 | A model and effort change keeps the harness session and applies from the next turn; no history is replayed | `handover.test.ts` (first test) | proven |
| C2 | A harness change starts a new session whose first turn carries the whole conversation, not its own message | `handover.test.ts` (second test) | proven |
| C3 | A thread's first turn carries no history | `handover.test.ts` | proven |
| C4 | Through the real Claude Code and Codex adapters (stand-ins), a handover starts a new Codex thread, not a resume, and its turn input holds the earlier conversation | `harnesses.test.ts` ("hands a Claude Code thread over to Codex…") | proven for stand-ins only |
| C5 | A change is refused while the thread is in a turn and for an account of another harness; nothing changes | `handover.test.ts` | proven |
| C6 | Each handover leaves one line; a change that changes nothing leaves none | `handover.test.ts`, [screenshot](2026-11-10-thread-handover/03-handed-over-codex.png) | proven |
| C7 | A Stopped thread's kept message, and a Failed thread's retry, run on the new runner | `handover.test.ts` | proven |
| C8 | Each reply keeps the harness and model that wrote it, with its provider's mark and name, after handovers | `handover.test.ts`, `companionLabel.test.ts`, [screenshot](2026-11-10-thread-handover/04-after-handover.png) | proven |
| C9 | Migration 0026 gives earlier replies their thread's harness and chosen model | scratch script `migrate.ts.txt` (below) | proven once, by hand |
| C10 | Deleting a thread erases its handover lines | `handover.test.ts` (deleting after a handover completes) | proven (without the delete, the foreign key fails the test) |
| C11 | In the running app the message box shows the pickers; choosing Codex hands the quest over; the pickers are absent while a turn runs and back after | `drive.py`, screenshots | observed; appearance awaits the owner |

## Evidence

### C1 to C3, C5 to C8: service checks

- **Check:** `cd packages/service && npx vitest run test/handover.test.ts` (11 tests) against the fake harness, whose new `runner` script line reports harness, model, effort, and session, and `context` reports the note.
- **Shown able to fail** (mutations in the working tree, each restored, `git diff` unchanged afterwards):
  - dropping `session_id = NULL` from the handover: the harness-change test and the stopped-thread test fail (C2, C7);
  - skipping the history read: the harness-change test fails (C2);
  - removing the in-turn refusal: the refusal test fails (C5);
  - dropping the wake after a change: the failed-thread retry test fails (C7);
  - storing no harness on a reply: the reply-author test fails (C8);
  - dropping the handover delete from `deleting.ts`: the deletion test fails (C10).
- **Result:** 11 passed.

### C4: real adapters on stand-ins

- **Check:** `npx vitest run test/harnesses.test.ts` (31 tests): a Claude Code thread, handed over to Codex with `gpt-x`, asserts one `thread/start`, no `thread/resume`, and a `turn/start` input holding "Conversation so far", the first message, the first reply, and the new message.
- **Shown able to fail:** with the history read disabled, this test fails.
- **Result:** 31 passed. Not run: live Codex, live Claude Code.

### C8: the author of a reply in the interface

- **Defect found by driving the window:** the first drive showed the earlier Claude Code reply under the OpenAI mark and name after the handover, because the interface read the thread's current harness. Fixed by recording the harness per reply and labelling from it (`replyWriterOf`); a second drive shows the earlier reply as "Anthropic - Default model" and the new one as "OpenAI - Default model" ([04-after-handover.png](2026-11-10-thread-handover/04-after-handover.png)).
- **Shown able to fail:** `replyWriterOf` ignoring the recorded harness fails `companionLabel.test.ts`.

### C9: migration backfill

- **Check:** `migrate.ts.txt` (run as `serve` below, in `packages/service`, with `ELECTRON_RUN_AS_NODE=1 ../../node_modules/.bin/electron`): `write` starts a Sonnet quest on a fresh database; `sqlite3` then drops `messages.harness`, empties `messages.model`, and deletes migration 26; `read` reopens the database.
- **Result:** the reply reads `[["claude","sonnet"]]`, harness and model restored by the migration.

### C11: the running app

- **Check:** `serve.ts.txt` (the service on the fake harness, 800 ms replies, endpoint printed), the web export served on 8099, and `drive.py` (Playwright injects `window.gild.endpoint`): starts a quest, reads the pickers, chooses Harness then Codex, sends `runner`, sends `wait 2500` and counts the pickers during and after the turn.
- **Result:** the Harness, Companion, and Effort pickers sit in the message box ([01](2026-11-10-thread-handover/01-first-turn.png), [02](2026-11-10-thread-handover/02-harness-menu.png)); the line "Handed over to Codex · default model · default effort" appears ([03](2026-11-10-thread-handover/03-handed-over-codex.png)); the next reply reads `codex/default/default/session none` ([04](2026-11-10-thread-handover/04-after-handover.png)); the Harness picker count is 0 during the turn and 1 after.
- **Awaiting human judgment:** how the pickers and the handover line look.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bun run test` | not run; 458 passed, 10 skipped as recorded in CHG-0095 | pass (473 passed, 10 skipped) |
| Typecheck | `bun run typecheck` | not run | pass |
| Lint and format | `bun run check` | not run | pass |
| Web export | `cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export` | not run | pass |

## Not proven

- A handover between live harnesses, and the history's real token cost on a live model.
- The history carries messages only: what the earlier harness did in tool calls is not replayed.
- The Account picker in the message box (the drive had one account per harness, so it was not shown); no Companion or Effort change was driven in the window (the Harness change was).
- The look, at other widths.

## Reproduce

```sh
bun run typecheck && bun run check && bun run test
cd packages/service && npx vitest run test/handover.test.ts test/harnesses.test.ts
```

The window drive: copy `serve.ts.txt` to `packages/service/scratch-serve.ts` and run `GILD_DATA_DIR=/tmp/gild-handover ELECTRON_RUN_AS_NODE=1 ../../node_modules/.bin/electron scratch-serve.ts > /tmp/gild-serve.log` from `packages/service`; export and serve the app (`cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export`, then `python3 -m http.server 8099` in it); run `python3 drive.py` from a folder holding the copied `drive.py` with its screenshots going to `/tmp/gild-drive` (create it first). Delete the scratch copy afterwards.

## Reproduction

A fresh-context agent given only this file reran the typecheck, lint, full tests (473 passed, 10 skipped), the two service test files (42 passed), the migration check (`REPLIES [["claude","sonnet"]]`), and the window drive (`LABELS_ON_PAGE` both labels, `PICKERS_DURING_TURN 0`, `PICKERS_AFTER_TURN 1`); every result matched. It did not rerun the mutations, and did not judge the screenshots. Two gaps in the instructions: create `/tmp/gild-migrate` before `write`, and the `messages` column is `sender_kind` and the migrations table's key `migration_id`.

## New files

`documentation/capabilities/thread-handover/specifications.md`, `packages/service/src/handover.ts`, `packages/service/test/handover.test.ts`, this proof and its folder.
