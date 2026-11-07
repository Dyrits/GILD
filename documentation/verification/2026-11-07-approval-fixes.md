# Proof: approval fixes (quote check, wrapped commands, one-time allowances)

- **Verdict:** proven for all claims on the fake harness; the Codex command format is not probed live.
- **Work:** working tree on `62face4`, committed after this proof (CHG-0063).
- **Agreement:** the owner's instruction of 2026-11-07 to continue with the next step without questions; the findings come from the Specifications review in `work-in-progress.md`.
- **Environment:** macOS 26, Bun, Electron's Node (`ELECTRON_RUN_AS_NODE=1`), the fake harness. No model was called.
- **Date:** 2026-11-07

## Claims

| # | Claim | Check (`packages/service/test/approvals.test.ts`) | Verdict |
| --- | --- | --- | --- |
| 1 | A quote that does not name the action ("it") asks | › "asks when the quoted words do not name the action"; › "refuses words that name another kind of action, or no action at all" | proven |
| 2 | A quote the owner negated asks | › "asks when the owner's quoted words refuse the action"; › "refuses words the owner negated in the same sentence" | proven |
| 3 | A quote found only inside a longer word asks | › "refuses words missing from the message or found only inside a longer word" | proven |
| 4 | Naming quotes still approve, including other verbs of the kind and unlisted commands | › "accepts words that appear in the owner's message and name the action"; › "accepts, for an action the sensitive list misses, words the command shares"; the existing "allows an action whose quoted words appear…" | proven |
| 5 | Wrapped sensitive commands are recognized; wrapped ordinary work still runs | › "recognizes a sensitive command wrapped in a shell, an environment, or a launcher"; › "lets ordinary work run…" (3 wrapped cases added) | proven |
| 6 | An allowance given in one turn does not cover a prompt in a later turn | › "asks again when the action allowed in an earlier turn is prompted in a later one" | proven |

## Shown able to fail

- Claims 1–5: with `quotes.ts` as a stub of the old check (`quote.trim().length >= 2 && message.includes(quote.trim())`) and the old `commandStart`, 8 of the new tests failed.
- Claim 6: on the old `threads.ts`, the new test failed with "mission did not settle": the second turn's prompt answered `prompt allowed` without a question.
- Mutations, each restored afterwards, against `approvals.test.ts`: dropping the negation check (2 failed), dropping the naming check (3 failed), dropping `approvals.endTurn` from the turn's end (1 failed), dropping the shell `-c` wrapper (1 failed).

## Regressions

`bun run test` passed 380 with 8 skipped, twice in a row. Typecheck, `bun run check` (no diagnostics), and `git diff --check` passed.

## Not verified

- The exact command string Codex sends in `item/commandExecution/requestApproval`: the fix covers both a bare command and a `bash -lc '…'` wrapper, but no live Codex escalation was run.
- The thread's instructions (`instructions.ts`) were not changed: they already ask for "the owner's exact words naming it".
