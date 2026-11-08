# Handoff: Sketchbook look and mission board (CHG-0068)

Supersedes: none
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner disliked rows of chip buttons and wanted a new overall look between intentic, delta, and OpenBot, simple and close to a sketchbook, with a nod to a cockpit canopy. They chose direction C, then the "Sketchbook Board" mockup, and asked for it to be implemented. Done means the owner accepts the look in the app.

## State

- **Done (CHG-0068):** summary and file list in `documentation/changelog.md`. In short: new theme tokens (`apps/app/src/theme.ts`, same token names), shared styles restyled, `Choice`/`Menu`/`Steps` in `pickers.tsx` (no chip rows), dashboard board in `board.tsx` with grouping in `boardColumns.ts`, canopy drawings in `sketches.tsx`, Caveat loaded in `App.tsx`.
- **Mockups:** `documentation/art-direction/2026-11-08-art-directions.html` (four directions) and `2026-11-08-sketchbook-board.html` (chosen). Excluded from Biome in `biome.json`.
- **Verified on 2026-11-08 at 15:14 by command output:** `bun run test` 403 passed, 10 skipped; typecheck, `bun run check`, `git diff --check` pass.
- **Verified by app drive:** Electron window with the fake harness (recipe in `documentation/verification/2026-11-08-thread-opening-indicators.md`, Environment line). Screenshots in `documentation/verification/2026-11-08-sketchbook-look/`: empty board, board with one Idle mission, mission view with arched top, Settings, Intel. There is no written proof file for this batch, only the screenshots.
- **Not seen:** a card in Attention (the circle), a Done card, the stacked layout below 720 points, native builds.
- **Git:** committed and pushed with this handoff on `main` (assumed until `git log origin/main` shows it). `.zcode/` stays untracked.

## Decisions

- Existing color token names were kept with new values, so every screen changed without edits. Reason: least churn.
- `Choice` is segmented up to 3 options, a drop-down field past that. Effort in forms is a line of stops; in the composer every picker is an underlined word.
- Board columns: Attention holds Failed too; Running holds Waiting and Idle; a card names its state only when it differs from its column. Archived keeps its own view as a card list.
- The mission still opens full screen (with an arched top), not docked beside the board: the conversation and thread tree are too wide for a side panel.
- Handwriting (Caveat, bundled via `@expo-google-fonts/caveat`) only for headings, section labels, and notes; data stays in the system font.

## Next

1. The owner reviews the look in the app and accepts or asks for changes.
2. If accepted and wanted: add harness, model, branch, and diff stats to `MissionSummary` (contracts and `packages/service`) so cards show them, and plan usage in the sidebar.
3. Check the Attention circle, Done cards, and the narrow layout with missions in those states.

## Open questions

- Should Idle missions get their own column instead of sitting under Running? The owner decides.
- Does the name "Canopy" still fit, or does the tree-canopy reading suit the sketchbook look better? The owner said the product may be renamed later.

## Sources

- `documentation/changelog.md` (CHG-0068)
- `documentation/art-direction/2026-11-08-sketchbook-board.html`
- `documentation/verification/2026-11-08-sketchbook-look/`
- `documentation/inspirations.md`
- `apps/app/src/theme.ts`, `styles.ts`, `pickers.tsx`, `board.tsx`, `boardColumns.ts`, `sketches.tsx`, `dashboard.tsx`; `apps/app/test/boardColumns.test.ts`
