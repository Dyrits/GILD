# Verification: quest moves (2026-11-11)

Scope: `MoveQuest`, the sidebar drag-and-drop, and the confirmation (CHG-0172). Starting revision `2fb5af5`.

## Recorded results

- Service, `packages/service/test/work/questMoves.test.ts` (fake harness, real temporary SQLite): 7 of 7 pass. They cover a move of a quest with a side-quest and a deeper side-quest to a realm tied to a folder and then to the Borderlands, with the conversation unchanged; a move into a realm tied to no folder (threads then have no workspace); refusal while a thread is in a turn, with nothing changed; refusal for an unknown quest or realm; a move to where the quest stands changing nothing; the harness session kept across a move, the thread's next turn running in the new folder, and the journal entry "Moved by the user from the Borderlands to Garden" reaching its note; and the quest listed under its new realm.
- App, `apps/app/test/shell/questMove.test.ts`: 4 pass (source and destination named, the lore change stated, a confirmation also for the Borderlands, none for a drop where the quest stands). The app suite passes (18 files, 181 tests). `missions.test.ts` and `handover.test.ts` pass with the new suite (29 tests together).
- `bun run typecheck` passes in the four workspaces; `biome check` passes on the touched folders.
- Driven in a throwaway Electron 45 window (own data folder, Expo web on port 8097, debugger on 9347, fake harness, bundle rebuilt from this tree), with real pointer drags through Chrome DevTools Protocol (`drive.py`), dark then light: a drop on another realm opens the confirmation and nothing moves while it is open; Cancel leaves the quest where it was; "Move the quest" moves it; a drop on the Borderlands asks too; a drop where the quest already stands asks nothing; a quest with a side-quest moves as a whole (the realm card then counts 1 side-quest). Screenshots beside this file.

## Not verified

- The running app as the owner sees it; the look of the confirmation and of the ring around a drop place awaits the owner.
- Probe, `claude -p` 2.1.322 with Haiku, outside the app: a session begun in folder A and resumed from folder B kept its conversation (answered the secret word), read 21,834 tokens from the cache, and named B as its working folder. A resume through the app's long-lived stream-json process, and Codex and OpenCode (OpenCode's `session/load` takes a `cwd`), were not run after a move.
- The refusal shown in the confirmation while a thread runs was checked in the service only, not in the window.
- A thread attached to a workspace other than its quest's: threads inherit the quest's realm, so none could be made by the service's own requests.
- Drag-and-drop on a touch device or in a native build: only the web build drags.
- The second pass of `drive.py` (light) stopped at its last step because the script assumes the starting placements of a fresh data folder; the light confirmation, move, and Borderlands confirmation were seen before it stopped.
