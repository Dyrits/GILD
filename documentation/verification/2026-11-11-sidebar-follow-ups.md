# Proof: empty quests, Free Realm placement, and the sidebar follow-ups

- **Verdict:** partly proven. The service behavior (empty quest, naming, Free Realm placement, migration) and the sidebar grouping are proven by tests shown able to fail. Every visual and interaction change in the app is unproven: the running interface was not driven.
- **Work:** working tree (30 modified files, 1 new asset) on commit `2a75c4e`.
- **Agreement:** the owner's requests in the session of 2026-11-11 after CHG-0156 (sidebar follow-ups), with the starting specification in `documentation/capabilities/mission-tracking/specifications.md#starting-a-mission`.
- **Environment:** macOS (Darwin 25.6), Bun workspace, Electron as Node for vitest (`bun run test`), fake harness, throwaway SQLite files under `/tmp`. The app was not started.
- **Date:** 2026-11-11

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | `StartEmptyQuest` in a realm's folder makes a quest with no message, titled "New quest", Idle, in that realm; repeating the same request id returns the same quest | owner: "directly open a new quest in the realm, an empty conversation" | proven |
| C2 | The first message sent to the empty quest names it from that message's first line | owner: "if nothing is written … appears as New quest" (and so a first message names it) | proven |
| C3 | `StartEmptyQuest` with a Free Realm places the quest there with no workspace; with neither it is realmless; an unknown Free Realm is refused | owner: Free Realms and Realmless get the new-quest button | proven |
| C4 | The new `free_realm_id` column is added by migration `0038_mission_free_realm` | same | proven |
| C5 | The sidebar's grouping puts a quest in its Free Realm, keeps empty Free Realms, and keeps those quests out of Realmless | same | proven |
| C6 | The app typechecks, lints, and passes the whole suite; the desktop bundle builds | regressions | proven |
| C7 | Interface changes: silver icons and Charter icon; category headings open placeholder pages; Keep chevron; realms and free realms fold on click; scroll-and-plus button; new-quest button in the Realmless heading; Charter row between Reserves and Workshop; "Travel to a new realm" titles; Settings guide panel removed; "No quest in this realm yet." text | owner's requests | unproven (not driven); look awaits the owner |

## Evidence

### C1, C2

- **Check:** `ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run packages/service/test/work/missions.test.ts`, test "starting an empty quest in a realm".
- **Shown able to fail:** mutation in a separate worktree of the end state. M1: `nameNewQuest` made a no-op: that test failed. M4: the placeholder title changed to "Untitled": that test failed.
- **Result:** 9 passed on the end state; each mutation gives 1 failed, 18 passed (with the questTree file).
- **Reproduced:** see Reproduction.

### C3

- **Check:** same file, test "starting an empty quest in a Free Realm or in none".
- **Shown able to fail:** M2: the handler ignores `freeRealmId`: failed. M3: the existence check of the Free Realm removed: failed.
- **Result:** pass on the end state.

### C4

- **Check:** every service test builds its database through the migrator, so the column is exercised by C1 to C3.
- **Shown able to fail:** M7: the migration's `ALTER TABLE` replaced by `SELECT 1`: 9 tests in `missions.test.ts` failed.

### C5

- **Check:** `apps/app/test/shell/questTree.test.ts`, tests "puts quests outside any realm apart" and "places a quest in its Free Realm …".
- **Shown able to fail:** M5: the Free Realm filter inverted: failed. M6: the realmless filter no longer excludes Free Realm quests: failed.

### C6

- **Check:** `bun run typecheck`, `bunx biome check .`, `git diff --check`, `bun run test`, `cd apps/desktop && bun run build`.
- **Result:** typecheck exit 0 for 4 workspaces; Biome "Checked 355 files, No fixes applied"; diff check clean; 61 files passed, 1 skipped; 740 tests passed, 10 skipped; desktop bundle built (`dist` is ignored by git).

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Typecheck | `bun run typecheck` | not run | pass |
| Lint and format | `bunx biome check .` | not run | pass |
| Tests | `bun run test` | not run | pass (740 passed, 10 skipped) |
| Desktop bundle | `cd apps/desktop && bun run build` | not run | pass |

Nothing failed, so no failure needed to be compared with the starting commit.

## Not proven

- C7, all of it: no screenshot, no driven interaction. The sidebar, the placeholder pages, the chevron, the fold-on-click, the scroll icon, the Charter row, and the removal of the Settings guide are checked only by typecheck and lint. To prove them, export the web app on the fake harness as described in `2026-11-11-iskios-sidebar.md` and drive it, then ask the owner to judge the look in the Electron window.
- The migration was run on fresh databases only, not on a database made by the previous version with existing quests.
- Creating a quest from a Free Realm in the interface was not driven; only the request is tested.

## Reproduce

```sh
cd /Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS
bun run typecheck
bunx biome check .
bun run test
ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run packages/service/test/work/missions.test.ts apps/app/test/shell/questTree.test.ts
# mutations: in a separate `git worktree add /tmp/wt HEAD` with the working-tree diff applied (git diff --binary HEAD | git apply --binary)
# and node_modules symlinked, change one line and rerun the last command:
#  M1 packages/service/src/work/titles.ts: `if (mission !== undefined) yield* writeTitle` -> `if (false as boolean) yield* writeTitle`
#  M2 packages/service/src/service.ts: `freeRealmId: start.freeRealmId ?? null,` -> `freeRealmId: null,`
#  M3 packages/service/src/work/missions.ts: delete the line `if (freeRealm === undefined) return yield* invalid("No such free realm.");`
#  M4 packages/service/src/work/titles.ts: `newQuestTitle = "New quest"` -> `"Untitled"`
#  M5 apps/app/src/shell/questTree.ts: `mission.freeRealmId === freeRealm.id` -> `!==`
#  M6 apps/app/src/shell/questTree.ts: delete ` && mission.freeRealmId === null`
#  M7 packages/service/src/core/store.ts: replace the `ALTER TABLE missions ADD COLUMN free_realm_id TEXT` statement with `SELECT 1`
# each mutation must make at least one test fail; revert it before the next.
```

## Reproduction

A fresh-context subagent was given only this file and reran every command and all seven mutations in a separate worktree. Every result matched: typecheck exit 0, tests 61 files passed and 1 skipped with 740 passed and 10 skipped, the targeted run 19 passed, each of M1 to M6 giving 1 failed and 18 passed, and M7 giving 9 failed. One difference: Biome counted 361 files, not 355.

The difference has a cause outside this work. While the proof was being reproduced, another session working in the same checkout added `apps/app/src/shell/realmlessPage.tsx` and edited `sidebar.tsx`, `questTree.ts`, `App.tsx`, and others (a Realmless page; `git diff` grew from 381 to 457 added lines). The proof covers the tree as it stood when the first checks ran (`git diff` md5 `35b86c60fe890680fb6321f099c64cfd`, 30 modified files plus `charter.png`), not the later one. The mutations ran on a snapshot of the later diff but touch only files of this work, which the later edits did not change.

## New files

This proof, `apps/app/assets/nav/charter.png`, and the tests added to `packages/service/test/work/missions.test.ts` and `apps/app/test/shell/questTree.test.ts`; all uncommitted.
