# Handoff: the Workshop (Settings) redone from the owner's mockup

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Rework the Settings page (the Workshop) to match the owner's mockup (parchment cards on wood, a section menu on the left, a Settings guide panel on the right), with each provider's logo in place of its crest. Done when the owner has seen it in the running window and accepts the look.

## State

Delivered as CHG-0101, based on `77d925b`; committed and pushed to `main` with this handoff unless the commit message of the newest commit says otherwise.
- Verified (run this session): `bun run format` (no fixes), `bun run typecheck`, `bun run check`, `bun run test` (505 passed, 10 skipped, including 5 new tests in `apps/app/test/settingsSections.test.ts`), and `bunx expo export --platform web --output-dir /tmp/gild-export` builds.
- Verified (driven): the page in the web export on the fake harness at 1440px, with screenshots in `documentation/verification/2026-11-10-workshop/` (two layout defects found there were fixed). Not verified: the look against the mockup, and the narrow window (row menu, no guide).
- New files in `apps/app/src`: `settingsSections.ts` (sections and `activeSectionOf`), `settingsIcons.tsx` (line icons, kept apart from the realm emblems the crest studio lists), `settingsParts.tsx` (`SettingsCard`, `SettingsMenu`, `SettingsGuide`, `SettingsHeading`, `SettingsRule`).
- Rewritten: `settings.tsx` (sections and cards, `NumberField`, `NumberSetting`, `ToggleRow`, scroll marking), `accounts.tsx` (`HarnessesCard` and `AccountsCard` with `ProviderMark` logos in place of the old `AccountsSection`).
- Shell change: `useQuestPanel(panel, title = "Quest")` in `sidebar.tsx` now sets the side panel's top-bar name; `App.tsx` pins the panel open on the Settings place when no quest is open and the Permissions screen is closed.
- Known gaps: `RunnerPickers` stays a vertical column (shared with the quest forms); the budget editors keep their old buttons; choosing a section near the page's foot can mark the last section instead (the foot rule in `activeSectionOf` wins).

## Decisions

- Name stays "Workshop", not the mockup's "Sanctum": the owner chose it in this session, over CHG-0092's alternative of renaming everything.
- The menu scrolls to anchors on one page; it does not switch tabs (owner's choice).
- Settings the mockup does not show are kept: quest upkeep and the default budget under Defaults; lore half-lives and the global budget under Limits; send mode, side-quest toggle, and chatter guard under Messaging.
- No painted artwork (sunset castle, tree banner, guide castle): owner chose none.
- Harnesses and Accounts are two cards, so each menu entry has a section.

## Next

1. Capture the Workshop under 820px (the recipe is in `documentation/verification/2026-11-10-workshop.md`) and compare both widths with the mockup; fix spacing and the header.
2. Ask the owner for the look; adjust what they reject.
3. If wanted, lay the default harness, model, and effort pickers out in a row as the mockup draws them (a layout option on `RunnerPickers` or a Workshop-only arrangement).
4. If wanted, restyle `BudgetEditor` with the gold buttons, and write a proof in `documentation/verification/`.

## Open questions

- Does the owner want the mockup's painted header and tree banner later (they would supply the images)?
- Should "Quest upkeep" and the other grouping choices stay as placed? The owner can answer.

## Sources

- `documentation/verification/2026-11-10-workshop.md` (proof and drive script)
- `documentation/changelog.md` (CHG-0101, CHG-0092), `documentation/work-in-progress.md`
- `apps/app/src/{settings,settingsParts,settingsSections,settingsIcons,accounts,sidebar}.tsx`, `apps/app/App.tsx`, `apps/app/test/settingsSections.test.ts`
- `documentation/capabilities/provider-accounts/specifications.md`
- the owner's mockup image, given in the conversation only (not in the repository)
