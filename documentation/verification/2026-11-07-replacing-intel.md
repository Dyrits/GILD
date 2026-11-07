# Proof: batch 14, replacing duplicates, origins, and relying on intel

- **Verdict:** not proven overall: every behavior claim (C1–C7) is proven; the look of the new panel line and approval card (C8) awaits the owner's judgment. The owner has neither agreed the batch nor accepted it.
- **Work:** `7b6ee2e`..working tree on `7b6ee2e`, uncommitted.
- **Agreement:** `documentation/work-in-progress.md` (Batch 14), drawn from `documentation/capabilities/scoped-intel/specifications.md` (Duplicates, Saving, Fading). An agent chose the batch under the owner's instruction of 2026-11-07 ("build what is next", no questions this session).
- **Environment:** macOS 26 (Darwin 25.6.0), Bun 1.4, Electron 45.2.3 (tests run under `ELECTRON_RUN_AS_NODE=1`), Effect 4.1.2. Copies under `/tmp`: `om-b14` is the working tree (rsync without `.git`, with its `node_modules`); `om-b14-start` is that copy with `git archive 7b6ee2e` written over it and the batch's new files removed. Window drive: Metro `BROWSER=none CI=1 bunx expo start --port 8083` in `apps/app`; Electron `env -i HOME PATH USER TMPDIR LANG OPENMISSION_HARNESS=fake OPENMISSION_DATA_DIR=/tmp/om-run/data-b14 OPENMISSION_APP_URL=http://localhost:8083 bunx electron --inspect=9336 dist/main.js --remote-debugging-port=9335` in `apps/desktop`, after `mkdir -p /tmp/om-run/data-b14` (the service cannot open its database in a missing folder); `playwright-cli attach --cdp=http://localhost:9335`.
- **Date:** 2026-11-07

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | A save whose text is close to an active or dormant intel in the same scope (shared-word closeness at least 0.6, at least 2 shared words) replaces it: same identifier, same uses, new text and kind, full strength; the answer names the replaced intel and its old text | specifications Duplicates; work-in-progress Batch 14 | proven |
| C2 | An unclear match is saved new and the answer names close intels (closeness at least 0.3); an intel in another scope, wider or narrower, is never replaced; an archived intel is never replaced | specifications Duplicates, Lookup; work-in-progress Batch 14 | proven |
| C3 | A global replacement awaits approval with the old and the new text, leaves the intel unchanged until approved, and approval replaces it in place | specifications Duplicates | proven |
| C4 | Each saved intel records its origin: the journal entry named with `journalEntry` (refused when it does not exist), or else the latest message delivered to the thread, from the owner or from a named thread; never an undelivered message; a global save keeps its origin through approval | specifications Saving; work-in-progress Batch 14 | proven |
| C5 | `relied_on_intel` counts one use of each intel in the thread's scope that is not archived, and refuses the rest; the context asks threads to use it and explains replacing and `journalEntry` | specifications Fading; work-in-progress Batch 14 | proven |
| C6 | Migration 0018 adds origin columns to `intels` and `intel_changes`; intel and global saves awaiting approval from before it read with no origin and still approve | diff `store.ts` | proven |
| C7 | In the window, a replacement, a global replacement card with "Was:", Approve, `relied_on_intel`, and the panel's "From …" line act on the service | work-in-progress Batch 14 | proven |
| C8 | The look of the panel's origin line and the replacement card | owner's interface pass | awaiting human judgment |

## Evidence

### C1–C5: service behavior

- **Check:** `ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run packages/service/test/intelReplacing.test.ts` (13 checks on Effect's test clock); `apps/app/test/labels.test.ts` for the "Replace intel in …" line and the origin label.
- **Shown able to fail:** the 13 checks run on `om-b14-start` (the starting commit) gave 12 failed, 1 passed (the archived case, which holds trivially before replacements exist). Mutation run: [mutations.py](2026-11-07-replacing-intel/mutations.py) applied 20 mutants in `om-b14`, each followed by the intel test files; [mutations.txt](2026-11-07-replacing-intel/mutations.txt) records 20 of 20 caught. The first run caught 19: dropping `delivered_turn_id IS NOT NULL` survived, so the check "never records a message the thread has not received" was added and kills it.
- **Result:** 13 passed; the full suite passed 267 with 5 opt-in live tests skipped.

### C6: migration 0018

- **Check:** [migration-old.test.ts](2026-11-07-replacing-intel/migration-old.test.ts), copied to `packages/service/test/` of `om-b14-start`, saves a thread intel and a global save awaiting approval into `/tmp/om-verify/migration14/store.sqlite`; [migration-new.test.ts](2026-11-07-replacing-intel/migration-new.test.ts), copied to `om-b14`, opens that database, reads the intel with `origin: null`, approves the old global save, and reads it with `origin: null`.
- **Shown able to fail:** with the migration adding columns to `intels` only, step 2 failed on a fresh step-1 database; restored, it passed.
- **Result:** both steps passed; the database held `Thread|NULL|Saved before origins.` and `Global|NULL|Global before origins.`, latest migration `intel_origins`.

### C7: window drive

- **Check:** in the drive set up as under Environment:
  1. Started a mission "Hello", then sent a message with three `call save_intel` lines (a rule and "The owner prefers pnpm." at mission scope, "The owner writes in British English." at global scope), and pressed Approve.
  2. Sent "We switched to Bun." with `call update_journal` (entry 1), `call save_intel` "The owner prefers Bun." with `journalEntry` 1, `call save_intel` "The owner writes in American English." at global scope, and `call relied_on_intel` with the rule's id. The echo read "Replaced intel bd44b8dc…: it said "The owner prefers pnpm."", "It repeats global intel 062a9bd8…, so it replaces it. Awaiting approval", and "Counted 1 use"; the thread showed "Replace intel in Mission "Hello"" and a "Replace intel in Global" card with "Was: The owner writes in British English." ([b14-01](2026-11-07-replacing-intel/b14-01-replacement-and-relied.png)).
  3. Opened the thread's intel icon: the card waited at the top; the Bun intel read "From journal entry 1: Switched the scripts from pnpm to Bun.", the rule "used once" and "From your message: Always run the tests before a commit. call save_intel…" ([b14-02](2026-11-07-replacing-intel/b14-02-panel-awaiting-replacement.png)).
  4. Pressed Approve: the global intel read "The owner writes in American English." with its new origin ([b14-03](2026-11-07-replacing-intel/b14-03-panel-after-approval.png)).
- **Read back from the database:** three intels, identifiers unchanged; changes `Save|Done` ×2, `Save|Approved`, `Replace|Done|The owner prefers pnpm.|The owner prefers Bun.`, `Replace|Approved|The owner writes in British English.|The owner writes in American English.`.
- **Shown able to fail:** before and after. On `7b6ee2e` the same calls save new intels (C1's checks fail there) and the panel has no origin line (compare `documentation/verification/2026-11-06-intel-over-time/b13-05-panel-used-pinned.png`).

### C8: look

- Screenshots b14-01 to b14-03. The owner deferred the look to the interface pass.

## Regressions

- `bun run test` (267 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, `bun run build` in `apps/desktop`, and `CI=1 bunx expo export --platform web` passed.

## Not verified

- A live Claude Code thread using replacements, `journalEntry`, and `relied_on_intel`.

## Reproduction

```sh
R=/Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission; V=$R/documentation/verification/2026-11-07-replacing-intel
export ELECTRON_RUN_AS_NODE=1
T() { node_modules/.bin/electron node_modules/vitest/vitest.mjs run "$@"; }   # a function, so zsh passes the arguments
# Copies: the end state, and the starting commit over it (once committed, archive both commits instead).
rsync -a --exclude .git --exclude .playwright-cli --exclude .codegraph $R/ /tmp/om-b14/
rsync -a /tmp/om-b14/ /tmp/om-b14-start/
(cd /tmp/om-b14-start && rm packages/service/src/intelDuplicates.ts packages/service/src/intelOrigins.ts packages/service/test/intelReplacing.test.ts)
git -C $R archive 7b6ee2e | tar -x -C /tmp/om-b14-start
# C1–C5 before and after
cp $R/packages/service/test/intelReplacing.test.ts /tmp/om-b14-start/packages/service/test/
(cd /tmp/om-b14-start && T packages/service/test/intelReplacing.test.ts)   # expect 12 failed, 1 passed
(cd /tmp/om-b14 && T packages/service/test/intelReplacing.test.ts)         # expect 13 passed
python3 $V/mutations.py /tmp/om-b14                                        # expect 20/20
# C6 migration
rm -rf /tmp/om-verify/migration14 && mkdir -p /tmp/om-verify/migration14
cp $V/migration-old.test.ts /tmp/om-b14-start/packages/service/test/ && (cd /tmp/om-b14-start && T packages/service/test/migration-old.test.ts)
cp $V/migration-new.test.ts /tmp/om-b14/packages/service/test/ && (cd /tmp/om-b14 && T packages/service/test/migration-new.test.ts)
# C7: start Metro and Electron as under Environment, attach playwright-cli, and follow C7's steps.
# Clean up
rm -rf /tmp/om-b14 /tmp/om-b14-start /tmp/om-verify/migration14 /tmp/om-run/data-b14
```

## New files

- `packages/service/test/intelReplacing.test.ts` (13 checks), part of the work.
- `documentation/verification/2026-11-07-replacing-intel/mutations.py`, `migration-old.test.ts`, and `migration-new.test.ts`, checks for this proof that the test suite does not run.
