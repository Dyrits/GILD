# Handoff: renamed to Gild, with the owner's logo

Supersedes: `2026-11-08-1640-art-direction-options.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/CANOPY (folder name unchanged), branch `main`, remote `git@github.com:Dyrits/GILD.git`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked: "We'll do another rebranding. We'll rename the solution 'Gild' instead of Canopy. Use this logo for now." Done means the product, code, living documents, GitHub repository, and the owner's data carry the name Gild, and the app icons and sidebar carry the owner's gold G. It is done except the owner's real install moving on its next launch and the owner's judgment of the look.

## State

- **Verified by command output:** `bun run test` passed 414 with 10 skipped; `bun run typecheck`, `bun run check`, `git diff --check`, and the desktop build (`apps/desktop`, `bun run build`) passed.
- **Verified:** `documentation/verification/2026-11-09-gild-rename/leftovers.sh` reports 0 brand uses of "Canopy" in living files (371 on `e24a66d`).
- **Verified:** the probe moved a copy of the owner's install (11 missions) into a `Gild` profile folder that already existed, kept the profile's own file, renamed `canopy.sqlite` to `gild.sqlite`, renamed a Claude Code session folder, and the built service on the fake harness listed all 11 ([proof](documentation/verification/2026-11-09-gild-rename.md)).
- **Verified:** the window was driven on the fake harness with Metro on 8097 and a throwaway data folder: title Gild, the keyed-out gold G and name in the sidebar, the gilt empty board, and the mission panel's arch (`documentation/verification/2026-11-09-gild-rename/window-control.png`, `window-mission.png`).
- **Verified:** the GitHub repository is `Dyrits/GILD` (renamed with the owner's own `gh` sign-in, `GH_CONFIG_DIR=$HOME/.config/gh`); `origin` follows it and `git ls-remote` answers.
- **Not verified:** the owner's real install moving: their app was running throughout, so `~/Library/Application Support/Canopy/canopy.sqlite` (11 missions) is untouched. Quit the running window and run `bun run dev`; the migration runs on that launch.
- **Not verified:** the dock icon, native Android/iOS builds, the owner's look.
- The running dev window from before the rename still shows Canopy until it is restarted; it is not the new build.
- The UI drive made an empty Electron profile at the real `~/Library/Application Support/Gild` path; it held no database and was removed, so the migration still finds no `gild.sqlite` and runs.
- Local folder is still `CANOPY`; renaming it would break open sessions and tool indexes (`~/.claude/projects` names follow the data folder, not the repository).
- The rename and this handoff are committed to `main` locally with the commit that adds this file; not pushed (the pre-push hook refuses `main`).

## Decisions

- Full rename, following CHG-0061: app, window, sidebar, Expo `name`/`slug`, packages, `GILD_*` variables, `window.gild`, `gild:*` channels, service keys, temp prefixes, `gild.sqlite`, and `mcp__gild__…`. The domain terms stay (mission, thread, Control, journal, briefing, dashboard, intel); words meaning "open a mission" keep their names.
- Dated records (handoffs, verification, earlier changelog records, architecture decisions, audits, art-direction boards) keep the name they were written with; living documents use Gild.
- The logo is the owner's image, "for now": used as the app icons, and keyed out of its navy background for the sidebar. The Sketchbook palette is not changed; its highlighter is already gold.
- The drawn canopy logo is replaced by the image; the mission panel keeps its arch (`PanelArch`), and the empty board becomes an empty gilt frame (`EmptyBoard`, "No missions here yet.").
- The migration now merges into an existing profile folder that has no `gild.sqlite`, because Electron makes `Gild` before the move; it stops once a database is there.
- The repository follows the owner's uppercase naming (`GILD`), as `CANOPY` did.

## Next

1. Quit the running window, run `bun run dev`, and check the title, sidebar, and the 11 existing missions; send one message in a thread with no workspace to check its Claude Code session resumes.
2. Push the rebrand commit to `main` with the owner's approval (`git push --no-verify`, since the pre-push hook refuses `main`).
3. The owner accepts the look and the logo or asks for changes. Then the art-direction options (D to J) still await a choice, and the sidebar/mockup items in the superseded handoff stand.

## Open questions

- Should the local folder be renamed `CANOPY` → `GILD`? The owner decides; tool state keyed by path would follow.
- Is this logo final or a placeholder? Its gradient sits apart from the Sketchbook ink; a redraw or a palette shift would follow a decision.
- Native icons are untested; should the owner try an Android/iOS build before deciding?

## Sources

- `documentation/changelog.md` (CHG-0072)
- `documentation/verification/2026-11-09-gild-rename.md` and its folder
- `documentation/brand/README.md` and `gild-logo-2026-11-09.png`
- `apps/desktop/src/formerData.ts`, `apps/desktop/src/main.ts`, `apps/desktop/test/formerData.test.ts`
- `apps/app/src/sketches.tsx`, `apps/app/src/sidebar.tsx`, `apps/app/app.json`, `apps/app/assets/`, `apps/desktop/assets/icon.png`
- https://github.com/Dyrits/GILD
