# Proof: the board brought closer to the owner's mockup

- **Verdict:** partly proven. Seen once in a browser render with the fake harness at 1600px; the owner has not accepted the look; no automated test covers the components.
- **Work:** working tree on `5485680` (CHG-0083)
- **Agreement:** the owner's request to make the interface more like their mockup (a painted guild board).
- **Environment:** macOS, Electron 45 as Node (service) and as a page renderer, Expo web export
- **Date:** 2026-11-09

## Claims

| # | Claim | Evidence | Verdict |
| --- | --- | --- |
| C1 | The board has a large Quests title over a castle-and-hills heading, and columns hang as banners from gilt rods with their meaning inside | [board](2026-11-09-guild-mockup/board-1600.png) | observed |
| C2 | The rail has a crest with the mark and the Gild wordmark, gilt-ruled sections with icons (Realms, Quests, The Keep, Reserves), and Reserves with an icon, a name, what is left, and a gilt-rimmed bar | same | observed |
| C3 | The quest panel opens with a Quest label, the quest's emblem on a chip, its title (press to rename), and its state | [quest](2026-11-09-guild-mockup/quest-1600.png) | observed |
| C4 | Cards have an inner gilt line; a Done card carries a green FULFILLED tag in place of its state badge | written; no Done quest in the capture | not proven |

## Not proven

- The Fulfilled tag, the collapsed rail with The Keep, narrow widths, and renaming from the panel's title.
- The mockup's painted art (vines, lantern, books, map, stained glass, ornate frames), tabs (Counsel, Spoils, Chronicle, Lore), party and branch lines, and diff counts: none exists in Gild or can be drawn in code here; they were left out.

## Regressions

`bun run typecheck`, `bun run check`, and `bun run test` (431 passed, 10 skipped) pass.

## Reproduce

As in [composer and reserves](2026-11-09-composer-reserves.md), at 1600px.
