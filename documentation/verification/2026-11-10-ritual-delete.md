# Delete a Ritual from its card (2026-11-10)

Check: `2026-11-10-ritual-delete/drive.py` (Playwright on the web export, service on the fake harness). It creates a Ritual, opens its card, presses Delete, Cancel, Delete, Confirm, then opens the Quests board.

Result: CANCEL_KEEPS_CARD True; CARD_GONE True; EMPTY_LINE True; QUEST_ON_BOARD True. Screenshots in `2026-11-10-ritual-delete/`.

Tests: `bunx vitest run packages/service/test/rituals.test.ts` (11 passed); typecheck and Biome pass. The full suite was not run.

Not checked: the look at other widths; the owner's look.

Reproduce: as in [the Rituals proof](2026-11-10-rituals.md), with the data folder created first, the scratch serve copied from `2026-11-10-rituals/serve.ts.txt`, and `python3 drive.py <folder holding serve.log and drive/>`.
