# Handoff: Sidebar flat matte icons

Supersedes: none (forked from `2026-11-11-2154-gild-theme-icons-matte.md`)
Workspace: ISKIOS, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner replaced the sidebar's icons with their own flat matte set (`guildmaster-flat-matte-icons`). Done means the sidebar shows those drawings in both themes and both looks as the owner wants; the owner's look in the running app is what remains.

## State

- Verified now (git log): the icons and their records are committed on `main` as `a88c8d9` ("Sidebar icons are the owner's flat matte set, shared by both themes (CHG-0207)"); this handoff and the `AGENTS.md` pointer come in the commit after it.
- Verified by command output in this session: `bun run typecheck` passes in all six workspaces; `bun run check` (Biome) passes; the app suite gives 33 files, 305 passed, 4 skipped; `npx expo export --platform web` bundles the 24 icons.
- Verified by file read: `apps/app/assets/nav/dark/` holds the 12 ivory drawings and `apps/app/assets/nav/light/` the 12 slate-blue ones; `apps/app/src/shell/navIcons.tsx` holds two sets keyed by look and no longer reads the theme; the metallic, gilt, and bronze sets (`assets/nav/*.png`, `gild/`, `gild-light/`) and the unused `realmless.png` files are gone.
- Verified by looking: the four screenshots in `documentation/verification/2026-11-12-sidebar-flat-icons/` show the sidebar in the four theme and look combinations, captured in a throwaway Electron window on an empty data folder.
- In flight: nothing. The owner has not yet looked at the result.

## Decisions

- Both themes share the same two colorways, as the owner chose this session: ivory on dark looks, slate blue on light ones. Recorded in CHG-0207.
- Each 256 px source is cropped to its drawing, keeps its aspect, and is fitted to 192 px, as the sets before it, so rows line up at 22 px and 28 px.
- File names are unchanged, so the Borderlands keep `free-realms.png` as the sets before them did (CHG-0161).
- The supplied Realmless drawing (sparkles) is not added: the sidebar has no Realmless destination.

## Next

1. Have the owner look at the sidebar in the running app (`bun run dev`), dark and light, in Iskios and in Gild (Workshop, Theme); adjust size, tone, or a drawing if they ask.
2. If the owner accepts the look, nothing remains for this thread. The rest of the Gild work (colors, Dock icon, screens not opened) stays in the thread of `2026-11-11-2154-gild-theme-icons-matte.md`.

## Open questions

- Whether the drawings read well at the bar's size, and whether the ivory is too warm on Iskios's navy or right on Gild's brown; the owner answers by looking.
- Whether the Realmless sparkles drawing should be kept for a future screen; it is unused today.

## Sources

- `documentation/changelog.md` (CHG-0207) and `documentation/verification/2026-11-12-sidebar-flat-icons.md` with its screenshots.
- `apps/app/src/shell/navIcons.tsx`, `apps/app/assets/nav/`, `apps/app/src/shell/sidebar.tsx`.
- The owner's source folder `[redacted]` (`ivory/`, `slate-blue/`, `README.md`): 13 drawings at 256 px, raster, not SVG.
- The forked thread: `.agents/handoffs/2026-11-11-2154-gild-theme-icons-matte.md`.
