# Proof: computer name, Workshop Companions, column rules (CHG-0257)

- **Verdict:** not proven overall. 11 claims proven or observed, 1 unproven (C9), the appearance of every changed screen awaits the owner's look.
- **Work:** `163667a`..working tree on `163667a` (uncommitted; the owner's requests came during the session, so the work grew from one batch to seven rounds).
- **Agreement:** the owner's requests in the session, recorded in CHG-0257 ([changelog](../changelog.md)); the [provider-accounts](../capabilities/provider-accounts/specifications.md), [mission-tracking](../capabilities/mission-tracking/specifications.md) and [device-pairing](../capabilities/device-pairing/specifications.md) specifications, edited in the same change.
- **Environment:** macOS (Darwin 27.2.0), bun 1.4.4, Electron 45, vitest 5.1. Windows: a throwaway Electron started with `ISKIOS_HARNESS=fake`, its own data folder, the web export served on `localhost:8099` (`bunx expo export --platform web`), driven over the DevTools protocol by [scripts/cdp.ts](2026-11-13-computer-name-and-companions/scripts/cdp.ts); the plan-limit reading was seeded in the data folder's `plan_limits` table. The window shows "fake" as the harness version because the fake harness has no real CLI.
- **Date:** 2026-11-13

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The computer's own sign-in is named after the host (the machine's name until renamed) in Accounts, a thread's header, budgets, and follows a rename | owner, "rename This computer" | proven |
| C2 | The Usage page's account rows name the computer's own sign-in with that name | same | proven (service) |
| C3 | A Computer name card, first in Providers, renames it; every label and the top bar follow at once; the field left Remote access | same | observed in the window |
| C4 | The plan-limit rings draw without React's `transform-origin` error, as before | the owner's console log | proven |
| C5 | A new quest always starts on the default Companion (and the computer's own sign-in); only the folder is remembered | owner, "default model should always be chosen" | proven |
| C6 | The Workshop shows only the chosen section; sections are Permissions, Look and feel, Providers, Companions, Remote access, Messaging, Limits; the menu is titled Workshop | owner | observed in the window |
| C7 | The Companions section has Default and Presets cards, each Companion a table with a chevron column; the tab beside it has Default and Presets tabs and Light, Balanced, Heavy under Presets; a quest's or Iskios's tab has none | owner | observed in the window |
| C8 | The page's marked chevron is the Companion the tab shows, whichever tab is chosen; pressing the marked one closes the tab | owner | observed in the window |
| C9 | The retired Guild Hall setting is gone and an old saved row is read and rewritten without it | owner | unproven |
| C10 | The right-hand column and its handle exist only with a quest panel, on the Companions section, or while Iskios is open (Iskios's Companion alone elsewhere); closing Iskios closes the column | owner | proven (rule) and observed in the window |
| C11 | The quest panel's Harness row, and the Default and preset tables, show the provider's logo | owner | observed in the window |
| C12 | The Companions tab's rows are 14 px apart, equal to the gap under the column's tab | owner | observed (measured) |
| C13 | Appearance of all of the above | owner | awaiting human judgment |

## Evidence

### C1, C2: the label of the computer's own sign-in

- **Check:** `ELECTRON_RUN_AS_NODE=1 bunx electron node_modules/vitest/vitest.mjs run packages/service/test/harness/harnesses.test.ts packages/service/test/work/usageReport.test.ts apps/app/test/shell/usageLabels.test.ts`. New or changed tests: "names the computer's own sign-in after the host, and follows a rename" (renames to "Studio", lists harnesses, renames to blank and sees the machine's name), the account rows of `usageReport.test.ts`, the Usage label test.
- **Shown able to fail:** before and after. The three files copied onto the starting commit in a separate worktree fail there (`expected { detail: 'owner', … } to match object { id: null, label: 'Studio' }`, `expected null to be 'GXGJC64JLX'`, `Claude Code · This computer`), and pass on the working tree.
- **Result:** pass on the working tree. In the window, after renaming to "Studio" the three Accounts rows read "Studio", the Allowances read "Claude Code · Studio", the host menu reads "Studio" ([screen](2026-11-13-computer-name-and-companions/screens/05-renamed.png)).
- **Reproduced:** see Reproduction.

### C3: the Computer name card

- **Check:** [scripts/main3.ts](2026-11-13-computer-name-and-companions/scripts/main3.ts) (Workshop, the card, typing, Rename); [scripts/sections.ts](2026-11-13-computer-name-and-companions/scripts/sections.ts).
- **Shown able to fail:** before and after: the starting commit has no "Computer name" string anywhere under `apps/app/src` (grep returned nothing) and its Remote access card held "This host's name"; the window check printed `hostname field left Remote access: true` and the card's text.
- **Result:** [04](2026-11-13-computer-name-and-companions/screens/04-computer-name-card.png), [05](2026-11-13-computer-name-and-companions/screens/05-renamed.png), [18 Providers](2026-11-13-computer-name-and-companions/screens/18-providers.png).

### C4: the plan-limit rings

- **Check:** a window on the starting commit's dev server (Metro, port 8082, from a separate worktree) and one on the working tree's (8081 then a fresh export); [scripts/warn.ts](2026-11-13-computer-name-and-companions/scripts/warn.ts) reloads and reads the console and the circles' attributes.
- **Shown able to fail:** it did fail on the starting commit: console `Invalid DOM property transform-origin. Did you mean transformOrigin?` twice, circles `transform="rotate(-90)" transform-origin="22  22"`. On the working tree: no such message, circles `transform="rotate(-90 22 22)"` and no `transform-origin`.
- **Result:** the nested-button errors of the sidebar (`<button>` in `<button>`, `sidebar.tsx:335` and `:358`) are in both runs and were there before this work.

### C5: a new quest starts on the default Companion

- **Check:** `packages/service/test/work/dashboard.test.ts` "offers the default Companion always, and the last mission's workspace" (a mission started on Haiku with high effort; the next start still offers the defaults; changing the defaults changes it; the folder stays), and `harnesses.test.ts` (an added account's quest does not carry its account to the next).
- **Shown able to fail:** before and after on the starting commit in a separate worktree: both fail there (the offer read `haiku`/`high` and the account).
- **Result:** pass on the working tree.

### C6, C7, C8, C11, C12: the Workshop in the window

- **Check:** [scripts/sections.ts](2026-11-13-computer-name-and-companions/scripts/sections.ts) (each menu item, which cards are present), [scripts/tabs.ts](2026-11-13-computer-name-and-companions/scripts/tabs.ts), [tabs2.ts](2026-11-13-computer-name-and-companions/scripts/tabs2.ts), [tabs3.ts](2026-11-13-computer-name-and-companions/scripts/tabs3.ts) (the tab's tabs, setting a preset from the tab, a quest's tab), [mark.ts](2026-11-13-computer-name-and-companions/scripts/mark.ts) (the marked chevron), [gaps.ts](2026-11-13-computer-name-and-companions/scripts/gaps.ts) (rectangles of the tabs).
- **Shown able to fail:** before and after for the structure: the starting commit has one scrolling page with "Defaults", "Harnesses", "Accounts" in its menu and no table or tab sub-tabs. The marked chevron check printed `[false,false,false,false]` with the tab closed, then `[false,false,false,true]` after pressing Heavy, `[true,false,false,false]` after the tab's Default, `[false,false,false,true]` after Presets, `[false,false,true,false]` after Balanced, all false after pressing Balanced again; a first version of the page marked the pressed table whatever the tab showed, which the owner caught.
- **Result:** sections: only the chosen section's cards were found (Providers: Computer name, Harnesses, Accounts; Companions: Default, Presets). Tab tabs with the Workshop's pills: `["Companions","Default","Presets"]`, then `["Companions","Default","Presets","Light","Balanced","Heavy"]`; with a quest open, `["Quest","Companions"]` and no Default or Presets. Gaps: Companions to Default 14, Default to Light 14. Screens: [19](2026-11-13-computer-name-and-companions/screens/19-companions.png), [22](2026-11-13-computer-name-and-companions/screens/22-tab-default.png), [29](2026-11-13-computer-name-and-companions/screens/29-heavy-marked.png), [30](2026-11-13-computer-name-and-companions/screens/30-balanced-marked.png), [10 quest panel with the logo](2026-11-13-computer-name-and-companions/screens/10-quest-tab.png).

### C9: the retired Guild Hall setting

- **Check:** `packages/service/test/defaultBackups.test.ts` "settings saved before the Guild Hall became always shown".
- **Shown able to fail:** not shown. On the starting commit, with the contracts of that commit, the test passed as well, although its schema still holds the key; the key was missing from the service's answer there for a reason I did not find. Until that is understood the test proves nothing about the retirement.
- **Result:** the working tree passes; the Guild Hall entry is always in the sidebar (every window run) and the toggle text is absent (`toggle gone: true`).

### C10: the column's rules

- **Check:** unit test `companionScope.test.ts` "offers Iskios's Companion only while Iskios is open…" and [scripts/column.ts](2026-11-13-computer-name-and-companions/scripts/column.ts) (handle label and tabs in seven states).
- **Shown able to fail:** the unit test fails on the starting commit (no `isCompanionOffered`). Window states on the working tree: Guild Hall with Iskios closed: no handle; Workshop Permissions: none; Companions: handle, then tabs Companions, Default, Presets; Providers: none; Iskios opened on Providers: handle, then the tab "✦ Companions"; Iskios closed: no handle, no column. The first version kept the column open after leaving the section; the final one closes it and does not reopen it.
- **Result:** [32](2026-11-13-computer-name-and-companions/screens/32-companions-column.png), [33](2026-11-13-computer-name-and-companions/screens/33-iskios-column.png), [34](2026-11-13-computer-name-and-companions/screens/34-iskios-closed.png).

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Lint | `bunx biome check .` | not run | pass |
| Typecheck | `bun run typecheck` | not run | pass (6 workspaces) |
| Tests | `bun run test` | not run | 1364 passed, 14 skipped, 119 files |

The 1364 passed after the last round of code changes except the label "Look and feel" (a string); the previous full run before the column rules passed 1368, the difference being the deleted scroll-marking test and the changed sections.

## Not proven

- C9 (see above): the test cannot be shown to fail.
- C13: appearance of the Workshop sections, the Default and Presets tables, the tab's tabs and spacing, the logo in the Harness rows. Screens are in the folder.
- Not checked at all: a narrow window (the Workshop breaks there with the column open; left for a later session, [backlog](../backlog.md)), the light and Gild looks of the new cards, a paired device viewing a host's Workshop and its Computer name, the phone build, the packaged app.
- The window runs used the fake harness: a real harness's version and plan limits were not seen in my window (the owner's own screenshot shows "Claude Code · 2.1.323").
- The Presets have no backups yet; the preset table has Harness and Model only.

## Reproduce

```sh
# headless, from the working tree
bunx biome check . && bun run typecheck && bun run test
# the claims' tests on the starting commit (expect failures for C1, C2, C5, C10)
git worktree add --detach /tmp/base 163667a    # then copy the changed test files over it and run vitest
# the window: export, serve, launch, drive
cd apps/app && bunx expo export --platform web --output-dir /tmp/web && (cd /tmp/web && python3 -m http.server 8099 &)
cd apps/desktop && bun run build && ISKIOS_DATA_DIR=/tmp/data ISKIOS_HARNESS=fake ISKIOS_APP_URL=http://localhost:8099 $(bun -e 'console.log(require("electron"))') --remote-debugging-port=9349 dist/main.js &
bun documentation/verification/2026-11-13-computer-name-and-companions/scripts/cdp.ts 9349 $PWD/documentation/verification/2026-11-13-computer-name-and-companions/scripts/sections.ts
```

The scripts print and screenshot to `/tmp/iskios-verify/shots/`; they assume a quest named "Hello fake" exists for `tabs2.ts` and `tabs3.ts` (made with `quest2.ts`) and a seeded `plan_limits` row for `warn.ts`.

## Reproduction

Not done by a fresh-context agent: the owner interrupted the session repeatedly with new requests, and I reran the window scripts myself from a clean shell several times on separate exports (the rename and card flow twice, the tab and column flows three times) with matching results. A fresh reproduction is still to do.

## New files

`documentation/verification/2026-11-13-computer-name-and-companions/` (screens and the driving scripts), this file, the tests named above (changed `harnesses.test.ts`, `dashboard.test.ts`, `usageReport.test.ts`, `usageLabels.test.ts`, `companionScope.test.ts`, `defaultBackups.test.ts`; deleted `settingsSections.test.ts`), and `"!documentation/verification"` in `biome.json` so the scripts are not linted.
