# Verification: quest-panel edge handle, minimum sidebar width, realm panel on the quest list page

- **Verdict:** partly proven. Each claim was observed in the web export on the fake harness; none was shown able to fail by mutation or a before/after run, no fresh-context reproduction was done, and the look awaits the owner's judgment. The Electron window was not driven.
- **Environment:** macOS, Expo web export on localhost:8099, Playwright (Python) with Chromium at 1500×900, a throwaway service on the fake harness (data in `/tmp/iskios-drive/data`, never the owner's). Same method as [2026-11-11-iskios-sidebar.md](2026-11-11-iskios-sidebar.md); the scratch service is [`serve.ts.txt`](2026-11-11-panel-handles/serve.ts.txt) (a fourth atlas quest added so the sidebar shows "Show all 4 quests"), the driver is [`drive2.py`](2026-11-11-panel-handles/drive2.py).

| Claim | Check | Result |
| --- | --- | --- |
| On a wide window the top bar no longer carries the quest-panel icon; a round handle straddles the panel's left edge, centered on the frame | [realm page](2026-11-11-panel-handles/a-realm-page.png) | observed |
| Pressing the handle hides the panel; it becomes a half-circle against the window's right edge (box x 1480.5, width 19.5 in a 1500 window) and pressing it shows the panel again | [hidden](2026-11-11-panel-handles/b-realm-panel-hidden.png), `drive2.py` output | observed |
| Dragging the sidebar to its far left stops at 236 px and "Free Realms" stays on one line (heading height 18 px) | [minimum](2026-11-11-panel-handles/d-min-sidebar.png), `drive2.py` output | observed |
| "Show all 4 quests" on a realm opens its page with the realm's name (atlas) in the top bar and the realm panel (crest, folder, details, lore link, ledger) in the right column | [realm page](2026-11-11-panel-handles/a-realm-page.png) | observed |
| Pressing the crest on that page opens the crest studio | [crest studio](2026-11-11-panel-handles/c-crest-studio.png) | observed |
| The lore link, renaming, and a Free Realm or Realmless page | not driven | unproven |
| The look of the handles and panel | screenshots above | awaiting human judgment |

Regressions: `bun run check`, `bun run typecheck`, and the app's tests (`bun test` in `apps/app`: 155 pass) pass on the end state; the root `bun run test` was not run. None was run against the starting commit.

Seen and left alone: a stray small mark under Craft in the sidebar; not investigated.

Cleaned up: the scratch service and web server were stopped and `packages/service/scratch-serve.ts` removed.
