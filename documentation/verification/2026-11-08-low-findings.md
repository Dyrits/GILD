# Proof: five Low findings fixed

- **Verdict:** proven for all claims, on the fake harness and the Codex and OpenCode stand-ins.
- **Work:** working tree on `506ba05`, not committed (CHG-0066).
- **Agreement:** the owner's instruction of 2026-11-08 to continue with the next step without questions; the findings are listed under "Review, refactor, and architecture pass" in `work-in-progress.md`.
- **Environment:** macOS 26, Bun, Electron's Node for Vitest; the fake harness, `test/fixtures/stand-in-opencode.mjs` (new "fragile run" mode: hangs on the next prompt and exits when cancelled), and the Codex stand-in.
- **Date:** 2026-11-08

## Claims

| # | Claim | Check | Verdict |
| --- | --- | --- | --- |
| 1 | At "Also commands and edits", a change inside the thread's folder is asked as "Change a file." with no sensitive kind; one climbing out with `..`, a Codex list naming an outside file, and a key file keep their sensitive kind | `approvals.test.ts` › "asks about a change inside the thread's folder at the stricter level as an ordinary change" | proven |
| 2 | Seven threads in Attention on a question plus their running opener fill the mission's 8: an 8th `open_thread` is refused with the reason | `threads.test.ts` › "counts threads waiting on the owner inside their turn toward the 8 running" | proven |
| 3 | A thread opened beneath one with 44 messages starts with the 40 latest and "(4 earlier messages left out.)" | `journal.test.ts` › "keeps the opener's 40 latest messages and counts those left out" | proven |
| 4 | After its account was removed and its mission reopened, a thread's turn fails with the reason and the harness gets no `turn/start` | `harnesses.test.ts` › "fails a turn on a removed account with the reason, without starting the harness" | proven |
| 5 | An interrupted OpenCode prompt counts the usage OpenCode reports with its cancel | `harnesses.test.ts` › "cancels an interrupted prompt and counts the usage OpenCode reports for it" | proven |
| 6 | When OpenCode exits during an interrupt, the usage of the turn's earlier prompt (refused, then followed up) is kept | `harnesses.test.ts` › "keeps the usage of a turn's earlier prompts when OpenCode exits during an interrupt" | proven |

## Shown able to fail

Each check ran before its fix:
- Claim 1: the inside change was asked with permission "Change a file outside the workspace".
- Claim 2: an 8th child opened (8 children instead of 7).
- Claim 3: the section had no count.
- Claim 4: the turn ran on the stand-in and the thread never failed (timed out).
- Claim 6: the mission's usage was zero.
- Claim 5 passed before any change: CHG-0065 already reported each prompt's usage, so this part of the finding was already closed; the check now guards it.

## Regressions

`bun run test` passed 397 with 10 skipped, twice in a row. Typecheck, `bun run check`, and `git diff --check` passed.

## Not verified

- Live harnesses: no live check exercises the stricter level, a removed account, or a dying process.
- Whether real OpenCode 2.2.0 sends usage with a cancelled prompt.
- The app driven in the window.
