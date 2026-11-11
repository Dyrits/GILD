# Handoff: sidebar follow-ups pushed, and what remains

Supersedes: `2026-11-11-1305-realmless-page-and-commit.md`
Workspace: Iskios repository at `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner's round of sidebar feedback after `2a75c4e` (silver icons, folding, empty quests created from a realm, Free Realm placement, the Charter entry, the Realmless page, the new-quest icon) is committed and pushed. Done means the owner has judged the look in the running app and what is unproven below is driven.

## State

- **Committed and pushed to `main`** in one commit, "Add empty quests, Free Realm placement, the Realmless page, and the sidebar follow-ups"; find it with `git log -3` and compare `git rev-parse HEAD origin/main`. The owner asked for the commit of the whole working tree and approved `git push --no-verify` for it, because the pre-push hook refuses `main`. Both handoffs `2026-11-11-1256-sidebar-follow-ups.md` and `2026-11-11-1305-realmless-page-and-commit.md` and the proof file are in the commit; their "not committed" statements are out of date, and this file replaces them.
- Verified just before the commit: `bun run typecheck`, `bunx biome check .`, `git diff --check`, and `bun run test` (743 passed, 10 skipped).
- Proven by `documentation/verification/2026-11-11-sidebar-follow-ups.md` (mutation checks, fresh-context rerun), for the follow-up work as of its recorded diff hash only: `StartEmptyQuest` (realm folder, Free Realm, or none; "New quest" until the first message names it), migration `0038_mission_free_realm`, `MissionSummary.freeRealmId`, and the sidebar grouping by Free Realm.
- Not driven in the running app (unproven, awaiting the owner's eye): everything visual or interactive: silver icons and `charter.png`; headings opening placeholder pages; the Keep chevron; folding realms and free realms on press; the new-quest button on realm and free realm rows and in the Realmless heading (now the `sword` emblem with a plus; unconfirmed that this is what the owner meant); the Charter row and its placeholder page; the Realmless page and the sidebar's five-quest cap with "Show all N quests"; the removal of the Settings guide panel; the "Travel to a new realm" titles. The Realmless page work was built after the proof and is covered by unit tests and typecheck only.
- The changelog and work-in-progress have no entries for this batch (after CHG-0156), and the mission-tracking specification was not updated.

## Decisions

- All decisions of `2026-11-11-1305-realmless-page-and-commit.md` and the handoff it supersedes stand: the realm page is withdrawn (no rename or crest controls reachable); headings open placeholder pages; direct quest creation with the last quest's harness and model; a Free Realm quest has no workspace; Charter is a new empty place beside Workshop.
- The Realmless sidebar list is capped at five with a link to its page.

## Next

1. Check `git status` and `git log origin/main`, then confirm with the owner what comes next.
2. Record the batch in `documentation/changelog.md` and `documentation/work-in-progress.md`, and update `documentation/capabilities/mission-tracking/specifications.md` (direct creation, Free Realm placement, realm page withdrawal, the Realmless page).
3. Drive the app on the fake harness (method in `documentation/verification/2026-11-11-iskios-sidebar.md`) to prove the unproven items above, and ask the owner to judge the look.

## Open questions

- Is the `sword` emblem the new-quest symbol the owner meant? The owner answers.
- Where should a realm's rename and crest controls live now that its page is withdrawn? The owner decides.
- Should the Realmless page get a sort control and refresh, and should realms and Free Realms get the same page? The owner decides.

## Sources

- `documentation/verification/2026-11-11-sidebar-follow-ups.md`: proof and what it does not cover.
- `.agents/handoffs/2026-11-11-1305-realmless-page-and-commit.md` and `.agents/handoffs/2026-11-11-1256-sidebar-follow-ups.md`: the superseded states, in detail.
- `apps/app/src/shell/sidebar.tsx`, `apps/app/src/shell/realmlessPage.tsx`, `apps/app/src/shell/questTree.ts`, `packages/service/src/service.ts` (`StartEmptyQuest`), `packages/service/src/work/missions.ts`.
- `.githooks/pre-push` and `.agents/hooks/guard-git.py`: the push rules.
