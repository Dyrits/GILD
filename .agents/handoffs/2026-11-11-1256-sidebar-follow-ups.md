# Handoff: sidebar follow-ups, empty quests, and Free Realm placement

Supersedes: `2026-11-11-1225-iskios-sidebar.md`
Workspace: Iskios repository at `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish the owner's round of sidebar feedback after commit `2a75c4e`: the silver icons, folding rules, new-quest buttons that create an empty "New quest", Free Realm placement, and the Charter entry. Done means the owner has judged the look in the running app and the unproven items below are driven.

## State

- **Committed and pushed to `main` in one commit** ("Add empty quests, Free Realm placement, and the sidebar follow-ups"; find it with `git log -3`), at the owner's request and with their approval to use `git push --no-verify`. It also carries a Realmless page that another session was building in the same working tree (`apps/app/src/shell/realmlessPage.tsx`, recency grouping in `questTree.ts`, edits to `sidebar.tsx` and `App.tsx`); the owner chose to commit everything together. That page is not covered by the proof, and the other session may still be editing; check `git status` before touching those files.
- Verified just before the commit: `bun run typecheck`, `bunx biome check .`, and `bun run test` (743 passed, 10 skipped) on the combined tree. An earlier run, while the other session was mid-edit, showed 3 failing tests that passed on the next run.
- Built by this session (verified by the proof `documentation/verification/2026-11-11-sidebar-follow-ups.md`, with mutation checks and a fresh-context rerun, on the tree as of `git diff` md5 `35b86c60fe890680fb6321f099c64cfd`): the `StartEmptyQuest` request (realm folder, Free Realm, or none; names the quest "New quest" until its first message names it); migration `0038_mission_free_realm` and `MissionSummary.freeRealmId`; `placementsOf` now groups quests by Free Realm; 740 tests passed, 10 skipped, typecheck, Biome, and the desktop bundle pass.
- Built but not driven in the running interface (unproven, awaiting the owner's eye): silver nav icons (cropped to their drawing, stray fragments removed) and a new `charter.png`; Realms, Free Realms, and Realmless headings open placeholder pages and no longer fold; descriptions under headings removed (kept as accessibility hints); The Keep shows a large chevron and folds; realms and free realms fold when their row is pressed and show "No quest in this realm yet."; the scroll-and-plus new-quest button on each realm and free realm row and in the Realmless heading; Charter row between Reserves and Workshop with a placeholder page; "Travel to a new realm" and "Travel to a new free realm" titles; the Settings guide side panel removed; the realm board page (rename, crest) no longer reachable from the sidebar.
- Removed with the realm board entry points: `onWorkspace`, `workspaceId`, and the free-realm placeholder page; the Dashboard's realm mode and the `Quests` place are still in the code, unreachable.

## Decisions

- Pressing a realm or free realm folds it; the realm page is withdrawn for now, to return "in another form" (owner). Realms can therefore not be renamed or given a crest from the interface until that returns.
- Category headings (Realms, Free Realms, Realmless) open their own placeholder pages; the Realms and Free Realms headings keep the big "+", Realmless gets the new-quest icon instead because it needs no realm made first (owner).
- A free realm's quests are recorded in `missions.free_realm_id`; a quest in a Free Realm has no workspace. Dragging quests between placements is still unbuilt.
- The new-quest button creates the quest at once with the last quest's harness, model, and effort, not through the Guildmaster.
- Charter is a new empty place beside Workshop; the glossary says the Charter holds the settings, which still open from Workshop until the owner decides what moves.

## Next

1. Check `git status` and `git log origin/main` for what the other session has done since, and ask the owner what comes next.
2. Record the batch in `documentation/changelog.md` and `documentation/work-in-progress.md`, and update `documentation/capabilities/mission-tracking/specifications.md` (direct creation, Free Realm placement, the realm page's withdrawal), which were not touched.
3. Drive the app on the fake harness (see `documentation/verification/2026-11-11-iskios-sidebar.md` for the method) to prove the unproven items above, then ask the owner to judge the look.

## Open questions

- Where should a realm's rename and crest controls live now that its page is withdrawn? The owner decides.
- Should a Free Realm quest also be creatable by the Guildmaster, and how does lore scoping treat Free Realm quests? Specified in the mission-tracking and scoped-intel specifications but not built.
- The replacement look for the new-quest button (a scroll with a plus) awaits the owner.

## Sources

- `documentation/verification/2026-11-11-sidebar-follow-ups.md`: claims, mutations, and what is unproven.
- `documentation/capabilities/mission-tracking/specifications.md`: starting a quest, Free Realms, left navigation structure.
- `apps/app/src/shell/sidebar.tsx`, `apps/app/src/shell/questTree.ts`, `packages/service/src/service.ts` (`StartEmptyQuest`), `packages/service/src/work/missions.ts`, `packages/service/src/work/titles.ts`, `packages/service/src/core/store.ts`, `packages/contracts/src/requests.ts`.
- Tests: `packages/service/test/work/missions.test.ts`, `apps/app/test/shell/questTree.test.ts`.
- `.agents/handoffs/2026-11-11-1225-iskios-sidebar.md`: the superseded state.
