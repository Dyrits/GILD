# Proof: OpenCode carries on after a refusal

- **Verdict:** proven for all claims, on the OpenCode stand-in and live on OpenCode 2.2.0.
- **Work:** working tree on `aa6f07c`, not committed (CHG-0065).
- **Agreement:** the owner's instruction of 2026-11-08 to continue with the next step without questions; the finding comes from the live probes recorded in CHG-0064 and `work-in-progress.md`.
- **Environment:** macOS 26, Bun, the OpenCode stand-in (`test/fixtures/stand-in-opencode.mjs`, now cancelling its prompt on a rejection as OpenCode does); live, the owner's OpenCode 2.2.0 with `opencode/deepseek-v4.1-flash-free` and the owner's Codex sign-in.
- **Date:** 2026-11-08

## Probe: no OpenCode setting continues after a rejection

Read from the installed `opencode` 2.2.0 binary's bundled source:

- `experimental.continue_loop_on_deny` appears only in a list of legacy keys the 2.x configuration loader drops (`rS = ["disable_paste_summary", "batch_tool", "openTelemetry", "primary_tools", "continue_loop_on_deny"]`, read in the `experimental` section and discarded).
- The ACP side offers `once`, `always`, `reject` and maps any rejection to `permission.reply({ decision: "reject" })` with no message. OpenCode's own `Permission.reply` turns a reject with a `message` into a `CorrectedError` (feedback to the model), but ACP never sends one, so a rejection is a `DeclinedError`, and a rejection also rejects every other pending request of the session.

So the adapter carries on itself: the refusal starts another prompt in the same turn.

## Claims

| # | Claim | Check | Verdict |
| --- | --- | --- | --- |
| 1 | After the owner's Deny cancels OpenCode's prompt, the same turn sends the refusal as a new prompt, the thread replies, and the turn's usage adds both prompts | `harnesses.test.ts` › "carries on in the same turn after the owner's refusal cancels OpenCode's prompt" | proven |
| 2 | Deny with a message gives OpenCode the owner's message, naming the refused file | `harnesses.test.ts` › "gives OpenCode the owner's message with a refusal"; › "asks the owner before an edit outside the thread's folder" | proven |
| 3 | An interrupt that cancels a prompt waiting on a question sends no refusal prompt | `harnesses.test.ts` › "sends no refusal after an interrupt cancels a prompt waiting on a question" | proven |
| 4 | Live: real OpenCode, denied a write outside its workspace with the message "Skip that file and reply with exactly: skipped", ends its turn Idle, unfailed, with a reply containing "skipped"; the file is not written | `liveHarnesses.test.ts` › "lets OpenCode write inside its workspace unasked, asks before it writes outside, and carries on after a refusal" | proven |

## Shown able to fail

- Before the fix: claims 1 and 2 failed (the turn ended with no reply).
- Mutation, restored afterwards: `runPrompts` always returning after the first prompt. 3 stand-in checks and the live check failed; the live reply was the turn's own request echoed back, with no "skipped".
- Claim 3 passed before the fix as well: it guards the interrupt path the fix adds a branch beside.

## Regressions

`bun run test` passed 392 with 10 skipped, twice in a row. Live, `CANOPY_LIVE_HARNESSES=1`: 5 of 5 passed. Typecheck, `bun run check`, and `git diff --check` passed.

## Not verified

- The app driven in the window.
- Several refusals within one prompt: OpenCode rejects every pending request of the session with the first, so they are joined into one follow-up prompt; only one refusal per prompt is exercised.
