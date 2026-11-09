# Handoff: Realms, crests, and the board redesign

Supersedes: none
Workspace: Gild repository, `main`, committed and pushed from `072982d`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner's illustrated guild dashboard (`~/Downloads/guild-dashboard-svg/`) is matched in the app, quests and realms are reworked (realm crests, realm panel, Guildmaster as the one place quests start), and the owner has accepted the look in the running window. Done also means the changelog, ADR, and specification records exist for what this session added.

## State

- **Verified (run just before writing):** `bun run check`, `bun run typecheck` and `bun run test` pass (447 passed, 10 skipped). Each change was also seen in a headless-browser render of the web export against a throwaway service on the fake harness, except the last few (listed under not seen).
- **Built, quests board:** selecting a card shows it in the right panel with an Open button (cards also carry an Open link); empty boards still show the banners; painted banner images (`apps/app/assets/banners/`) replace the drawn ones; Resting and Fulfilled show only today's quests with "+ N earlier"; the Fulfilled ribbon shows only in the Archives; cards show title and a cost-and-tokens row only; empty columns show a lone ornament.
- **Built, right panel:** pinned open on the Quests board. No quest chosen: "The Council Awaits" with the owner's compass image, ledger and lists. A realm's board: `RealmPanel` (crest and name editable by pressing them, details, a Lore row, ledger). A chosen quest: the parchment panel; its bookmark takes the banner color of its column.
- **Built, realms and crests:** a crest system modelled on Crest Studio (`packages/contracts/src/crest.ts`, `apps/app/src/crestShapes.ts`, `crest.tsx`, `crestStudio.tsx`, `crestCharges.ts`). Service side: migration `0023_realm_crest`; requests `SetRealmCrest`, `RenameRealm`, `CreateRealm`; `StartMission.realm` (name and crest for a new folder); `ListIntel.workspaceId` (a realm's own lore); the realm list now includes realms with no quests (except in the Archived view). Quests in a realm wear the realm's crest; quests outside any realm show a gold lozenge.
- **Built, Guildmaster:** large realm cards (shared `realmCard.tsx`) two to a row, a crossed-circle "no realm" button and a "Choose a folder…" card beneath, the message box at the foot. No realm is chosen by default. A folder not yet a realm opens a menu to name it and customize its crest, then is imported at once. The all-quests board has no message box; a realm's board does.
- **Built, rail:** a dragged width (232 to 380, default 264, remembered), no brand block, a pointed parchment selection, bigger crests, status dots in banner colors, the latest 8 quests of every realm with "+ N more" unfolding in place, Realms in the collapsed rail leads to the Realms screen.
- **Licence:** the 32 heraldic figures come from game-icons.net (CC BY 3.0) through Crest's artwork; credits are in `apps/app/src/crest-credits.md`. Crest is MPL-2.0; no Swift was copied, the geometry was written again. The attribution is not yet shown in the app.
- **Not seen in a render:** the last few changes (the realm panel's crest as the customize button, the removed Reset and Use-the-default buttons, the all-quests board without the message box, the default of no realm, the collapsed Realms icon, bigger rail crests, the Open link on cards). Typecheck, lint and tests pass for them.
- **Not done:** no `documentation/` records (no changelog entry, ADR, specification, or verification proof) were written for any of this. The Guildmaster's other pages (The Keep and others) still have the castle background and large titles.

## Decisions

- Crests are stored per realm in the service so they follow the owner across devices; a realm with no designed crest shows one derived from its id (`defaultCrestOf`); the studio opens on a shuffle and has no reset. Reason: the owner asked for a starting point and called reset meaningless.
- Quests outside any realm have no crest, only a lozenge (owner's wish, after trying the scroll and the shield image). The app icon is the owner's shield image.
- Guildmaster is the one place quests start from the whole board; a single realm's board may also start one there. The owner said the all-quests board must not.
- Realms with no quests exist and show everywhere once imported (owner: "we should see it even if we didn't start a quest in it").
- Do not run the browser-driven checks the owner interrupts again without need; they have stopped several of them.

## Next

1. Write the records the project asks for: a changelog entry for this batch, an ADR for the crest system and its licence, and a verification proof under `documentation/verification/`; update `work-in-progress.md`.
2. Show the CC BY 3.0 attribution for the heraldic figures where the app or its docs can display it.
3. Look at the last few changes in the running window and fix what the owner finds.
4. Decide with the owner whether The Keep and the other pages lose the castle and large title too.

## Open questions

- Should a realm's board and the Guildmaster both start quests (current), or only the Guildmaster? The owner can answer.
- Should the Android adaptive icon's background and monochrome files match the new shield?
- A small-size crest (22px in the open rail was raised to 30px) may still be hard to read for the detailed figures; the owner decides.

## Sources

- `documentation/outline.md`, `documentation/glossary.md`, `documentation/conventions.md`, `documentation/capabilities/mission-tracking/specifications.md`
- `~/Downloads/guild-dashboard-svg/` (the illustrated view the interface follows)
- `packages/contracts/src/crest.ts`, `packages/service/src/workspaces.ts`, `apps/app/src/crest.tsx`, `apps/app/src/crestStudio.tsx`, `apps/app/src/realmCard.tsx`, `apps/app/src/questPanel.tsx`, `apps/app/src/dashboard.tsx`, `apps/app/src/sidebar.tsx`
- `packages/service/test/workspaces.test.ts`, `apps/app/test/crestShapes.test.ts`, `apps/app/test/boardColumns.test.ts`
- Crest Studio: https://github.com/pauljoda/Crest
