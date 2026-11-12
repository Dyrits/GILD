# Verification: sidebar flat matte icons (CHG-0207)

Scope: the owner's `guildmaster-flat-matte-icons` replacing the sidebar's icon sets, shared by both themes. Starting revision `ef103f9`.

## Recorded results

- Assets: the 12 sidebar drawings were taken from the owner's folder, each 256 px source cropped to its drawing, kept its aspect, and fitted into a 192 px transparent square, one set per look: `apps/app/assets/nav/dark/` (ivory) and `apps/app/assets/nav/light/` (slate blue). The Borderlands keep the `free-realms.png` name, as the sets before them did. The supplied Realmless drawing is unused by the sidebar and was not added; the former unused `realmless.png` files are gone with the replaced sets.
- `bun run typecheck` passes in all six workspaces; `bun run check` (Biome) passes.
- `npx expo export --platform web` bundles the 24 icons into the app; the export lists `assets/nav/dark/*.png` and `assets/nav/light/*.png`.
- Driven in a throwaway Electron 45 window (own data folder, the web export on localhost:8099, fake harness), with the theme and look set in the window's storage and each change reloaded: the sidebar's destinations show the new drawings in all four combinations. The data folder was empty, so the sidebar's own rows were the Guild Hall, the Realms and Borderlands headings, Rituals, Craft, The Keep's three rooms, Reserves, Charter, and Workshop.

| Claim | Check | Result |
| --- | --- | --- |
| Dark looks use the ivory drawings | [Iskios dark](2026-11-12-sidebar-flat-icons/dark-iskios.png), [Gild dark](2026-11-12-sidebar-flat-icons/dark-gild.png) | observed |
| Light looks use the slate blue drawings | [Iskios light](2026-11-12-sidebar-flat-icons/light-iskios.png), [Gild light](2026-11-12-sidebar-flat-icons/light-gild.png) | observed |
| The icon module now picks by look only, so both themes share the two sets | `apps/app/src/shell/navIcons.tsx` | read |
| Every drawing stays legible and aligned at the bar's 22 px and 28 px sizes | the four screenshots | observed |

Reproduce: export the app with `bunx expo export --platform web --output-dir <folder>` from `apps/app`, serve that folder on 8099, build the desktop app with `bun run build` in `apps/desktop`, then run `ISKIOS_DATA_DIR=<folder> ISKIOS_HARNESS=fake ISKIOS_APP_URL=http://localhost:8099 electron --remote-debugging-port=9347 dist/main.js` and drive it over the DevTools protocol (set `iskios.theme` and `iskios.colorScheme` in local storage, reload, screenshot).

## Not verified

- The owner's look at the drawings, their color, and their size in the bar.
- A sidebar filled with quests, realms, and side-quests: the window ran on an empty data folder, so only the destination rows appeared. The fold arrows, hover buttons, state dots, counts, and the collapsed rail were not exercised and are unchanged.
- A phone build; the packaged app.

## Limits of this evidence

The screenshots prove the drawings load from the new paths and keep their contrast on all four backgrounds. They do not prove how the icons read at another scale or on a non-Retina screen.
