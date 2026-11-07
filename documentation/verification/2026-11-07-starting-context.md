# Proof: batch 17, the warning before a thread starts with too large a starting context

- **Verdict:** not proven overall: every behavior claim (C1–C4) is proven; the look of the warning (C5) awaits the owner's judgment. The owner has neither agreed the batch nor accepted it.
- **Work:** working tree on `b94771f` with batch 16 and batch 17, both uncommitted.
- **Agreement:** `documentation/work-in-progress.md` (Batch 17), drawn from `documentation/capabilities/thread-tree/specifications.md` (Opening a thread), agreed in CHG-0007. An agent chose the batch under the owner's instruction of 2026-11-07 ("build what is next", no questions this session).
- **Environment:** macOS 26 (Darwin 25.6.0), Bun 1.4, Electron 45.2.3 (tests run under `ELECTRON_RUN_AS_NODE=1`), Effect 4.1.2. `/tmp/om-b17` is a copy of the working tree (rsync without `.git`); `/tmp/om-b16` is that copy with this batch's edits reversed (no `PreviewStartingContext` handler or contract, no refusal in `tree.ts`, no starting context labels). Window drive: Metro `BROWSER=none CI=1 bunx expo start --port 8085` in `apps/app`; Electron `env -i HOME PATH USER TMPDIR LANG OPENMISSION_HARNESS=fake OPENMISSION_DATA_DIR=/tmp/om-run/data-b17 OPENMISSION_APP_URL=http://localhost:8085 bunx electron dist/main.js --remote-debugging-port=9341` in `apps/desktop`; `playwright-cli attach --cdp=http://localhost:9341`.
- **Date:** 2026-11-07

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The preview counts the request, the briefing and latest entries, the intel in the new thread's scope (the parent's, global as index lines), and the opener's messages, and its total is their sum | specifications Opening a thread; work-in-progress Batch 17 | proven |
| C2 | Past 25% of the chosen model's window the preview warns; no larger model is offered while every model counts 200,000 tokens; an unknown parent is refused | specifications Opening a thread; work-in-progress Batch 17 | proven |
| C3 | `OpenThread` is refused over the warning unless the owner chose Start anyway; under it the thread opens without asking | work-in-progress Batch 17 | proven |
| C4 | In the window, the form warns with the parts, Trim intel opens the panel inside the form with the request kept and the preview following a deletion, Send is refused with the share, Start anyway opens the thread, and a small thread opens with no warning | work-in-progress Batch 17 | proven |
| C5 | The look of the warning and of the panel inside the form | owner's interface pass | awaiting human judgment |

## Evidence

### C1–C3: service behavior

- **Check:** `packages/service/test/startingContext.test.ts` (9 checks); `apps/app/test/labels.test.ts` (2 new checks for the warning and parts lines).
- **Shown able to fail:** in `/tmp/om-b16` the new checks fail 8 of 9; the ninth, a small thread opening without asking, guards against over-refusing and passes there as intended. Mutation run: [mutations.py](2026-11-07-starting-context/mutations.py) applied 13 mutants in `/tmp/om-b17`, each followed by the starting context, thread, and intel tests or the label tests; [mutations.txt](2026-11-07-starting-context/mutations.txt) records 13 of 13 caught. A first run caught 12 of 13: dropping the global index from the intel count survived (a gap the intel gauge already had), and a check for global intel was added.
- **Result:** 9 passed; the full suite passed 311 with 5 opt-in live tests skipped.

### C4: window drive

- **Check:** in the drive set up as under Environment:
  1. Started a mission with "Hello short"; sent the top thread a message whose first line was `call save_intel` with a mission fact and whose rest was 90,000 characters, then two more messages of 90,000 characters (the fake harness echoes them).
  2. Open thread beneath, typed "Summarize this week's notes in five bullet points.": the form showed "This thread would start with about 112,619 tokens, 56% of the model's 200,000-token context window; the warning is at 25%.", "Request 13 · Journal 11 · Intel 9 · Opener's messages 112,586 tokens", "No model has a larger context window.", Trim intel, and Start anyway beside Send ([b17-01](2026-11-07-starting-context/b17-01-warning.png)).
  3. Trim intel: the intel panel opened inside the form, the request still typed below it ([b17-02](2026-11-07-starting-context/b17-02-trim-intel.png)). Delete on the mission fact: the parts line changed to "Intel 0" ([b17-03](2026-11-07-starting-context/b17-03-trimmed.png)).
  4. Back, then Enter (Send): "Not started: its starting context takes about 56% of the model's context window, over the warning at 25%. Choose a model with a larger window, trim intel, or start it anyway."; the database held 1 thread ([b17-04](2026-11-07-starting-context/b17-04-refused.png)).
  5. Start anyway: the thread opened beneath, ran, and its agent answered ([b17-05](2026-11-07-starting-context/b17-05-started-anyway.png)).
  6. Open thread beneath the new thread with "Check the bullet points.": no warning ([b17-06](2026-11-07-starting-context/b17-06-small-no-warning.png)); Enter opened it.
- **Read back from the database:** 3 threads, "Hello short", "Summarize this week's notes in five bullet points.", and "Check the bullet points.", all Idle.
- **Drive note:** a `playwright-cli click` on the dashboard's Send left a 90,000-character mission start pending and the composer busy; Enter in the thread's composer sent the same size at once. A service-level probe (a throwaway test, not kept) started a mission with the same message and settled Idle, so the service takes it; the cause lies in the window's path and was not investigated, as it is outside this batch.

### C5: look

- Screenshots b17-01 to b17-06. The panel inside the form has a fixed height of 420 points. The owner deferred the look to the interface pass.

## Regressions

- `bun run test` (311 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, `bun run build` in `apps/desktop`, and `CI=1 bunx expo export --platform web` passed.
- Rerun before the commit (load average 9–15): two full runs failed one or two fading tests on vitest's 5-second timeout ("never fades a rule or a pinned intel", "records no fading step for a rule"). Each simulates 1,000 days and takes about 3 s and 1.3 s alone, the same on `b94771f` in a copy, so neither batch slowed them. Both now set a 20-second timeout; the full suite then passed 311 with 5 skipped.

## Not verified

- A live Claude Code thread opened past the warning.
- No fresh-context agent reran this proof.

## Reproduction

```sh
R=/Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission; V=$R/documentation/verification/2026-11-07-starting-context
export ELECTRON_RUN_AS_NODE=1
T() { node_modules/.bin/electron node_modules/vitest/vitest.mjs run "$@"; }
rsync -a --exclude .git --exclude .zcode $R/ /tmp/om-b17/
(cd /tmp/om-b17 && T packages/service/test/startingContext.test.ts apps/app/test/labels.test.ts)   # expect all passed
python3 $V/mutations.py /tmp/om-b17                                                                 # expect 13/13
# Red check: copy /tmp/om-b17 to /tmp/om-b16, remove the PreviewStartingContext handler and contract, the refusal
# in tree.ts, and the two starting context labels, then run the same tests: expect 8 failed.
# C4: start Metro and Electron as under Environment, attach playwright-cli, and follow C4's steps.
rm -rf /tmp/om-b17 /tmp/om-b16 /tmp/om-run/data-b17
```
