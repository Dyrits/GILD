# Handoff: Computer name, Workshop sections and Companions (CHG-0257)

Supersedes: none
Workspace: ISKIOS repository, branch `main`, Delta worktree `/Users/dgerrits/Codelab/Dyrits/ISKIOS/.delta/worktrees/x8qgt79stznz/ISKIOS`; starting commit `163667a`; the work is one commit on top of it, to be synced to the original checkout (`/Users/dgerrits/Codelab/Dyrits/ISKIOS`) and pushed to `origin/main` with `--no-verify`, which the owner approved

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let the owner name this computer once and see that name wherever "This computer" stood; make the Workshop (settings) page show one section at a time, with Companions (the default Companion, its backups, and the Light, Balanced, Heavy presets) edited in the right-hand Companions column. Done: the owner has looked at the result in the window and accepted or redirected it.

## State

- Verified now: `bunx biome check .` is clean and `bun run typecheck` passes in all six workspaces. A full `bun run test` run (1364 passed, 14 skipped, 119 files) passed before the last two edits (the menu label "Look and feel" and its changelog line, both strings). A fresh run was not made after them.
- Built (CHG-0257 in `documentation/changelog.md`, proof in `documentation/verification/2026-11-13-computer-name-and-companions.md`): the computer's own sign-in takes the host's name from the service (`ownAccountLabel` in `packages/service/src/remote/hostAccess.ts`), with a **Computer name** card (`apps/app/src/settings/computerNameCard.tsx`); a new quest always starts on the default Companion (`readStartChoices`, `packages/service/src/core/settings.ts`), only the folder is remembered; the setting "Show the Guild Hall in the rail" is removed (`shouldShowGuildmaster`); the Workshop shows only the chosen section (Permissions, Look and feel, Providers, Companions, Remote access, Messaging, Limits; `settings.tsx`, `settingsSections.ts`); the Companions section has a Default card and a Presets card, each Companion as a table with a chevron column (`companionTable.tsx`, `defaultCompanionCard.tsx`, `presetsCard.tsx`), and the tab beside it has Default and Presets tabs with Light, Balanced, Heavy under Presets (`workshopCompanions.tsx`, shared state in `workshopTabs.tsx`; the tab takes its own content through the new `panel` prop of `CompanionPicker`); the right-hand column exists only with a quest panel, on the Companions section, or while Iskios is open (`isCompanionOffered`, `shell/companionScope.ts`, `shell/shell.tsx`); the quest panel's Harness row shows the provider's logo (`Row` `mark`); the plan-limit rings use a `transform` string, which removes React's `transform-origin` error.
- Verified by the proof (window runs on a throwaway Electron with the fake harness, scripts and screens beside it): the label follows a rename everywhere listed; the sections, tabs, marked chevron and column rules behave as stated; the starting commit fails the new service tests and logs the `transform-origin` error.
- Not proven (see the proof): the retired Guild Hall setting test also passes on the starting commit for a reason not found; appearance of everything awaits the owner. Not checked: narrow windows, light and Gild looks, a paired device's Workshop, the phone build, the packaged app. A fresh-context reproduction of the proof was not done.
- Assumed: the owner's dev server at port 8081 does not always pick up edits (it showed stale code twice); a restart of `bun run dev` fixes it.

## Decisions

- One name for the computer: the existing host name, no second field (owner; CHG-0257).
- A new quest always starts on the default Companion and the computer's own sign-in; the default has no account of its own (owner; the account stays chosen per quest). The mission-tracking and provider-accounts specifications say so.
- The presets are the existing Light, Balanced, Heavy tiers; they have no backups yet, so their table has Harness and Model only. The companion-presets specification is otherwise still unbuilt (see the backlog).
- The Guild Hall is always shown; the setting is gone, and a saved settings row with the old key is read and rewritten without it.
- Narrow windows break the Workshop when the Companions column is open. Left on purpose for a later session, to be paired with the mobile version (owner; `documentation/backlog.md`, first entry).
- `biome.json` ignores `documentation/verification` so the proof's driving scripts are not linted.

## Next

1. Start with the owner's note: "Computer name should maybe be in another place." It is unspecified. Ask where (for example the host menu, the top of Providers, a Remote access card, or the sidebar), then move `ComputerNameCard`.
2. Look at the owner's remaining points on the Workshop in the window after a restart of `bun run dev`: the card tables, the tab's tabs and spacing, the chevron marking, the column rules.
3. Settle whether the default Companion needs an account of its own (a quest on an added account must be rechosen each time), and whether Harnesses and Accounts should merge into one card per harness.
4. Rerun the proof's checks from a fresh context (the proof's Reproduce section), and find why the retired-setting test passes on the starting commit.
5. The narrow-window and mobile pass, and the sidebar's nested buttons (`apps/app/src/shell/sidebar.tsx` lines 335 and 358, a React error in the dev console that predates this work).

## Open questions

- Owner: where the Computer name belongs.
- Owner: a default account for the default Companion; backups for presets.
- Owner: whether the Providers section should be one card per harness.

## Sources

- `documentation/changelog.md` (CHG-0257), `documentation/verification/2026-11-13-computer-name-and-companions.md` and its folder (screens, scripts)
- `documentation/backlog.md` (the narrow-window entry and the Companion presets entry), `documentation/work-in-progress.md`
- `documentation/capabilities/companion-presets/specifications.md`, `documentation/capabilities/provider-accounts/specifications.md`, `documentation/capabilities/mission-tracking/specifications.md`, `documentation/capabilities/device-pairing/specifications.md`
- `apps/app/src/settings/`, `apps/app/src/shell/shell.tsx`, `apps/app/src/editors/companionPicker.tsx`, `packages/service/src/remote/hostAccess.ts`, `packages/service/src/core/settings.ts`
