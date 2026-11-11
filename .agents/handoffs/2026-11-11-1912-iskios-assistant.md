# Handoff: Iskios, the app's assistant (formerly Guildmaster), and the Guild Hall hub

Supersedes: none
Workspace: ISKIOS repository, branch `main`, starting commit `f492434`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Guildmaster becomes Iskios: an assistant that explains the app, keeps realms and quests in order, and only proposes quests, never opening one itself. The Guild Hall becomes a hub (recent activity, what waits for the owner, a recap) above Iskios's message box. Done when both are built, seen by the owner, and run once with a real harness.

## State

- Built and committed with this handoff (agreements CHG-0173, CHG-0174, CHG-0176; deliveries CHG-0175, CHG-0177):
  - `open_mission` is removed; the only way to a new quest is the card from `suggest_mission` (with no ids when nothing matches), opened by the owner's choice. Verified: `packages/service/test/work/guildmaster.test.ts` passes (33 tests plus the card's realm choice), run with `bun run test`.
  - New tools `create_realm` and `rename_realm`, each only on the owner's quoted words; the realm list in Iskios's context includes realms tied to no folder. Verified by the same tests.
  - Every visible text and every text the assistant reads says Iskios; the stored title "Guildmaster" of an old database becomes "Iskios" when the place is next read (assumed: only tested on a fresh database).
  - The proposal card shows the realm (proposed one preselected, or the Borderlands); `Suggestion.realmPath` and `NewMission.realmPath` carry it. Verified in service tests; the card itself was not seen in the running app (assumed).
  - typecheck, Biome, and the app's 211 tests pass (verified this session).
- Not built: the hub; the code renaming (see Next); proposing a quest in a realm tied to no folder; deleting realms; moving quests by Iskios; explaining the app from its documentation.
- Known failures: in `packages/service/test/harness/harnesses.test.ts`, between 1 and 4 tests fail or time out at 5 s from run to run (Codex and OpenCode processes); the added Codex account's folder test already failed before this work (CHG-0171). Not compared with the previous commit (assumed unrelated).

## Decisions

- The Guild Hall keeps its name; the assistant is Iskios (CHG-0173, glossary).
- Iskios may in time do everything the app does, usually asking the owner to delegate work to quests; realms may be deleted, quests are never deleted, only archived (CHG-0174).
- First batch: create and rename realms; delete realms later.
- The hub, above Iskios's message box on one page, shows recent activity, what waits for the owner, and a recap of the period; quick links and Iskios as a side panel on every screen are set aside (CHG-0176).
- Identifiers, columns, request and setting names still say Guildmaster on purpose (CHG-0177): renaming them is a storage and wire migration.

## Next

1. Run Iskios with a real harness and check by hand that it proposes cards instead of answering, uses `create_realm` and `rename_realm` only when asked, and that the card and its realm choice work in the running app.
2. Rename the code: identifiers (`guildmaster.ts`, `GuildmasterPlace`, `ReadGuildmaster`, `isFromGuildmaster`, `is_guildmaster` and `opened_by_guildmaster` columns, `shouldShowGuildmaster`, the sidebar place name `Guildmaster`), with a migration for stored data, a decision record, and every test updated. This is still to do.
3. Settle the recap's definition with the owner (since the last visit or today; quests finished, spending, Rituals run), then build the hub.
4. Offer realms tied to no folder in proposals; add deleting realms; let Iskios move quests; let it explain the app.

## Open questions

- The recap's period and contents: the owner decides.
- Whether the `harnesses.test.ts` failures predate this work: compare with `f492434`.

## Sources

- [quest coordination specification](../../documentation/capabilities/mission-coordination/specifications.md), section "Iskios, the assistant"
- [changelog](../../documentation/changelog.md), CHG-0173 to CHG-0177
- [work in progress](../../documentation/work-in-progress.md)
- `packages/service/src/work/guildmaster.ts`, `threadTools.ts`, `threadToolHandlers.ts`, `suggestions.ts`; `packages/service/src/harness/instructions.ts`; `apps/app/src/conversation/suggestions.tsx`
