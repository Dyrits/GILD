# Proof: batch 16, widening and narrowing proposed from evidence

- **Verdict:** not proven overall: every behavior claim (C1–C5) is proven; the look of the proposal cards (C6) awaits the owner's judgment. The owner has neither agreed the batch nor accepted it.
- **Work:** working tree on `b94771f`, uncommitted.
- **Agreement:** `documentation/work-in-progress.md` (Batch 16), drawn from `documentation/capabilities/scoped-intel/specifications.md` (Widening and narrowing). An agent chose the batch under the owner's instruction of 2026-11-07 ("build what is next", no questions this session).
- **Environment:** macOS 26 (Darwin 25.6.0), Bun 1.4, Electron 45.2.3 (tests run under `ELECTRON_RUN_AS_NODE=1`), Effect 4.1.2. `/tmp/om-b16` is a copy of the working tree (rsync without `.git`); `/tmp/om-b16-start` is that copy with `git archive b94771f` written over it and the batch's new files removed. Window drive: Metro `BROWSER=none CI=1 bunx expo start --port 8085` in `apps/app`; Electron `env -i HOME PATH USER TMPDIR LANG OPENMISSION_HARNESS=fake OPENMISSION_DATA_DIR=/tmp/om-run/data-b16 OPENMISSION_APP_URL=http://localhost:8085 bunx electron --inspect=9340 dist/main.js --remote-debugging-port=9339` in `apps/desktop`; `playwright-cli attach --cdp=http://localhost:9339`; the folder dialog's handler replaced through the Node inspector with [main-eval.ts](2026-11-06-batch-4-drive/main-eval.ts) to return `/tmp/om-run/ws16/alpha` or `/tmp/om-run/ws16/beta`, as in earlier drives.
- **Date:** 2026-11-07

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The same workspace intel in two or more workspaces is proposed as one global intel with the newest text and kind; not for different intels, intels in one workspace, archived intel, or when a global intel already says it; a third workspace joining a declined set makes a new proposal | specifications Widening and narrowing; work-in-progress Batch 16 | proven |
| C2 | A global intel saved at least its kind's half-life ago whose every use over the last half-life came from one workspace is proposed for that workspace; not before a half-life, not when used in two workspaces or by a thread without one, not for a rule or an unused intel; uses before the window do not count | specifications Widening and narrowing; work-in-progress Batch 16 | proven |
| C3 | A proposal changes nothing before approval; Decline drops it for good; Approve widens (the newest becomes global with every intel's uses, the others are merged and listed under Deleted, their uses carried into later evidence) or narrows; each is in the history as the owner's and undoable; a proposal no longer backed is refused | specifications Widening and narrowing, History and undo | proven |
| C4 | Migration 0020 adds `intel_uses` and `intel_proposal_decisions`; intel saved before it is proposed and widened | diff `store.ts` | proven |
| C5 | In the window, a widening and a narrowing proposal appear in the intel panel, Approve applies them, History shows them with Undo, and Undo puts the narrowed intel back | work-in-progress Batch 16 | proven |
| C6 | The look of the proposal cards | owner's interface pass | awaiting human judgment |

## Evidence

### C1–C3: service behavior

- **Check:** `packages/service/test/intelProposals.test.ts` (15 checks on Effect's test clock); `apps/app/test/labels.test.ts` (2 new checks for the proposal and history lines).
- **Shown able to fail:** on the starting commit the 15 checks fail 15 of 15. Mutation run: [mutations.py](2026-11-07-intel-proposals/mutations.py) applied 17 mutants in a copy, each followed by the five intel test files; [mutations.txt](2026-11-07-intel-proposals/mutations.txt) records 17 of 17 caught. A first run caught 10 of 18: one mutant was equivalent (removed), and checks were added for intels in one workspace, partial word overlap, archived intel, carried uses, uses in two workspaces or none, and uses before the window.
- **Result:** 15 passed; the full suite passed 302 with 5 opt-in live tests skipped.

### C4: migration 0020

- **Check:** [migration-old.test.ts](2026-11-07-intel-proposals/migration-old.test.ts), run in `/tmp/om-b16-start` (schema at 0019), saves the same fact in two workspaces and searches one into `/tmp/om-verify/migration16/store.sqlite`; [migration-new.test.ts](2026-11-07-intel-proposals/migration-new.test.ts), run in `/tmp/om-b16`, migrates to 0020, finds one widening proposal, approves it, and finds one global intel with the old use counted.
- **Result:** both steps passed; the database's latest migration was `intel_proposals`, `intel_uses` held no rows (the old use had no workspace), and the decision was `Approved`.

### C5: window drive

- **Check:** in the drive set up as under Environment:
  1. Started a mission in `alpha` whose message was `call save_intel` with a workspace fact "Releases are tagged on main after the changelog is updated.", and one in `beta` with the same text and ", always.".
  2. The dashboard's Intel panel showed "Proposed from how intel is used" with "Saved separately in 2 workspaces: make it one global intel", the newest text, and both intels with their workspaces ([b16-01](2026-11-07-intel-proposals/b16-01-widening-proposed.png)).
  3. Approve: one Global intel was left ([b16-02](2026-11-07-intel-proposals/b16-02-widening-approved.png)); its History read "Moved to Global by you" with Undo ([b16-03](2026-11-07-intel-proposals/b16-03-widened-history.png)); the Deleted filter listed the alpha intel with Undo deletion ([b16-04](2026-11-07-intel-proposals/b16-04-merged-under-deleted.png)).
  4. Days simulated in the database: every intel, history, and use time moved back 50 days. A new mission in `alpha` ran `call search_intel {"query":"releases changelog"}`. The panel showed "Used only in Workspace alpha for 45 days, once: move it there" ([b16-05](2026-11-07-intel-proposals/b16-05-narrowing-proposed.png)).
  5. Approve, then History: "Moved to Workspace alpha by you" above "Moved to Global by you" ([b16-06](2026-11-07-intel-proposals/b16-06-narrowed-history.png)); Undo: "You undid: moved", the narrowing marked undone ([b16-07](2026-11-07-intel-proposals/b16-07-narrowing-undone.png)).
- **Read back from the database:** the intel Global with 1 use; `intel_history` Saved ×2, Merged, Widened, Narrowed (undone), Undone (Narrowed), all after the saves by the owner; two decisions, both Approved.
- **Shown able to fail:** on `b94771f` the panel has no proposals and `ResolveIntelProposal` does not exist (C1–C3's checks fail there).

### C6: look

- Screenshots b16-01 to b16-07. A merged intel under Deleted reads "deleted" there; its History says "Merged into one global intel". The owner deferred the look to the interface pass.

## Regressions

- `bun run test` (302 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, `bun run build` in `apps/desktop`, and `CI=1 bunx expo export --platform web` passed.

## Not verified

- A live Claude Code thread whose uses become evidence.
- No fresh-context agent reran this proof.

## Reproduction

```sh
R=/Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission; V=$R/documentation/verification/2026-11-07-intel-proposals
export ELECTRON_RUN_AS_NODE=1
T() { node_modules/.bin/electron node_modules/vitest/vitest.mjs run "$@"; }
rsync -a --exclude .git --exclude .playwright-cli --exclude .codegraph $R/ /tmp/om-b16/
rsync -a /tmp/om-b16/ /tmp/om-b16-start/ && git -C $R archive b94771f | tar -x -C /tmp/om-b16-start
rm /tmp/om-b16-start/packages/service/src/intelProposals.ts /tmp/om-b16-start/packages/service/test/intelProposals.test.ts
(cd /tmp/om-b16 && T packages/service/test/intelProposals.test.ts)   # expect 15 passed
python3 $V/mutations.py /tmp/om-b16                                    # expect 17/17
rm -rf /tmp/om-verify/migration16 && mkdir -p /tmp/om-verify/migration16
cp $V/migration-old.test.ts /tmp/om-b16-start/packages/service/test/ && (cd /tmp/om-b16-start && T packages/service/test/migration-old.test.ts)
cp $V/migration-new.test.ts /tmp/om-b16/packages/service/test/ && (cd /tmp/om-b16 && T packages/service/test/migration-new.test.ts)
# C5: start Metro and Electron as under Environment, attach playwright-cli, and follow C5's steps.
rm -rf /tmp/om-b16 /tmp/om-b16-start /tmp/om-verify/migration16 /tmp/om-run/data-b16
```
