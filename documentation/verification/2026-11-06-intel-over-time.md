# Proof: batch 13, intel over time

- **Verdict:** not proven overall: every behavior claim (C1–C11) is proven; the look of the intel panel and of the Settings fields (C12) awaits the owner's judgment. The owner has neither agreed the batch nor accepted it.
- **Work:** `5901f13`..working tree on `5901f13`, uncommitted.
- **Agreement:** `documentation/work-in-progress.md` (Batch 13), drawn from `documentation/capabilities/scoped-intel/specifications.md` as revised in CHG-0050. An agent chose the batch under the owner's instruction of 2026-11-06 ("build what is next", no questions this session).
- **Environment:** macOS 26 (Darwin 25.6.0), Bun 1.4, Electron 45.2.3 (tests run under `ELECTRON_RUN_AS_NODE=1`), Effect 4.1.2. Worktrees under `/tmp/om-verify`: `start` at `5901f13`, `end` at `5901f13` with the working tree's changes applied, each with `bun install`. Window drive: Metro `BROWSER=none CI=1 bunx expo start --port 8083` in `apps/app`; Electron `env -i HOME PATH USER TMPDIR LANG OPENMISSION_HARNESS=fake OPENMISSION_DATA_DIR=/tmp/om-run/data-b13 OPENMISSION_APP_URL=http://localhost:8083 bunx electron --inspect=9336 dist/main.js --remote-debugging-port=9335` in `apps/desktop`; `playwright-cli attach --cdp=http://localhost:9335`. The fake harness runs `call <tool> <json>` lines as tool calls, and `context` echoes the turn's context.
- **Date:** 2026-11-06

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | `save_intel` requires a kind (rule, preference, decision, fact, temporary); answers name it; a global save keeps its kind through approval; threads are told to save a rule from a chat as kind rule | specifications Kinds, Saving; work-in-progress Batch 13 | proven |
| C2 | Each turn's context carries active thread, mission, and workspace intel in full, active global intel as an index of summaries of at most 80 characters, then the count of dormant intels; a new global intel goes to the end of the index and the lines before it stay unchanged | specifications Recall | proven |
| C3 | Fading by kind: strength halves over the half-life since the last use; dormant below 0.15, archived below 0.05; a rule and a pinned intel never fade; the half-lives follow Settings | specifications Kinds, Fading | proven |
| C4 | Only `search_intel` counts as a use. Being in the context does not. A use makes a dormant intel active and slows its fading | specifications Fading | proven |
| C5 | `search_intel` searches active and dormant intel, never archived; ranks the closest match first and a word found in three intels or fewer higher; reads intels by identifier; refuses a call with neither query nor ids | specifications External contract | proven |
| C6 | The panel's data: kind, state, strength, uses, pinned; filters by state including Pinned; Pin, Unpin, and Restore (full strength, no use counted) | specifications Intel panel; work-in-progress Batch 13 | proven |
| C7 | Settings holds `intelHalfLives` (preference 90, decision 45, fact 45, temporary 3), saves and reads them back | specifications Kinds; diff `settings.ts`, `records.ts` | proven |
| C8 | The intel gauge counts active scoped intel in full and global intel by its index summary, not dormant intel | diff `intel.ts` `readGauge` | proven |
| C9 | Migration 0017 turns intel saved before kinds into an active Fact, unpinned, never used, last used when saved | diff `store.ts` | proven |
| C10 | Batch 12's intel behavior still holds | `intel.test.ts` (19 checks), saving as fact | proven |
| C11 | In the window, the panel's state chips, Pin, Unpin, Restore, and the four half-life fields in Settings act on the service | work-in-progress Batch 13 | proven |
| C12 | The look of the panel's new lines and controls and of the Settings fields | owner's interface pass | awaiting human judgment |

## Evidence

### C1–C8: service behavior

- **Check:** `ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run packages/service/test/intelOverTime.test.ts` (15 checks on Effect's test clock). C7 also: `packages/service/test/claude.test.ts` (settings defaults, save and read back with other half-lives, a missing setting taking its default).
- **Shown able to fail:**
  - Before and after: `intelOverTime.test.ts` copied into the `start` worktree: 15 of 15 failed; in `end`: 15 of 15 passed. The ranking check first passed on `start` because its intels were saved in an order that needed no ranking; its saves were reordered (worst match first) and it then failed on `start`.
  - Mutation, in the `end` worktree only, through [mutations.py](2026-11-06-intel-over-time/mutations.py): 20 of 20 mutants failed the intel checks ([mutations.txt](2026-11-06-intel-over-time/mutations.txt)). These covered pinning and rules ignored, the use slowdown, the thresholds, the Settings half-life, summaries, the gauge counting full text, the index order, dormant intel in full, the dormant count, rare-word weight, ranking, archived intel in search, the last use on search, the kind on approval, Restore, the Pinned filter, Unpin, and the rule instruction.
- **Result:** 15 passed in `end` and in the working checkout.
- **Reproduced:** by a fresh-context agent; match (see Reproduction).

### C9: migration 0017

- **Check:** [migration-old.test.ts](2026-11-06-intel-over-time/migration-old.test.ts), copied to `packages/service/test/` of `start`, saves "Saved before kinds." into `/tmp/om-verify/migration/store.sqlite` with the old schema; [migration-new.test.ts](2026-11-06-intel-over-time/migration-new.test.ts), copied to `packages/service/test/` of `end`, opens that database and reads the intel through `ListIntel`.
- **Shown able to fail:** with the backfill line `UPDATE intels SET last_used_at = saved_at` removed from `store.ts` in `end`, the step-2 check failed (the intel read as archived, last used at 0); restored, it passed.
- **Result:** step 1 and step 2 passed; the database held `Fact|0|0|1` (kind, pinned, uses, last use equals save).

### C10: batch 12 behavior

- **Check:** `packages/service/test/intel.test.ts`, 19 checks, each saving with `kind: "fact"`.
- **Shown able to fail:** batch 12's own mutation run (`documentation/verification/2026-11-06-scoped-intel/mutations.txt`, 12 of 12). In this batch, 6 of this batch's mutants were caught by these checks together with the new ones.
- **Result:** 19 passed.

### C11: in the window

- **Check:** in the drive set up as under Environment:
  1. Started a mission with three `call save_intel` lines (rule and temporary at mission scope, a long preference at global scope), then pressed Approve. The echo read "(mission, rule)" and "(mission, temporary)", with the global save awaiting approval ([b13-01](2026-11-06-intel-over-time/b13-01-saves-with-kinds.png)).
  2. Sent `context`. The global intel appeared as "(global, preference) The owner reviews every pull request on GitHub before it merges, and wants a…" ([b13-02](2026-11-06-intel-over-time/b13-02-context-index.png)).
  3. Ran `sqlite3 /tmp/om-run/data-b13/openmission.sqlite "UPDATE intels SET last_used_at = last_used_at - 9*86400000 WHERE kind='Temporary'"`, then sent `context`. The temporary intel was gone, with "1 dormant intel in your scope is not listed".
  4. Opened the thread's intel icon and pressed Dormant: "Temporary · dormant · strength 12% · not used yet" ([b13-03](2026-11-06-intel-over-time/b13-03-panel-dormant.png)).
  5. Sent `call search_intel {"query":"flaky api"}` and `call search_intel {"ids":["<global id>"]}`. Both found their intel, and the global one came back in full ([b13-04](2026-11-06-intel-over-time/b13-04-search-echo.png)).
  6. In the panel, the temporary intel read "active · strength 100% · used once". Pressing Pin on the global intel gave "pinned" and Unpin ([b13-05](2026-11-06-intel-over-time/b13-05-panel-used-pinned.png)).
  7. Moved the temporary intel's last use back 40 more days, then pressed Archived: "archived · strength 1%" ([b13-06](2026-11-06-intel-over-time/b13-06-archived.png)). Pressing Restore emptied Archived and showed it active ([b13-07](2026-11-06-intel-over-time/b13-07-restored.png)).
  8. In Settings, set the temporary half-life to 7 and pressed its Save. The database held `{"decision":45,"fact":45,"preference":90,"temporary":7}` ([b13-08](2026-11-06-intel-over-time/b13-08-settings-half-lives.png)).
- **Shown able to fail:** before and after. On `5901f13` the panel has no state chips, Pin, or Restore, and Settings has no half-life fields (compare `documentation/verification/2026-11-06-scoped-intel/b12-06-thread-panel.png`). Each step above was read back from the window text or the database, not assumed from the click.
- **Result:** as listed; screenshots in [2026-11-06-intel-over-time](2026-11-06-intel-over-time/).

### C12: look

- Screenshots b13-01 to b13-08. The owner deferred the look to the interface pass. Panel lines are long here because the drive's mission title is the scripted first message.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bun run test` | 237 passed, 5 skipped | 253 passed, 5 skipped |
| Typecheck | `bun run typecheck` | pass (4 packages) | pass (4 packages) |
| Lint and format | `bun run check` | pass | pass |
| Whitespace | `git diff --check` | not run | pass |
| Desktop build | `bun run build` in `apps/desktop` | not run | pass |
| Web export | `CI=1 bunx expo export --platform web` in `apps/app` | not run | pass |

## Not proven

- C12 awaits the owner's judgment of the look, deferred to the interface pass.
- Outside these claims, not checked: a live Claude Code thread choosing kinds, reading the index, and searching (opt-in live check not run).
- Observation, not a claim of this batch: the specification's acceptance example ("a temporary intel dormant after 30 days") does not hold with a 3-day half-life. The intel is dormant from about 8 days and archived from about 13. The tests check those values.

## Reproduce

```sh
R=/Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission; W=/tmp/om-verify
export ELECTRON_RUN_AS_NODE=1
T() { node_modules/.bin/electron node_modules/vitest/vitest.mjs run "$@"; }   # a function, so zsh passes the arguments
# Worktrees: start at 5901f13, end with the working tree's changes (or the commit that contains this proof).
git -C $R worktree add --detach $W/start 5901f13 && git -C $R worktree add --detach $W/end HEAD
# Only while the work is uncommitted: apply the diff and copy the new files, which git diff leaves out.
(cd $R && git diff --binary) | (cd $W/end && git apply)
for f in packages/service/src/intelFading.ts packages/service/test/intelOverTime.test.ts; do cp $R/$f $W/end/$f; done
(cd $W/start && bun install) && (cd $W/end && bun install)
# C1–C8 before and after
cp $W/end/packages/service/test/intelOverTime.test.ts $W/start/packages/service/test/
(cd $W/start && $T packages/service/test/intelOverTime.test.ts)   # expect 15 failed
(cd $W/end && $T packages/service/test/intelOverTime.test.ts packages/service/test/intel.test.ts)   # expect 34 passed
rm $W/start/packages/service/test/intelOverTime.test.ts
# Mutations, in the end worktree only
python3 $R/documentation/verification/2026-11-06-intel-over-time/mutations.py $W/end   # expect 20/20
# C9 migration
V=$R/documentation/verification/2026-11-06-intel-over-time; rm -rf $W/migration; mkdir -p $W/migration   # step 2 needs a database fresh from step 1
cp $V/migration-old.test.ts $W/start/packages/service/test/ && (cd $W/start && $T packages/service/test/migration-old.test.ts)
cp $V/migration-new.test.ts $W/end/packages/service/test/ && (cd $W/end && $T packages/service/test/migration-new.test.ts)
# Regressions, in the end worktree
(cd $W/end && bun run test && bun run typecheck && bun run check && (cd apps/desktop && bun run build))
# C11: start Metro and Electron as under Environment, attach playwright-cli, and follow C11's steps.
# Clean up
git -C $R worktree remove --force $W/start && git -C $R worktree remove --force $W/end && rm -rf $W
```

## New files

- `packages/service/test/intelOverTime.test.ts` (15 checks), part of the work.
- `documentation/verification/2026-11-06-intel-over-time/mutations.py`, `migration-old.test.ts`, and `migration-new.test.ts`, checks for this proof that the test suite does not run.

## Reproduction

On 2026-11-06 a fresh-context agent (Sonnet), given only this proof, reran every command and C11's window steps from new worktrees, with its own data folder. It did not modify the checkout: 28 entries in `git status --short` before and after. Everything matched:

- C1–C8: 15 failed on `start`, 34 passed on `end`, mutations 20/20.
- C9: `Fact|0|0|1`; the check failed with the backfill removed.
- C10: 19 passed.
- C11: steps 1–8 matched, including `{"decision":45,"fact":45,"preference":90,"temporary":7}`.
- Regressions: all six rows matched.

It needed two setup steps the script did not show, both added above: copying the new files that `git diff` leaves out, and a function for the test runner under zsh. It also noted that the migration step 2 fails on an already-migrated database, so the script now starts step 1 from an empty folder.
