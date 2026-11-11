# Handoff: Iskios rename, simple theme, and the left sidebar

Supersedes: `2026-11-11-0023-sidebar-specification.md`
Workspace: Iskios repository at `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The app is renamed Iskios, restyled in one flat dark navy theme, and its left sidebar is built to the agreed structure and the owner's supplied example. Done means the owner has judged the look in the running Electron window and chosen what comes next from the unbuilt parts below.

## State

- Verified now by `bun run typecheck`, `bunx biome check .`, `git diff --check`, the desktop build, and `bun run test --maxWorkers=3` (737 passed, 10 skipped): the end state of this session passes. Changes were written for the owner's feedback in small steps, CHG-0143 to CHG-0156 in the changelog; each entry says what was built and what was not seen.
- Verified by driving the web export on the fake harness with Playwright (scripts and screenshots in `documentation/verification/2026-11-11-iskios-sidebar/`): the sidebar order, nested side-quests, folding of Realms, Free Realms, Realmless and The Keep, Free Realm and realm creation menus, the hidden-sidebar toggle with its remembered state, and the conversation bubble colors. Not driven: the Electron window, the packaged app, the real system folder dialog, and the move of a real `Gild` profile (the rename's first launch does it; its logic is tested in `apps/desktop/test/formerData.test.ts`).
- Built: rename in the style of CHG-0072 (packages `@iskios/*`, `ISKIOS_*`, `window.iskios`, `iskios.sqlite`, MCP prefix `mcp__iskios__`); theme tokens in `apps/app/src/foundation/theme.ts`; sidebar in `apps/app/src/shell/sidebar.tsx` with tree logic in `apps/app/src/shell/questTree.ts` (tested); the Realm and Free Realm menu in `apps/app/src/realms/newRealmModal.tsx`; the owner's navigation icons in `apps/app/assets/nav/` through `apps/app/src/shell/navIcons.tsx`; Free Realms backend (`free_realms` table, `CreateFreeRealm` and `ListFreeRealms`, three service tests).
- Removed at the owner's request: the all-quests board and its overview panel, the Realms page, The Keep page, the icon-only sidebar, the header with the name on top, the finished-quest toggle, the Rituals list in the sidebar, the painted art and fonts.
- Sidebar now, top to bottom: Guild Hall; Realms (with a New realm button, each realm with crest, count, and fold arrow); Free Realms (New free realm button; empty shells only); Realmless; Rituals; Craft; The Keep (Library, Lore, Archive); then pinned at the foot Reserves with its compact usage summary and Workshop (the former Charter, the settings). Diamond separators sit between Guild Hall and Realms, Realmless and Rituals, Craft and The Keep, and above Reserves and Workshop. Realms, Free Realms, Realmless, and The Keep fold when pressed (kept in memory only).
- Unbuilt pages (Craft, Library, Reserves detail) show a one-line "not built yet" page. A realm's own page (its quests in columns, crest and lore panel) still opens from the realm's row and is the only board left.
- Another session worked in the same repository and committed `b0047c9` (harness installation in the settings) while this ran; its files overlapped some of this session's rename edits.

## Decisions

- Rename follows CHG-0072: living files change, dated records keep the old name; the glossary and older documents still say Charter and Gild in places.
- Free Realms are stored apart from folder realms (`free_realms`); quests will reference them when placement is built. Recorded in CHG-0149.
- The settings entry is called Workshop; the separate Workshop for MCP servers and connectors is withdrawn until the owner asks for a dedicated menu (CHG-0146, and the specification table in mission-tracking).
- Group headings fold on press, with no arrow; realms, quests, and side-quests keep their arrows (CHG-0147, CHG-0150, CHG-0155).
- The toggle shows or hides the whole sidebar; with it hidden the window still counts as having a sidebar, so a quest's own tree stays out of the conversation (CHG-0152).
- Bubble, user bubble, and terminal colors were picked by eye from the owner's example and live in `theme.ts` (CHG-0156).
- The Done state, Mark as done, and the lifecycle changes of CHG-0135 and CHG-0136 were not touched.

## Next

1. Commit and push were requested for this session's work; check `git status` and `git log origin/main` to see whether they happened, then confirm with the owner what comes next.
2. Ask the owner to judge the look in the running Electron window (`ISKIOS_HARNESS=fake bun run dev`), including bubble colors, the pinned foot, and the separators.
3. Likely next batches, to be chosen by the owner: Free Realm placement with direct quest creation and confirmed moves (CHG-0130 to CHG-0133); the quest lifecycle without Done and Mark as done (CHG-0135, CHG-0136); the Reserves usage page; Library and Craft; a narrow-window layout, since a window too narrow for the sidebar has no list of quests; an Iskios logo to replace the old gold G (still used in the app icon only).
4. Read `documentation/work-in-progress.md` (top entry) and the changelog from CHG-0143 before choosing.

## Open questions

- Should a realm's own board page also go, and where do its crest, lore, and rename controls then live? The owner decides.
- Should the folds of the sidebar groups be remembered between launches? The owner decides.
- Which realm or place should the window open on when the Guild Hall is hidden (currently Rituals)? The owner decides.
- The `shouldShowFinishedQuests` setting is still in the contract, unused; remove it with the lifecycle batch.

## Sources

- `documentation/changelog.md`: CHG-0143 to CHG-0156.
- `documentation/work-in-progress.md`: top entry.
- `documentation/verification/2026-11-11-iskios-sidebar.md` and its folder: proof, scripts (`serve.ts.txt`, `drive.py`), and screenshots.
- `documentation/capabilities/mission-tracking/specifications.md#left-navigation-structure`: the agreed structure, with the Workshop change.
- `.agents/handoffs/2026-11-11-0023-sidebar-specification.md` and `.agents/handoffs/2026-11-10-2334-free-realms-and-quest-moves.md`: the earlier agreements.
- `apps/app/src/shell/sidebar.tsx`, `apps/app/src/shell/questTree.ts`, `apps/app/src/foundation/theme.ts`, `apps/app/src/realms/newRealmModal.tsx`, `packages/service/src/work/workspaces.ts`.
