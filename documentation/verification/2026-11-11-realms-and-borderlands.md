# Verification: only Realms and Borderlands, sidebar hover marks, widths, nested full list

- **Verdict:** partly proven. Each claim below was observed in the web export on the fake harness; the look awaits the owner's judgment. The Electron window was not driven.
- **Environment:** macOS, Expo web export served on localhost:8123, Playwright (Python) with Chromium, a throwaway service on the fake harness run with `node` (data in `/tmp/iskios-cl/data`, never the owner's): a realm Atlas tied to a folder, a realm Ideas tied to none, and Borderlands quests, one with side-quests two levels deep ([`serve.ts.txt`](2026-11-11-realms-and-borderlands/serve.ts.txt)). Drivers: [`drive.py`](2026-11-11-realms-and-borderlands/drive.py), [`hover.py`](2026-11-11-realms-and-borderlands/hover.py), [`drag.py`](2026-11-11-realms-and-borderlands/drag.py), [`measure.py`](2026-11-11-realms-and-borderlands/measure.py), [`cue.py`](2026-11-11-realms-and-borderlands/cue.py). The sidebar was set to its minimum width for the hover runs.

| Claim | Check | Result |
| --- | --- | --- |
| Sidebar order Guild Hall, Realms, Borderlands, Rituals, Craft, The Keep, Reserves, Charter, Workshop; no Realmless or Free Realms | [dark rest](2026-11-11-realms-and-borderlands/dark-01-rest.png), [light rest](2026-11-11-realms-and-borderlands/light-01-rest.png) | observed |
| At rest no fold arrow or action button shows; the scroll shows after Atlas only, with title "Tied to <path>"; Ideas has none | rest screenshots, `cue.py` output | observed |
| Pointer at the far right of the Realms, Borderlands, The Keep headings and of the Atlas row reveals the arrow and buttons (opacity 1) | `hover.py` output, [Realms](2026-11-11-realms-and-borderlands/dark-10-far-right-hover-realms.png), [Keep](2026-11-11-realms-and-borderlands/dark-10-far-right-hover-keep.png), [Borderlands](2026-11-11-realms-and-borderlands/light-10-far-right-hover-borderlands.png), [Atlas](2026-11-11-realms-and-borderlands/light-10-far-right-hover-atlas.png) | observed |
| After clicking the Realms heading and moving the pointer away, nothing shows; a Tab onto it shows the arrow, "+", and the focus ring | [dark](2026-11-11-realms-and-borderlands/dark-11-after-click-away.png), [light](2026-11-11-realms-and-borderlands/light-11-after-click-away.png), [Tab](2026-11-11-realms-and-borderlands/light-12-tab-focus-realms.png) | observed |
| The bow arrow points down when open and right when folded, right after the title | [open, hovered](2026-11-11-realms-and-borderlands/dark-02-hover-borderlands.png), [folded, hovered](2026-11-11-realms-and-borderlands/dark-05-collapsed-hover-borderlands.png), [folded, rest](2026-11-11-realms-and-borderlands/light-04-collapsed-rest.png) | observed |
| At the 284 px minimum no heading title overflows with its marks shown (scrollWidth equals clientWidth for Realms, Borderlands, The Keep); at the former 236 px the Borderlands heading overflowed by 32 px | `drive.py` and `measure.py` output | observed |
| Dragging the rail as far right as possible stops at a quarter of the window (320 at 1280, 500 at 2000) and as far left at 284; after shrinking a 2000 window to 1400 the rail is 350 | `drag.py` output, [1280](2026-11-11-realms-and-borderlands/drag-1280-widest.png), [2000](2026-11-11-realms-and-borderlands/drag-2000-widest.png) | observed |
| "Show all 4 quests" in the Borderlands opens the full list with side-quests nested and indented, each with harness, model, and time | [dark](2026-11-11-realms-and-borderlands/dark-07-borderlands-list.png), [light](2026-11-11-realms-and-borderlands/light-07-borderlands-list.png) | observed |
| The Guild Hall no longer names Ideas as the next quest's realm when no realm is chosen | [1280](2026-11-11-realms-and-borderlands/drag-1280-widest.png) | observed after the fix |
| Creating a realm with or without a folder from the menu; the realm panel's lore link and rename for a realm with no folder; folding quest and side-quest rows by their hover arrow | not driven | unproven (service tests cover creation and renaming) |
| The look | screenshots above | awaiting the owner |

Regressions: typecheck and Biome pass; the full suite has 3 failures outside this change (see CHG-0164). Cleaned up: the scratch service and web server were stopped and `packages/service/serve-cl.ts` removed.

## Follow-up (CHG-0170, CHG-0171): folder icon, realm grouping, hover-only counts, whole-row hover, even spacing

Re-run on the tree after `eaacc55` (web export, same throwaway service; screenshots above replaced).

| Claim | Check | Result |
| --- | --- | --- |
| Folder icon after Atlas only, path as title; realms tied to a folder above a hairline, then Ideas | [dark](2026-11-11-realms-and-borderlands/dark-01-rest.png), [light](2026-11-11-realms-and-borderlands/light-01-rest.png), `cue.py` | observed |
| Counts hidden at rest, shown with the marks on hover | [rest](2026-11-11-realms-and-borderlands/dark-01-rest.png), [hover](2026-11-11-realms-and-borderlands/light-03-hover-realm-row.png) | observed |
| Whole-row hover: name, blank middle, count, hidden buttons, extreme right of Atlas, Ideas, Realms, Borderlands, from outside and by sweeping | [`rowhover.py`](2026-11-11-realms-and-borderlands/rowhover.py): FAIL before the fix (buttons area of Atlas and Ideas, count and buttons of Borderlands, middle and buttons of Realms), PASS after at default, minimum, and 360 px widths | observed |
| Same in a throwaway Electron window on the Expo dev server | [`rowhover.py`](2026-11-11-realms-and-borderlands/rowhover.py) via CDP, 3 runs: 2 PASS, 1 FAIL (Atlas middle and buttons); the dev window logs repeated "Maximum update depth exceeded" from `useServiceQuery`, also seen with the app of `10684a9` | inconclusive |
| Even spacing: folded headings 37 px apart in every block, labels at x 50 | [`spacing.py`](2026-11-11-realms-and-borderlands/spacing.py), [dark](2026-11-11-realms-and-borderlands/dark-40-spacing-folded.png), [light](2026-11-11-realms-and-borderlands/light-40-spacing-folded.png) | observed |
| Click then pointer away hides the marks; Tab shows them; no heading overflow at 284 px; rail 284 to a quarter | `hover.py`, `drive.py`, `measure.py`, `drag.py` | observed |
