# Proof: batch 15, intel history with undo

- **Verdict:** not proven overall: every behavior claim (C1–C6) is proven; the look of the history screen and the Deleted filter (C7) awaits the owner's judgment. The owner has neither agreed the batch nor accepted it.
- **Work:** working tree on `7b6ee2e`, uncommitted, on top of batch 14, which is also uncommitted.
- **Agreement:** `documentation/work-in-progress.md` (Batch 15), drawn from `documentation/capabilities/scoped-intel/specifications.md` (History and undo). An agent chose the batch under the owner's instruction of 2026-11-07 ("build what is next", no questions this session).
- **Environment:** macOS 26 (Darwin 25.6.0), Bun 1.4, Electron 45.2.3 (tests run under `ELECTRON_RUN_AS_NODE=1`), Effect 4.1.2. `/tmp/om-b15` is a copy of the working tree (rsync without `.git`); `/tmp/om-b15-start` is that copy with `git archive 7b6ee2e` written over it. Window drive: Metro `BROWSER=none CI=1 bunx expo start --port 8083` in `apps/app`; Electron `env -i HOME PATH USER TMPDIR LANG OPENMISSION_HARNESS=fake OPENMISSION_DATA_DIR=/tmp/om-run/data-b15 OPENMISSION_APP_URL=http://localhost:8083 bunx electron --inspect=9336 dist/main.js --remote-debugging-port=9335` in `apps/desktop`, after `mkdir -p /tmp/om-run/data-b15`; `playwright-cli attach --cdp=http://localhost:9335`.
- **Date:** 2026-11-07

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | Every save, replacement, correction, widening, and deletion by a thread, and every edit, deletion, pin, unpin, and restore by the owner, is an entry in the intel's history, newest first, with who made it (a thread with its title, or the owner) and when; an approved global change records the approval; a declined one is not in it; a replacement shows the text it replaced | specifications History and undo; work-in-progress Batch 15 | proven |
| C2 | Fading steps (dormant, archived) are worked out from strength with their times, stored when something resets fading, kept after a use or restore, absent for a rule; they have no Undo | specifications History and undo, Fading | proven |
| C3 | Undo puts back what a change changed (text, kind, scope, pin, origin; the last use only when no use came after), records "Undone" by the owner, marks the entry undone, and is itself undoable; undoing a save deletes the intel; undoing a deletion restores it with its identifier, uses, and origin; an undone entry, a fading step, and a change to a deleted intel are refused | specifications History and undo; work-in-progress Batch 15 | proven |
| C4 | The panel's Deleted filter lists only deleted intel, with the entry that deleted it; deleting a thread erases its own intel's history, deleted ones included | work-in-progress Batch 15 | proven |
| C5 | Migration 0019 creates `intel_history` and starts each existing intel's history with one "Saved" entry, which can be undone | diff `store.ts` | proven |
| C6 | In the window, History, Undo of a replacement, the Deleted filter, Undo deletion, fading steps, and Restore act on the service | work-in-progress Batch 15 | proven |
| C7 | The look of the history screen and the Deleted filter | owner's interface pass | awaiting human judgment |

## Evidence

### C1–C4: service behavior

- **Check:** `packages/service/test/intelHistory.test.ts` (16 checks on Effect's test clock); `apps/app/test/labels.test.ts` (2 checks for the history lines).
- **Shown able to fail:** before the implementation, the 15 checks then written failed 15 of 15 on the batch-14 working tree. Mutation run: [mutations.py](2026-11-07-intel-history/mutations.py) applied 22 mutants in a copy, each followed by the four intel test files; [mutations.txt](2026-11-07-intel-history/mutations.txt) records 22 of 22 caught. A first run caught 20 of 22: one guard was unreachable after an earlier check (removed), and the Deleted filter's "change left it absent" condition was untested, so the check "lists only deleted intel under the Deleted filter" was added.
- **Result:** 16 passed; the full suite passed 285 with 5 opt-in live tests skipped.

### C5: migration 0019

- **Check:** [migration-old.test.ts](2026-11-07-intel-history/migration-old.test.ts), run in `/tmp/om-b15-start` (schema at 0017), saves two rules and deletes one into `/tmp/om-verify/migration15/store.sqlite`; [migration-new.test.ts](2026-11-07-intel-history/migration-new.test.ts), run in `/tmp/om-b15`, migrates through 0018 and 0019, reads the remaining intel's history as one "Saved" entry by its thread, finds no deleted intel (one deleted before history has none), undoes the save, and finds the intel under Deleted.
- **Shown able to fail:** with the backfill loop emptied, step 2 failed on a fresh step-1 database; restored, it passed.
- **Result:** both steps passed; the database held `Saved|Thread|undone` and `Undone|Owner`, latest migration `intel_history`.

### C6: window drive

- **Check:** in the drive set up as under Environment:
  1. Started a mission whose first message saved three mission intels (a fact, "The owner prefers pnpm.", and a decision) through `call save_intel` lines.
  2. Sent `save_intel` "The owner prefers Bun." (replacing the pnpm preference), `update_intel` on the fact, and `forget_intel` on the decision. The echo read "Replaced intel 4bc973a5…", "Updated intel 95441995…", "Deleted intel 3a205e4b…".
  3. In the thread's intel panel: Pin on the Bun intel, then History: "Pinned by you", "Replaced by a save from "…"" with "Was: The owner prefers pnpm.", "Saved by "…"", each with Undo ([b15-01](2026-11-07-intel-history/b15-01-history-replaced.png)).
  4. Undo on the replacement: "You undid: replaced by a save" with Undo, the replacement marked "undone" without Undo, and the intel back to "The owner prefers pnpm." ([b15-02](2026-11-07-intel-history/b15-02-replacement-undone.png)).
  5. The Deleted filter listed only the decision, with Undo deletion and History ([b15-03](2026-11-07-intel-history/b15-03-deleted-filter.png)); Undo deletion left "No deleted intel." and the decision back under Any state ([b15-04](2026-11-07-intel-history/b15-04-deletion-undone.png)).
  6. Days simulated in the database: the fact's `saved_at`, `updated_at`, `last_used_at`, and its history times moved back 400 days. Its History showed "Became archived by fading" and "Became dormant by fading" at 45 × log2(1/0.05) and 45 × log2(1/0.15) days after its last use, with no Undo ([b15-05](2026-11-07-intel-history/b15-05-fading-steps.png)); after Restore, "Restored by you" above both steps ([b15-06](2026-11-07-intel-history/b15-06-restored-keeps-steps.png)).
- **Read back from the database:** `intel_history` held, in order, Saved ×3, Replaced (undone), Corrected, Deleted (undone), Pinned, Undone (Replaced), Undone (Deleted), Dormant and Archived by Fading, Restored.
- **Shown able to fail:** on `7b6ee2e` and the batch-14 tree the panel has no History link or Deleted filter, and `ReadIntelHistory` and `UndoIntelChange` do not exist (C1–C4's checks fail there).

### C7: look

- Screenshots b15-01 to b15-06. The owner deferred the look to the interface pass.

## Regressions

- `bun run test` (285 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, `bun run build` in `apps/desktop`, and `CI=1 bunx expo export --platform web` passed.

## Not verified

- A live Claude Code thread whose intel changes appear in the history.
- Fading steps after a half-life is changed in Settings (provisional: worked out with the current half-lives).

## Reproduction

```sh
R=/Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission; V=$R/documentation/verification/2026-11-07-intel-history
export ELECTRON_RUN_AS_NODE=1
T() { node_modules/.bin/electron node_modules/vitest/vitest.mjs run "$@"; }
rsync -a --exclude .git --exclude .playwright-cli --exclude .codegraph $R/ /tmp/om-b15/
rsync -a /tmp/om-b15/ /tmp/om-b15-start/ && git -C $R archive 7b6ee2e | tar -x -C /tmp/om-b15-start
(cd /tmp/om-b15 && T packages/service/test/intelHistory.test.ts)   # expect 16 passed
python3 $V/mutations.py /tmp/om-b15                                  # expect 22/22
rm -rf /tmp/om-verify/migration15 && mkdir -p /tmp/om-verify/migration15
cp $V/migration-old.test.ts /tmp/om-b15-start/packages/service/test/ && (cd /tmp/om-b15-start && T packages/service/test/migration-old.test.ts)
cp $V/migration-new.test.ts /tmp/om-b15/packages/service/test/ && (cd /tmp/om-b15 && T packages/service/test/migration-new.test.ts)
# C6: start Metro and Electron as under Environment, attach playwright-cli, and follow C6's steps.
rm -rf /tmp/om-b15 /tmp/om-b15-start /tmp/om-verify/migration15 /tmp/om-run/data-b15
```

## Reproduced

- 2026-11-07, before committing, by the building agent from a clean shell (`env -i`), in fresh copies (no fresh-context subagent): the full suite (285 passed, 5 skipped), typecheck, lint, and `git diff --check` passed; on `7b6ee2e` the batch-14 checks gave 12 failed, 1 passed and the batch-15 checks 16 of 16 failed; on the end state all 29 passed; batch 15's mutations 22 of 22; both two-step migration checks (0018, 0019) passed.
- Batch 14's [mutations.py](2026-11-07-replacing-intel/mutations.py) no longer applies as written: batch 15 rewrote its ninth target to `if (isApplied && target !== null && change.kind === "Replace") {`. With that line substituted, 20 of 20 mutants were caught on the end state.
