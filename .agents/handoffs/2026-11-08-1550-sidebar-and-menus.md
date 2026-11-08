# Handoff: Sidebar by Control and workspaces, Idle column, send icon, menus (CHG-0069)

Supersedes: `2026-11-08-1514-sketchbook-look.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Carry the Sketchbook look (CHG-0068) through the owner's review: the sidebar, board, composer, and menus they asked to change on 2026-11-08. Done means the owner accepts the look in the app; the remaining mockup items (plan usage, card details) follow.

## State

- **Done (CHG-0069):** summary, files, and validation in `documentation/changelog.md`. In short: sidebar ordered Control, Workspaces, Missions (no workspace) with an "Archived ›" subtitle, then Intel, Settings, Spending; board columns Attention, Running (with Waiting), Idle, Done; round arrow send button; menus open in a transparent modal layer placed by `apps/app/src/menuPlacement.ts`; a 16-point right gutter in the conversation feed; a workspace's board locks new missions to that workspace (`WorkspaceChoice` now carries `path`).
- **Verified on 2026-11-08 at about 15:45 by command output:** `bun run test` 410 passed, 10 skipped; `bun run typecheck`, `bun run check`, `git diff --check` pass.
- **Verified by app drive** (Electron with the fake harness, recipe in `documentation/verification/2026-11-08-thread-opening-indicators.md`, Environment line; run `bun run build` in `apps/desktop` after a service change, or the window runs the old service): screenshots in `documentation/verification/2026-11-08-sidebar-and-menus/`. A workspace mission was started over the service socket with `playwright-cli eval`, since the Finder dialog cannot be driven.
- **Tooling note:** after re-attaching, `playwright-cli click <ref>` timed out on every element; mouse clicks by coordinates (`mousemove`, `mousedown`, `mouseup`) worked.
- **Git:** CHG-0068 (`b7ccc6c`) and CHG-0069 committed and pushed to `main` with this handoff (assumed until `git log origin/main` shows them). `.zcode/` stays untracked.

## Decisions

- The sidebar's Control entry opens the board of every mission, headed "Control"; Control's own thread (mission-coordination) is not built and will be pinned there per its specification. Reason: the owner wanted Control on top; recorded in CHG-0069.
- Idle missions get their own column, answering the previous handoff's open question: the owner said Running felt wrong for missions whose threads had finished.
- Missions in a workspace are reached through their workspace's board, not listed in the sidebar; the sidebar's Missions lists only missions with no workspace.
- On a workspace's board the folder cannot be changed; the starter is hidden until the workspace's folder is known.
- Plan usage is not shown: no harness limit is read yet. The rail shows Canopy's own count of the global budget's period. Backlog entry holds the Codex evidence.

## Next

1. The owner reviews CHG-0068 and CHG-0069 in the app and accepts or asks for changes.
2. Plan usage per harness (backlog, "Plan usage in the rail"): live-probe Codex's app-server rate-limit notification, Claude Code's `rate_limit_event`, and OpenCode; store the latest reading; add a contract and rail meters.
3. Mission card details (backlog): harness, model, branch, and diff stats on `MissionSummary`.
4. Still unseen: the Attention circle, Done cards, the stacked layout below 860 points, a menu opening upward.

## Open questions

- Should the board's heading and the sidebar say "Control" for what the glossary calls the Dashboard? The owner decides; the glossary may need a line.
- Should "Idle" read as something friendlier ("Your turn")? The owner decides.
- Does the name "Canopy" still fit? Carried from the previous handoff; the owner decides.

## Sources

- `documentation/changelog.md` (CHG-0068, CHG-0069)
- `documentation/backlog.md` (Plan usage in the rail, Mission card details)
- `documentation/art-direction/2026-11-08-sketchbook-board.html`
- `documentation/verification/2026-11-08-sidebar-and-menus/`
- `apps/app/src/sidebar.tsx`, `dashboard.tsx`, `boardColumns.ts`, `pickers.tsx`, `menuPlacement.ts`, `controls.tsx`, `conversation.tsx`, `App.tsx`; `apps/app/test/boardColumns.test.ts`, `menuPlacement.test.ts`
- `packages/contracts/src/workspaces.ts`, `packages/service/src/dashboard.ts`, `packages/service/test/dashboard.test.ts`
- `documentation/capabilities/mission-coordination/specifications.md` (Control)
