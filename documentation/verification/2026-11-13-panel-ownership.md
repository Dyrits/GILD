# Right-hand panel ownership

Starting revision: `6eed7ee5a39a593a242b9953870fb4320166a39f`.
Agreement: CHG-0262 and [panel ownership across navigation](../capabilities/thread-panel/specifications.md#panel-ownership-across-navigation).

## Reproduction

Before changing production code, ran:

```sh
bun documentation/verification/2026-11-13-computer-name-and-companions/scripts/cdp.ts \
  9363 "$PWD/documentation/verification/2026-11-13-panel-ownership/drive.ts"
```

The check opened Iskios, opened the Workshop's default Companion picker, then chose Permissions. It failed on the reported symptom:

```text
AssertionError: Workshop picker carries into Permissions while Iskios is open
true !== false
```

The old shell kept `isCompanionOnly` after the page's picker unmounted and substituted the best remaining picker, Iskios's. Its cleanup required there to be no picker at all, so an open Iskios prevented that cleanup. Quest details had a separate app-wide open flag, initially true at widths of 1280px or more.

## Change

`foundation/panelState.ts` and `useRightPanel.ts` own one column selection: closed, details, or the selected Companion with its owner. A destination change clears page-owned state during render; only an Iskios selection on the same host survives. Destination identity includes page, open quest and thread, quest reopening, realm, Workshop section, and the Workshop's Permissions subpage. Explicitly selecting a quest preview still opens that preview.

`shell/useCompanionDock.ts` registers mounted Companion buttons and draws their current picker values. A disappearing page picker cannot substitute Iskios. Iskios's own selection can reconnect to its remounted button after expansion/restoration. Closing Iskios clears that selection. A host change closes it rather than selecting a different host's Iskios conversation.

To keep touched files smaller, moved the app connection/banner styles and the Workshop's number fields to their own modules without changing them. `App.tsx` is 296 lines (was 303), `settings.tsx` 312 (was 361), and `shell.tsx` 434 (was 509).

## Checks run

- `bun run check`: passes.
- `bun run typecheck`: passes in all six workspaces.
- `bun run test apps/app/test/foundation/panelState.test.ts apps/app/test/shell/navigation.test.ts`: 12 pass. The board's old pinned behavior first failed the updated expectation; the host-isolation test first failed before adding host ownership.
- Final full `CI=1 bun run test`: 1,404 pass, 14 skip, on Electron's bundled Node (126 test files pass, one skipped). The earlier full run had 1,402 pass before the two additional ownership tests and host-boundary correction.
- `git diff --check`: passes.
- The rendered [drive](2026-11-13-panel-ownership/drive.ts), after the correction, passes all four groups:

```text
PASS: the Workshop picker closes when its section changes
PASS: only the explicitly opened Iskios picker carries; replacing or closing it clears it
PASS: quests and side-quests start closed and never inherit details or pickers
PASS: realms start closed; Iskios's picker alone carries into quests and realms
```

The drive checks returning to a page, changing Workshop sections while Iskios stays open, replacing Iskios's selection with a page picker or details, closing through the edge handle, folding and reopening Iskios, quest-to-quest and parent-to-child navigation, and realm-to-realm navigation. It runs at 1600 × 1000 to include the former wide-window open default. It seeds disposable quests and realms through the service and opens their panels through the rendered controls.

Screens inspected from that run:

- [Workshop Permissions, its picker closed while Iskios's conversation remains](2026-11-13-panel-ownership/screens/workshop-permissions-closed.png).
- [A quest with Iskios's picker still selected, showing Haiku while the quest uses Sonnet](2026-11-13-panel-ownership/screens/quest-with-iskios-picker.png).
- [Another realm, details closed](2026-11-13-panel-ownership/screens/realm-details-closed.png).

## Repeating the window check

Aside's browser profile was disconnected, so the drive used the existing CDP helper against a throwaway Electron window, not the owner's profile. No provider calls were made.

In separate terminals:

```sh
bun run --filter desktop build
cd apps/app && BROWSER=none bunx expo start --port 8113
```

```sh
ISKIOS_DATA_DIR="$PWD/.expo/panel-verification-data" ISKIOS_HARNESS=fake \
ISKIOS_APP_URL=http://127.0.0.1:8113 \
node_modules/.bin/electron --remote-debugging-port=9363 apps/desktop/dist/main.js
```

Then run the drive command above, optionally adding a fourth argument naming a screenshot directory. Use an isolated, disposable data directory: the script adds quests, a side-quest, and realms, and does not delete them.

Do not use Metro's CI mode for an edit-and-recheck loop: it disables file watching and can serve the original bundle after source changes. The first post-edit attempts still exercised that cached original bundle. Restarted Metro without CI and reloaded the window before checking the correction. The driver waits for both composers before choosing a quest's model button; otherwise the only button mounted during loading can be Iskios's.

## Limits

The owner has not yet tried the corrected interaction. Driven on macOS with Electron 45 and the fake harness, using the light Iskios look. Narrow windows, a paired-host window, dark/Gild looks, native phones and the packaged application were not driven. Host isolation is checked at the state seam only. The existing nested-button warnings in the left sidebar still appear; they predate this change and are unchanged.
