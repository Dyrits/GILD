# Handoff: quest list page, sidebar caps, and the Side-quests row

Supersedes: `2026-11-11-1306-sidebar-follow-ups-pushed.md`
Workspace: Iskios repository at `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner's sidebar feedback rounds (silver icons, folding, empty quests, Free Realm placement, Charter entry, quest lists capped in the sidebar with a page for the rest, the sword new-quest icon) are on `origin/main`. Done means the owner has judged the look in the running app and the unproven items below are driven.

## State

- Commit `f21e768` holds the work of this thread; this handoff and the follow-up commit adding it are pushed with it (check `git log origin/main` and `git rev-parse HEAD origin/main`). The owner approved pushes to `main` with `git push --no-verify`.
- Corrections to `2026-11-11-1306-sidebar-follow-ups-pushed.md`: `apps/app/src/shell/realmlessPage.tsx` no longer exists, it is now `apps/app/src/shell/questListPage.tsx` (`QuestListScreen`, with a `listing` prop: a realm, a Free Realm, or null for Realmless). Each realm and Free Realm lists only its 3 newest quests (`realmShown` in `apps/app/src/shell/sidebar.tsx`), Realmless its 5 (`realmlessShown`); the open quest is always listed even beyond the cap. Under a capped group, "Show all N quests →" (`ShowAll`) opens the `Realmless` place, or the new `RealmQuests` place with `listedRealm` held in `apps/app/App.tsx` and named by `crumbsOf` in the top bar.
- Verified just before the commit: `bun run typecheck`, `bunx biome check .`, and `bun run test --maxWorkers=3` (743 passed, 10 skipped). Not driven in the running app: everything visual or interactive, including the quest list page, the "Show all" links, the sword-with-plus icon, and the items listed in the 1306 handoff.
- The realm panel's "Threads" row now reads "Side-quests" and counts only the side-quests (each quest's thread count minus its own top thread), since the owner finds "threads" meaningless beside quests (`apps/app/src/quests/questPanel.tsx`). Typecheck and Biome pass; not driven in the app. Other uses of the word "thread" in the interface (for example the agent-thread setting in `apps/app/src/settings/settings.tsx`) were not reviewed or renamed; the owner decides.
- Another session's work in the same tree (the quest panel's edge handle, a sidebar minimum width, the realm panel on the quest list page; see `2026-11-11-1330-panel-handles.md`) is not part of this thread; its commit follows this thread's.
- The changelog and work-in-progress have no entry for this batch (after CHG-0156), and the mission-tracking specification was not updated.

## Decisions

- All decisions of `2026-11-11-1305-quest-list-page.md` and earlier stand: the realm's own page is withdrawn (no rename or crest controls reachable); the sidebar shows a few quests per group and a link to a page of all of them, instead of a "…" button.
- The cap of 3 was applied to realms and Free Realms and Realmless kept at 5; the owner's wording could also mean Realmless at 3 (unconfirmed).

## Next

1. Check `git status` and `git log origin/main`; the tree may hold another session's uncommitted edits, so ask whose they are before touching them.
2. Record the batch in `documentation/changelog.md` and `documentation/work-in-progress.md`, and update `documentation/capabilities/mission-tracking/specifications.md` (direct creation, Free Realm placement, realm page withdrawal, the quest list page).
3. Drive the app on the fake harness (method in `documentation/verification/2026-11-11-iskios-sidebar.md`) to prove the unproven items, then ask the owner to judge the look.

## Open questions

- Is the `sword` emblem the symbol the owner meant for the new-quest icon? The owner answers.
- Should Realmless also be capped at 3, and should the quest list page get a sort control and refresh like the Delta overview? The owner decides.
- Where should a realm's rename and crest controls live now that its page is withdrawn? The owner decides.

## Sources

- `.agents/handoffs/2026-11-11-1306-sidebar-follow-ups-pushed.md` and `.agents/handoffs/2026-11-11-1305-quest-list-page.md`: the superseded states.
- `apps/app/src/shell/sidebar.tsx`, `apps/app/src/shell/questListPage.tsx`, `apps/app/src/shell/questTree.ts`, `apps/app/src/shell/topBar.tsx` (`crumbsOf`), `apps/app/App.tsx`, `apps/app/test/shell/questTree.test.ts`.
- `documentation/verification/2026-11-11-sidebar-follow-ups.md`: proof and what it does not cover.
- `.githooks/pre-push` and `.agents/hooks/guard-git.py`: the push rules.
