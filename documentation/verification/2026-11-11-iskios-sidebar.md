# Verification: Iskios rename, simple theme, and left sidebar (CHG-0143)

- **Verdict:** partly proven. The tree logic, the rename's data move, and the folded categories are covered by automated tests; the sidebar was observed in the web export on the fake harness. The look in the Electron window, the packaged app, and the real data move are not proven.
- **Environment:** macOS, Bun workspace, Electron 45 as Node (tests), Expo web export on localhost:8099, Playwright (Python) with Chromium, a throwaway data folder `/tmp/iskios-drive/data` on the fake harness (never the owner's data).

| Claim | Check | Result |
| --- | --- | --- |
| Quests nest side-quests, collapse at any depth, and the quest itself is left out of its side-quest rows | `apps/app/test/shell/questTree.test.ts` (8 tests) | pass |
| Quests sort into realms (by name, latest first, empty realms kept) and into Realmless | same | pass |
| Agent-opened threads still fold when the setting says so | same | pass |
| Folded categories are Realms, Free Realms, Realmless, The Keep | `apps/app/test/shell/railStorage.test.ts` | pass |
| `Gild`, `Canopy`, and `OpenMission` data move into the Iskios folder, the newest first, with the database renamed to `iskios.sqlite` | `apps/desktop/test/formerData.test.ts` | pass |
| The ten entries appear in the agreed order; three Keep rows; Craft, Library, Workshop, Reserves open their page | [`drive.py`](2026-11-11-iskios-sidebar/drive.py), [home](2026-11-11-iskios-sidebar/04-hall.png) | observed |
| A quest three levels deep shows its path expanded and its open side-quest highlighted | [open side-quest](2026-11-11-iskios-sidebar/03-sidequest-open.png) | observed |
| Collapsing a side-quest hides what lies beneath it | [collapsed branch](2026-11-11-iskios-sidebar/11-collapsed-branch.png) | observed |
| The collapsed rail keeps the destinations as icons | [collapsed](2026-11-11-iskios-sidebar/10-collapsed.png) | observed |
| The board and the Charter in the new theme | [board](2026-11-11-iskios-sidebar/05-board.png), [Charter](2026-11-11-iskios-sidebar/13-charter.png) | observed |

Reproduce: copy [`serve.ts.txt`](2026-11-11-iskios-sidebar/serve.ts.txt) to `packages/service/scratch-serve.ts`, run `ISKIOS_DATA_DIR=/tmp/iskios-drive/data ELECTRON_RUN_AS_NODE=1 ../../node_modules/.bin/electron scratch-serve.ts > /tmp/iskios-serve.log` from `packages/service`, export the app with `bunx expo export --platform web --output-dir /tmp/iskios-drive/web` and serve it on 8099, then run `drive.py`; delete the scratch file afterwards. `drive.py` reads its endpoint from the log and writes to `/tmp/iskios-drive/shots`.

Not done: the Electron window and the installed app; the data move from a real `Gild` profile (the first launch of the renamed app does it); a narrow window (the screenshot was taken, not reviewed); keyboard and screen-reader checks of the new rows; the owner's review of the look.

## Final regression run (before the commit)

`bun run typecheck` (4 workspaces), `bunx biome check .`, `git diff --check`, the desktop build, and `bun run test --maxWorkers=3` (61 files passed, 1 skipped; 737 tests passed, 10 skipped) pass on the end state. These were not run against the starting commit, no check was shown able to fail by mutation in a separate worktree except where the tests were written first (`questTree.test.ts`, `formerData.test.ts`, the Free Realms service tests), and no fresh-context reproduction was done. Every screen claim stays "observed" in the web export on the fake harness, awaiting the owner's judgment of the look; the Electron window, the packaged app, and the real move of a `Gild` profile are unproven.
