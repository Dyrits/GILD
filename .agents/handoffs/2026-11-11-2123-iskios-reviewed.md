# Handoff: Iskios, the app's assistant (formerly Guildmaster), reviewed; the Guild Hall hub and the code renaming remain

Supersedes: `2026-11-11-1912-iskios-assistant.md`
Workspace: ISKIOS repository, branch `main`, pushed up to `9f85d0e` (starting commit of the work: `f492434`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Guildmaster becomes Iskios: an assistant that explains the app, keeps realms and quests in order, and only proposes quests, never opening one itself. The Guild Hall becomes a hub (recent activity, what waits for the owner, a recap) above Iskios's message box. Done when the hub is built, the code uses the new name, and the owner has seen the result.

## State

- Built, committed, and pushed (agreements CHG-0173, 0174, 0176; deliveries CHG-0175, 0177, 0178, 0179, 0180):
  - No `open_mission` tool: a quest opens only when the owner chooses on the card from `suggest_mission`. Verified: `packages/service/test/work/guildmaster.test.ts` passes, and a real Claude Code run in a throwaway Electron window proposed a card, then opened the quest in the realm and did the work.
  - `create_realm` and `rename_realm` act only on the owner's quoted words; they refuse a quest's thread, an unknown realm, a name another realm has, a folder that already has a realm, and a folder that does not exist (in `guildmasterRealms.ts`). Verified by tests.
  - `suggest_mission` with a realm that does not exist or has no folder answers an error and makes no card. Verified by a test.
  - The card shows the realm (proposed one preselected, or the Borderlands) and the Companion as chips: Default and each tier set in the Workshop, one selected; "Customize the Companion" opens the old pickers. Logic in `apps/app/src/conversation/suggestionChoices.ts`, tested. Look seen in screenshots under `documentation/verification/2026-11-11-iskios-live/`, not judged by the owner.
  - The Guild Hall has no side panel; the reload loop (`ReadGuildmaster` announced a change on every read) is fixed, with a test shown able to fail.
  - Visible texts and the assistant's instructions say Iskios; migration `0041_assistant_renamed_iskios` renames the old stored title (tested).
- Review and refactor: independent Standards and Specifications reviews, accepted changes applied and re-verified by the same reviewers; the proof is `documentation/verification/2026-11-11-iskios-proof.md` (seven deliberate breaks of the code each fail a test; a fresh agent reproduced it).
- Verified at the last run (full suite with `--testTimeout=60000 --maxWorkers=3`): typecheck and Biome pass; 799 tests pass; 3 fail (`prices.test.ts` twice, `harnesses.test.ts` "runs a thread with an added account's own folder"), and they also fail on `f492434`. Without those flags, more tests time out under machine load; other timing failures (Codex and OpenCode turns, `loreOverTime`) come and go and also occur on `f492434`.
- Assumed: the packaged-app check `apps/desktop/scripts/check-package.ts` (edited to wait for "Iskios" and "Budget ·") was never run; Codex and OpenCode as Iskios's harness never run; light mode, a narrow window, a phone, and the card with matching quests never looked at.

## Decisions

- The Guild Hall keeps its name; the assistant is Iskios (CHG-0173, glossary).
- Iskios may in time do everything the app does, usually asking the owner to delegate to quests; realms may be deleted, quests are never deleted, only archived (CHG-0174). Built: create and rename realms.
- The Guild Hall will be a hub: recent activity, what waits for the owner, a recap of the period, Iskios's box at the foot; quick links and Iskios as a side panel everywhere are set aside (CHG-0176). Not built.
- Identifiers, columns, request and setting names still say Guildmaster on purpose; renaming them is a storage and wire migration, a batch of its own with a decision record (CHG-0177). This renaming remains to do.
- The card offers Companions by tier, no pickers unless the owner opens "Customize" (CHG-0179; the Customize link is the builder's addition).

## Next

1. Ask the owner the four open questions (below), then act on the answers.
2. Settle the hub's recap with the owner (since the last visit or today; quests finished, spending, Rituals run), then build the hub in the Guild Hall, where the side panel was.
3. Rename the code: files and identifiers (`guildmaster.ts`, `GuildmasterPlace`, `ReadGuildmaster`, `isFromGuildmaster`, columns `is_guildmaster` and `opened_by_guildmaster`, `shouldShowGuildmaster`, the sidebar place `Guildmaster`), with a migration for stored data, a decision record, and every test updated.
4. Run the packaged-app check, Iskios on Codex and OpenCode, and look at the card in light mode and in a narrow window.
5. Later: realms tied to no folder on the card; deleting realms; moving quests by Iskios; explaining the app.

## Open questions

- Should the card say "Create" with the realm's folder (as CHG-0173 words it), instead of "Open the new quest"? The owner decides.
- Keep "Customize the Companion"? The owner decides.
- Iskios can make a realm tied to no folder that the card cannot offer: stop making them, or carry the realm's id instead of its folder path? The owner decides.
- Should `create_ritual` need the owner's quoted words like the realm tools? The owner decides.
- The recap's period and contents. The owner decides.
- The glossary still defines Workshop as MCP servers, connectors and skills, while the settings screen is titled Workshop: fix the glossary in its own change.

## Sources

- [quest coordination specification](../../documentation/capabilities/mission-coordination/specifications.md), section "Iskios, the assistant"
- [changelog](../../documentation/changelog.md), CHG-0173 to CHG-0180
- [work in progress](../../documentation/work-in-progress.md)
- [proof](../../documentation/verification/2026-11-11-iskios-proof.md) and [live run](../../documentation/verification/2026-11-11-iskios-live.md)
- `packages/service/src/work/guildmaster.ts`, `guildmasterRealms.ts`, `suggestions.ts`, `threadTools.ts`; `packages/service/src/harness/instructions.ts`; `apps/app/src/conversation/suggestions.tsx`, `suggestionChoices.ts`
