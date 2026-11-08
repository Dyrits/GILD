# Proof: sidebar, Idle column, send icon, menus, workspace-locked starter (CHG-0069)

- **Verdict:** not proven (one claim unproven, the look awaits the owner)
- **Work:** working tree on `b7ccc6c` (CHG-0068)
- **Agreement:** the owner's requests of 2026-11-08 in session; CHG-0069 in `documentation/changelog.md`
- **Environment:** macOS 26, Bun, Electron's Node for Vitest. Metro `CI=1 BROWSER=none bunx expo start --port 8097` in `apps/app`; Electron `env -i HOME PATH USER TMPDIR LANG CANOPY_HARNESS=fake CANOPY_DATA_DIR=/tmp/canopy-ui2/data CANOPY_APP_URL=http://localhost:8097 bunx electron dist/main.js --remote-debugging-port=9361` in `apps/desktop`, after `bun run build`; `playwright-cli attach --cdp=http://localhost:9361`. Clicks by coordinates (`mousemove`, `mousedown`, `mouseup`): `click <ref>` timed out after re-attaching.
- **Date:** 2026-11-08

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | Idle missions sit in their own Idle column, apart from Running (with Waiting) | owner: "Running … sometimes it finished" | proven |
| C2 | An open menu draws above later content, closes on an outside click, and opens upward when there is more room above | owner's screenshot of overlapping menus | proven (upward: by test only) |
| C3 | The sidebar reads Control, Workspaces (with counts), Missions with no workspace and an Archived subtitle, then Intel, Settings, Spending | owner's requests | proven (behavior); look awaiting human judgment |
| C4 | Send is a round arrow button, dimmed while empty; Enter still sends | owner: "an icon instead" | proven (behavior); look awaiting human judgment |
| C5 | On a workspace's board, a new mission starts in that workspace and the folder cannot be changed | owner's screenshot of a workspace board | proven |
| C6 | The conversation keeps a gutter so the scrollbar does not cover messages | owner's screenshot | unproven |

## Evidence

### C1: Idle column

- **Check:** `bun run test apps/app/test/boardColumns.test.ts`; window drive with an Idle mission.
- **Shown able to fail:** mutation in a worktree (`Idle: "Running"` in `columnOfState`): 1 of 6 failed.
- **Result:** pass; `sidebar-and-menus/idle-column.png`.
- **Reproduced:** by the author from a clean shell; match.

### C2: Menus

- **Check:** `bun run test apps/app/test/menuPlacement.test.ts`; in the window, open the Harness menu on Control, then click outside at (900, 600); open the Settings Model field.
- **Shown able to fail:** mutation (always place below): 1 of 5 failed. Before: the owner's screenshot shows the workspace line drawn over the harness list and two lists open at once.
- **Result:** pass; `menu-over-workspace-line.png`, `settings-dropdown.png`; the outside click closed the list and let the next action through.
- **Reproduced:** by the author; match.

### C3: Sidebar

- **Check:** window drive: Control, Workspaces (a workspace mission started over the socket, see C5), Missions, click "Archived ›" at (45, 249).
- **Shown able to fail:** before: CHG-0068's sidebar listed Missions, Intel, Archived as places and every mission (`2026-11-08-sketchbook-look/board.png`).
- **Result:** `control-empty.png`, `archived-subtitle.png`, `workspace-board-locked.png` (workspace with count 1).
- **Reproduced:** by the author; match.

### C4: Send icon

- **Check:** window drive: empty box shows a dimmed arrow (snapshot: `button "Send" [disabled]`); typed text and Enter started a mission.
- **Shown able to fail:** before: a text "Send" button (CHG-0068 screenshots).
- **Result:** `send-icon.png`, `control-empty.png`.
- **Reproduced:** by the author; match.

### C5: Workspace-locked starter

- **Check:** `bun run test packages/service/test/dashboard.test.ts` (workspaces carry their folder); window: start a mission in `/tmp/canopy-ws-demo` over the service socket (`playwright-cli eval` sending `StartMission`), open the workspace in the sidebar, type "Started from the board", Enter.
- **Shown able to fail:** mutation (`path: ""`): 1 of 12 failed. Before: the owner's screenshot shows "Workspace: none … Choose folder…" on a workspace board.
- **Result:** "Starts in canopy-ws-demo" shown; the new mission appears on the workspace's board, count 2 (`workspace-board-locked.png`, `workspace-board-started.png`).
- **Reproduced:** by the author; match.

### C6: Feed gutter

- **Check:** none observed: no conversation long enough to scroll was driven.
- **Shown able to fail:** no.
- **Result:** `contentContainerStyle={styles.feed}` (`paddingRight: 16`) on the conversation list, read in `apps/app/src/conversation.tsx`.
- **Reproduced:** not applicable.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bun run test` | 403 pass, 10 skipped (CHG-0068 record) | 410 pass, 10 skipped |
| Typecheck | `bun run typecheck` | pass (CHG-0068 record) | pass |
| Lint | `bun run check` | pass (CHG-0068 record) | pass |
| Desktop build | `bun run build` in `apps/desktop` | not run | pass |

## Not proven

- C6: drive a conversation with enough messages to scroll and screenshot its right edge.
- C3, C4 look: the owner judges in the app.
- C2 upward opening: covered by the placement test only, not seen in the window.

## Reproduce

```sh
bun run test && bun run typecheck && bun run check
(cd apps/desktop && bun run build)
# Window: start Metro and Electron as under Environment, then repeat the steps above.
```

## New files

None (the tests are committed with the work).
