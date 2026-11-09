# Proof: the quest panel and cards closer to the owner's illustrated view

- **Verdict:** partly proven. Seen in a browser-engine render with the fake harness at 1600px; no automated test covers the components; the owner has not accepted the look.
- **Work:** working tree on `e40d80e` (CHG-0088)
- **Agreement:** the owner's request to make the interface look more like their illustrated view (`guild-dashboard 2/index.html`) and to give the selected quest's panel the mockup's selected-quest sidebar.
- **Environment:** macOS, Electron 45 as Node (service) and as a page renderer, Expo web export
- **Date:** 2026-11-09

## Claims

| # | Claim | Evidence | Verdict |
| --- | --- | --- | --- |
| C1 | The quest panel is a parchment in a double gilt frame with a diamond at each corner, a red bookmark with a star, a Quest label, the quest's emblem on a gilt-framed tile, its name in large capitals, and one line of how it stands | [Knows](2026-11-09-guild-panel/quest-knows-1600.png) | observed |
| C2 | Two tabs, Knows and Spends, with the open one underlined in red; Knows opens the journal from a blue note with a quill; Spends shows budget, usage, and its meters | same, and [Spends](2026-11-09-guild-panel/quest-spends-1600.png) | observed (Spends' cost figure and meters need a spent or limited quest) |
| C3 | The ending actions sit in a red-ruled box as a gilt "Mark as done" and an outline "Archive" | both quest captures | observed; the confirmation text and Reopen not captured |
| C4 | Cards carry larger capital titles, a brown double frame, a rule over the cost, and no pin; columns are divided by faint gilt rules | [board](2026-11-09-guild-panel/board-1600.png) | observed |
| C5 | The owner's painted desk (lantern, books, scroll, map, astrolabe, inkwell) lies along the foot of the board's window, fading into the wood, behind the scrolling cards | same | observed |

## Not proven

- Summons and Fulfilled cards (the seeded quests were all Resting), the red seal, the Fulfilled tag, narrow widths, and the Archives view.
- The mockup's Counsel, Spoils, Chronicle, and Lore tabs, "quest the fourteenth", party and branch lines, diff counts, the approval box, and the message box in the panel: Gild has no such data or feature, so none is shown.
- That the desk stays legible behind notes such as "None." on a short window.

## Regressions

`bun run typecheck`, `bun run check`, and `bun run test` (431 passed, 10 skipped) pass.

## Reproduce

A service on `fakeHarnessLayer` with a temporary database that starts six quests (four in realm folders), served with `serveLoopback`; the web export served on port 8311 with `window.gild` injected into `index.html`; a throwaway script (not kept) in Electron opened the page at 1600×940, clicked Quests, then Polish the lens, then Spends, and captured the page each time.
