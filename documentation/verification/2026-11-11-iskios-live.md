# Verification: Iskios with a real harness (2026-11-11)

Scope: CHG-0173 to CHG-0178. Starting revision `5a16133`.

## Recorded results

- Throwaway Electron 45 window (own data folder, Expo web on port 8093, debugger on 9357), the default harness (Claude Code 2.1.322, Haiku 5.5 for Iskios, Sonnet 5.5 for the quest), driven with Playwright (`ask.py`, `open_quest.py`, beside this file):
  1. "Create a realm named Shop, tied to the folder ..." made the realm through `create_realm`; it appeared in the side panel.
  2. "Rename the realm Shop to Store" renamed it through `rename_realm`.
  3. "Fix the typo in the README of Store ..." did not open a quest: Iskios proposed it as a card with the realm Store preselected, the Borderlands and Store as choices ([card](2026-11-11-iskios-live/card.png)). "Open the new quest" opened the quest in Store; it ran on the real harness and fixed the README ([opened](2026-11-11-iskios-live/opened.png)).
- A bug found on the way and fixed: `ReadGuildmaster` announced a change at every read, and every screen reloads on a change, so the Guild Hall reloaded in a loop ("Maximum update depth exceeded", up to a closed window). It now announces only when it makes the place; `guildmaster.test.ts` has a test that fails without the fix and passes with it.
- The window title said "Guildmaster" until Expo was restarted with `--clear`: its file watcher missed edits made after it started on this volume.

## Not verified

- Light mode, a narrow window, the card with matching quests, `create_realm` with no folder, and a refusal for a request that does not quote the owner, in the window.
- Codex and OpenCode as Iskios's harness.
- The "Maximum update depth exceeded" logs from CHG-0171 may have had this cause; not rechecked on the older build.
- Iskios's replies came in French although the request was English: probably the owner's own Claude Code configuration (not checked).
