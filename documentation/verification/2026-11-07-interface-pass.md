# Proof: first interface pass, after the look of OpenBot

- **Verdict:** behavior unchanged and every screen renders in the new look; the look itself awaits the owner's judgment. The owner has neither agreed nor accepted the pass.
- **Work:** working tree on `d42d7fd`, committed after this proof.
- **Agreement:** the owner's instruction of 2026-11-07: "Let's work a bit on the UI. Look at how OpenBot looks like and try to get something close to that if possible. I'll be AFK so don't ask any question for now."
- **Source of the look:** OpenBot's installed renderer stylesheet (`/Applications/OpenBot.app`, `app.asar`, `out/renderer/assets/styles-*.css`) was read for its light theme tokens only: neutral greys (frame `#f5f5f6`, controls `#e8e8eb`/`#f0f0f2`, text `#141414`/`#6b6b70`), one blue accent `#007cf7`, soft tinted states, radii 6/8/12/16, 12–18 px type on the system font. No OpenBot code or markup was copied (PolyForm Noncommercial; ideas only, [0001](../architecture-decision-record/0001-new-codebase-not-a-fork.md)); the values are written as OpenMission's own palette in `apps/app/src/theme.ts`.
- **Environment:** macOS 26, Metro `BROWSER=none bunx expo start --port 8086` in `apps/app` (watch mode; `CI=1` disables reloads); Electron `env -i HOME PATH USER TMPDIR LANG OPENMISSION_HARNESS=fake OPENMISSION_DATA_DIR=/tmp/om-ui/data OPENMISSION_APP_URL=http://localhost:8086 bunx electron dist/main.js --remote-debugging-port=9351` in `apps/desktop`; `playwright-cli attach --cdp=http://localhost:9351`.
- **Date:** 2026-11-07

## What changed

| Area | Before | After |
| --- | --- | --- |
| Window | One grey screen, links in each header | Sidebar on a grey frame (name, New mission, Missions, Intel, Archived, every mission not archived with a state dot and an attention dot, Settings) beside a raised white panel; below 820 points wide, the content alone with the screens' own links |
| Palette | Tailwind-like greys, dark badges, amber focus | `theme.ts`: neutral greys, blue accent, soft tinted state pills with a dot |
| Composer | Text box, Send below it | One rounded box with the text, pickers at the bottom left, and a round Send |
| Mission start | Model and effort as two rows of chips | Model and effort as compact pickers inside the composer (`Menu` in `controls.tsx`) |
| Mission rows | Title and meta on one line, actions on a second bordered line | Title over a muted meta line; budget, state, and actions on the right |
| Messages | Bordered bubbles labelled "You" and "Agent" | The owner's messages in grey bubbles without a label (a queued one says so); agent replies as plain text |
| Switches | Teal | Accent blue (`Toggle` in `controls.tsx`) |
| Button rows | The list `row` style, with a bottom border, inside cards | A borderless `inlineRow` |

## Evidence

| Screen | Before | After |
| --- | --- | --- |
| Dashboard | [before-dashboard](2026-11-07-interface-pass/before-dashboard.png), [before-conv](2026-11-07-interface-pass/before-conv.png) | [after-dashboard-2](2026-11-07-interface-pass/after-dashboard-2.png), effort picker open: [after-menu](2026-11-07-interface-pass/after-menu.png) |
| Thread | [before-thread](2026-11-07-interface-pass/before-thread.png) | [after-thread-2](2026-11-07-interface-pass/after-thread-2.png) |
| Intel, Settings, Journal, Budget | — | [after-intel](2026-11-07-interface-pass/after-intel.png), [after-settings-2](2026-11-07-interface-pass/after-settings-2.png), [after-journal](2026-11-07-interface-pass/after-journal.png), [after-budget](2026-11-07-interface-pass/after-budget.png) |
| Choosing the open mission again in the sidebar returns to its threads | — | [after-reselect](2026-11-07-interface-pass/after-reselect.png) (from its journal) |
| Narrow window (640 points) | — | [after-narrow](2026-11-07-interface-pass/after-narrow.png) |

Drive: two missions started from the dashboard, a message sent in one (the fake harness echoes it); the effort picker set to `high` read back as `high` on its button; each sidebar place opened its screen.

**Drive note:** `playwright-cli click` timed out on the pickers and sidebar items (the locator resolved but never became actionable), as batch 17's proof noted for the dashboard's Send; a DOM `click()` through `playwright-cli eval` worked. Not investigated.

## Regressions

`bun run check`, `bun run typecheck`, `git diff --check`, `bun run test` (311 passed, 5 skipped), and `CI=1 bunx expo export --platform web` passed. Rerun just before the commit: the same results.

## Not verified

- On iOS or Android: the pickers' open list and the panel's shadow were seen on the web build only.
- Hover states: the sidebar shows pressed feedback only, since the native `Pressable` types declare no hover.
- No fresh-context agent reran this proof.
