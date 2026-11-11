# Handoff: Gild theme beside Iskios

Supersedes: `2026-11-11-2152-gild-theme.md`
Workspace: ISKIOS, worktree `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS-gild-theme`, branch `worktree/gild-theme` (from `5fbfc4c`; original checkout `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`, branch `main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Give the app two themes, Iskios (the existing look) and Gild (the guild's browns and gilt, from the owner's Guild Hall image), each with a dark and a light look, with Gild's own sidebar icons and the Dock and window icon following the theme. Done means the owner has seen Gild across the app and accepted its colors and icons.

## State

- Verified now (git log): the work is two commits on `worktree/gild-theme`, rebased onto `main` at `7ae677f` (the mention-menu work, which took CHG-0181 and CHG-0182, so this work is CHG-0183), then synced to `main`. Check `git log main` for the landed commits.
- Owner feedback after seeing the icons: the Gild sidebar icons are "too much"; a more matte look may be better, as a separate rework. Recorded in `documentation/backlog.md` and `documentation/work-in-progress.md`.
- Verified earlier in the session (command output, not rerun for this file): `bun run typecheck` passes in all four workspaces; `bun run check` (Biome) passes; `ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run apps --testTimeout=60000 --maxWorkers=3` gives 27 files, 230 passed, 4 skipped. The service package's tests were not run.
- Verified by file read: `foundation/palettes.ts` holds the four palettes (`palettes[theme][scheme]`) under the same token names; `foundation/themeRules.ts` is pure (theme names, `themeOf`); `foundation/colorScheme.ts` exports `theme` (read once at load from local storage `iskios.theme`, Iskios by default) and `chooseTheme`, which reloads the window; `foundation/theme.ts` exports `colors` for the theme and look in use; `shell/navIcons.tsx` picks the icon set by theme and look; the Workshop has a Theme card above Appearance.
- Verified by file read: the Dock and window icon follow the theme: the app calls `window.iskios.setTheme(theme)` at load; the desktop process handles `iskios:setTheme` (only from its own window) and sets `app.dock` and the window icon from `apps/desktop/assets/icon-gild.png` or `icon.png` (`desktop/src/appIcon.ts`); `electron-builder.yml` packages both files.
- Verified by file read and by looking: the Gild sidebar icons (`apps/app/assets/nav/gild/` gilt, `gild-light/` bronze) are Iskios's icons recolored with a luminance-to-color gradient map (alpha kept), so they are temporary. `icon-gild.png` is the owner's glowing hooded figure, cropped to its rounded square and scaled to 876 px centered on a 1024 px canvas, as Iskios's icon is.
- Observed in a throwaway Electron window on the web export (data under `/tmp`, now stopped): Guild Hall in Gild dark, Gild light, and Iskios dark; Workshop in Gild dark; the Theme control switching to Iskios and back, each reloading with the choice kept; `setTheme` resolved without error. Screens: `documentation/verification/2026-11-11-gild-theme/`.
- Not seen: the Dock icon itself; the conversation, quest panel, Lore, crest, terminal, Library, and modal screens in Gild; the packaged app; the owner's look.
- Assumed: the choice is per browser profile, as the look is, so native builds keep no choice yet.

## Decisions

- Gild's dark look takes colors only from the owner's image; its cream cards are not reproduced because a surface's text color is one token for every surface. Gild's light look is the former guild board's parchment, leather ink, and gilt (palette from `2a75c4e^:apps/app/src/foundation/theme.ts`), accent deepened for contrast. Recorded in CHG-0183 in `documentation/changelog.md`.
- The Gild icon recolorings stay as provisional until the matte rework; the rework is its own batch, not part of CHG-0183.
- Gild changes colors, icons, and the app icon only; typefaces (Cinzel, Alegreya), banners, and illustrations of the former look are not brought back.
- The installed `.app` file's icon stays Iskios's: a bundle's icon cannot change at run time. The app shows no brand mark inside, so none changed.
- Palette tests hold only Gild to contrast thresholds for the dimmer text, accent, and accent button; Iskios's colors are unchanged and its light look misses 4.5 for the dimmer text.

## Next

1. Have the owner look at Gild in the running app (`bun run dev` in the worktree, then Workshop, Theme) and say what to adjust in `foundation/palettes.ts`.
2. Open the screens not yet seen in Gild and fix any that read badly: conversation, quest panel and board, Lore, crest studio, terminal, modals, Rituals editor.
3. Rework the Gild sidebar icons toward a more matte look (backlog entry "Gild sidebar icons, matte rework"), with a light twin of each, or replace them with icons the owner supplies; the current ones are glossy recolorings by a luminance gradient map.
4. Look at the Dock icon change in the running desktop window.

## Open questions

- Should Gild's dark look have cream cards like the image? That needs surface-specific text colors, a larger change; the owner decides.
- Should the theme choice live in the service's settings so it follows the owner across the desktop window and the phone web app?

## Sources

- `documentation/changelog.md` (CHG-0183), `documentation/work-in-progress.md`, and `documentation/backlog.md` (matte icon rework).
- Superseded handoff: `.agents/handoffs/2026-11-11-2152-gild-theme.md`.
- `documentation/verification/2026-11-11-gild-theme/` (screens).
- `apps/app/src/foundation/palettes.ts`, `themeRules.ts`, `colorScheme.ts`, `theme.ts`; `apps/app/src/shell/navIcons.tsx`; `apps/desktop/src/main.ts`, `appIcon.ts`.
- Tests: `apps/app/test/foundation/palettes.test.ts`, `themeRules.test.ts`; `apps/desktop/test/appIcon.test.ts`.
- Earlier look and light mode: `.agents/handoffs/2026-11-11-1523-light-mode.md`.
