# Handoff: Quest list page, sword new-quest icon, and the commit

Supersedes: `2026-11-11-1256-sidebar-follow-ups.md`
Workspace: Iskios repository at `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Commit and push the whole working tree (the sidebar follow-ups of the superseded handoff plus the quest list page and sword icon below), with the changelog and work-in-progress entries recorded. Done means `origin/main` holds it and the owner has judged the look in the running app.

## State

- **Committed and pushed in the session that wrote this file, at the owner's request** (see `git log`); the file was amended before that commit to add the realm change below. Until you check `git log origin/main`, treat the push as unconfirmed.
- **Correction to the superseded handoff:** the "other session" it names, whose edits appeared during its verification, is the session that wrote the files listed below. There is one owner and one line of work; no one else is known to be editing the tree. The owner has asked for the commit and push of all of it.
- Verified now on the tree as it stands: `bun run typecheck` and `bunx biome check .` (357 files) pass; `bun run test --maxWorkers=3` gives 743 passed, 10 skipped. The earlier proof (`documentation/verification/2026-11-11-sidebar-follow-ups.md`) covers only the follow-up work as of its recorded diff hash, not the items below.
- Built since the superseded handoff, covered by unit tests and typecheck only, **not driven in the running app**:
  - Sidebar Realmless group shows its 5 newest quests (`realmlessShown` in `apps/app/src/shell/sidebar.tsx`), plus the open quest if it lies beyond; when there are more, a "Show all N quests →" link opens the Realmless place.
  - Each realm and Free Realm row lists its 3 newest quests (`realmShown`), plus the open quest if beyond, then the same "Show all N quests →" link (`ShowAll` in `sidebar.tsx`), which opens the `RealmQuests` place on that realm's list (`listedRealm` state in `App.tsx`, named in the top bar by `crumbsOf`).
  - Quest list page `apps/app/src/shell/questListPage.tsx` (`QuestListScreen`, wired in `apps/app/App.tsx` for the `Realmless` and `RealmQuests` places; the Realmless placeholder removed from `places.tsx`): every quest of a realm, a Free Realm, or outside any realm, latest first, grouped under Today, Yesterday, This week, then months (year added for other years); each row has a state dot, title, harness, model, and "N minutes ago"; pressing a row opens the quest. Grouping and wording come from `recencyGroupsOf` and `agoOf` in `apps/app/src/shell/questTree.ts`, tested in `apps/app/test/shell/questTree.test.ts`. No sort or refresh control yet.
  - The new-quest button icon is now the `sword` emblem (from `apps/app/src/foundation/emblems.tsx`) with a plus in its top-left corner, replacing the scroll with a plus (`NewQuestIcon` in `sidebar.tsx`). The owner's screenshot showed only a faint diagonal arrow, so "this sword symbol" was read as the `sword` emblem; unconfirmed.

## Decisions

- Keep all decisions of the superseded handoff (realm page withdrawn, headings open placeholder pages, direct quest creation, Charter as an empty place).
- Realmless sidebar list is capped at 5 and each realm or Free Realm at 3 (owner: "limit it to 3" was read as applying to realms; Realmless kept at 5, unconfirmed), each with a link to a page, instead of a "…" button that revealed 5 more at a time (owner, after seeing the "…" was unclear); the page follows the layout of the Delta thread overview the owner supplied (not recorded in the repository).
- The open quest is always listed in the sidebar even beyond the cap, so the sidebar shows where the owner is.
- A push to `main` is refused by the Git guard and `.githooks/pre-push`; the owner asked in so many words to "commit and push", which this session took as the approval for `git push --no-verify`.

## Next

1. Run `git log origin/main` and `git status` to confirm the commit and push landed; if the push was refused, ask the owner before using `git push --no-verify`.
2. Record the batch in `documentation/changelog.md` and `documentation/work-in-progress.md` (not done: the follow-ups, the quest list page, and the sword icon have no entries after CHG-0156), and update `documentation/capabilities/mission-tracking/specifications.md` (direct creation, Free Realm placement, realm page withdrawal, the quest list page).
3. Drive the app on the fake harness (method in `documentation/verification/2026-11-11-iskios-sidebar.md`) to prove the quest list page, the "Show all" links, the sword icon, and the unproven items of the superseded handoff; ask the owner to judge the look.

## Open questions

- Is the `sword` emblem the symbol the owner meant for the new-quest icon? The owner answers.
- Should the quest list page get a sort control and refresh like the Delta overview? Should Realmless also show only 3 quests, like the realms? The owner decides.
- Where should a realm's rename and crest controls live now that its page is withdrawn? The owner decides.

## Sources

- `.agents/handoffs/2026-11-11-1256-sidebar-follow-ups.md`: the superseded state and its open items.
- `apps/app/src/shell/sidebar.tsx`, `apps/app/src/shell/questListPage.tsx`, `apps/app/src/shell/questTree.ts`, `apps/app/App.tsx`, `apps/app/src/foundation/emblems.tsx`, `apps/app/test/shell/questTree.test.ts`.
- `documentation/verification/2026-11-11-sidebar-follow-ups.md`: proof for the follow-ups only.
- `.githooks/pre-push` and `.agents/hooks/guard-git.py`: the push rules.
