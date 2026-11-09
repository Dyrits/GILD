# Proof: pill composer and rail reserves

- **Verdict:** partly proven. `reserveOf` is tested; the look and the growth were seen once in a browser render with the fake harness at 1440px; the owner has not accepted the look.
- **Work:** working tree on `882402b` (CHG-0082)
- **Agreement:** the owner's request for a one-line, pill-shaped message box that grows only for several lines, and for rail reserves like their reference (a name, what is left, a bar).
- **Environment:** macOS, Electron 45 as Node (service) and as a page renderer, Expo web export
- **Date:** 2026-11-09

## Claims

| # | Claim | Evidence | Verdict |
| --- | --- | --- | --- |
| C1 | The box is one line high when empty or holding one line | [one line](2026-11-09-composer-reserves/composer-one-line.png); [board](2026-11-09-composer-reserves/board-reserves.png) (with the pickers inside the pill) | observed |
| C2 | It grows with its lines, wrapped ones included, and the send button stays at the bottom right | [multiline](2026-11-09-composer-reserves/composer-multiline.png) (six lines) | observed |
| C3 | It returns to one line when cleared | one-line capture, taken after selecting and deleting the text | observed |
| C4 | The rail's Reserves show Mana (tokens) and Gold (cost) with what is left and a draining bar, for each set global limit | [board](2026-11-09-composer-reserves/board-reserves.png) with limits $15 and 400,000 tokens, $1.25 spent | observed |
| C5 | `reserveOf` gives the dollars left, the share left, and never below nothing | `labels.test.ts` | proven |

## Not proven

- Orange and red bars (from 80% and at the limit), and the unlimited case's text lines.
- Growth up to the 200px ceiling and scrolling past it; the slash-skill highlight overlay on a grown box; narrow widths, where the pickers wrap below the text.
- Per-harness plan limits ("Claude's mana 38% left"): Gild does not read them (backlog), so Mana and Gold show what Gild counts against the global budget only.

## Regressions

`bun run typecheck`, `bun run check`, and `bun run test` (431 passed, 10 skipped) pass.

## Reproduce

As in [emblems](2026-11-09-emblems.md), with the global budget set to $15 and 400,000 tokens through `UpdateSettings`; the window opened a quest, typed with `insertText`, and captured the page.
