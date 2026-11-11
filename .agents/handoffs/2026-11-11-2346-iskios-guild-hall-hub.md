# Handoff: Iskios, the Guild Hall hub and Iskios's panel built; owner review and the code renaming remain

Supersedes: `2026-11-11-2123-iskios-reviewed.md`
Workspace: ISKIOS repository; the work is one commit, "Guild Hall hub, Iskios panel on every screen, context and settings tools", built on branch `worktree/guild-hall-hub` (worktree `ISKIOS-guild-hall-hub`, starting commit `5fbfc4c`), rebased onto `main` at `01d1249`, and meant to be pushed to `origin/main` (check with `git branch -r --contains <that commit>`; not verified when this was written)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Guild Hall becomes a hub above a permanent Iskios, which is a panel on every screen, knows where the owner has it open from, and can change the owner's settings on request. Done when the owner has looked at the hub, the panes, and the top bar, has confirmed or changed the choices listed in Decisions, and the code renaming (Guildmaster to Iskios) is done.

## State

- Built and committed (agreements and deliveries in the changelog, CHG-0188 to CHG-0194):
  - The hub (`apps/app/src/conversation/guildHallHub.tsx`, `guildHall.ts`; service `packages/service/src/work/guildHall.ts`, requests `ReadGuildHallRecap` and `VisitGuildHall`): a line saying how many quests wait, a band of five icon tiles (waiting, underway; finished, spent, Ritual runs since the last visit, or the last 24 hours at the first), the waiting quests as tinted cards, the recent quests as dense rows with a "View all" link to the quest board, and the finished quests of the period. No quick access (the owner found it useless).
  - Iskios as a panel on every screen: the top bar's "Iskios" button opens and folds it, as a column at the window's far right (a card on a narrow window), with an expand button that fills the content area. No ✕ on a wide window.
  - The top bar spans the window; below it the sidebar, the screen, the quest panel, and Iskios's column stand as up to four panes. One drag strip (`apps/app/src/shell/edgeResizer.tsx`) resizes the sidebar and the two right panes between their opening width and a quarter of the window; widths are remembered (`railStorage.ts`).
  - Each message to Iskios carries where the owner has it open from (the quest, named from its stored title, or the screen's name): migration `0042_message_viewing`, `viewingLineOf` in `guildmaster.ts`, delivered as a note after the message (`messaging.ts`), not shown in the owner's message; the app side is `apps/app/src/shell/viewing.ts`.
  - `read_settings` and `change_setting` (`packages/service/src/work/guildmasterSettings.ts`): on the owner's quoted words, from and to said; the approval level, the budgets, and price fetching are refused.
- Verified after the last rebase, onto `01d1249`, on the merged tree: `bun run typecheck` passes in the four workspaces; `biome check apps packages` is clean; `git diff --check` passes; app tests 235 passed, 4 skipped; desktop tests 34 passed; service tests 611 passed, 10 skipped, 1 failed. `git range-diff` against the pre-rebase commits shows only the renumbering of my CHG entries and the merges with main's changelog and `AGENTS.md`.
- The service failures change from run to run under machine load and none comes from this work: in the last run one `prices.test.ts` test failed, and `prices.test.ts` alone passes (24 of 24, on this tree and on main); in earlier runs `loreOverTime` "never fades a rule or a pinned lore entry" (20 s timeout; it fails the same on the earlier commit `5fbfc4c`, checked without this work) and one Codex or OpenCode test of `harnesses.test.ts` failed, which passes 45 of 45 alone.
- Verified earlier (before the rebases, on this work alone): driven in a throwaway Electron window on the fake harness at 1400 to 2200 px, light and dark; screenshots and the account are in `documentation/verification/2026-11-11-guild-hall-hub.md` and its folder. The two rebases (onto `588d0e3`, then `01d1249`) stopped on conflicts in `messaging.ts` (main's `@` mention notes kept, my note added), `changelog.md`, `work-in-progress.md`, and `AGENTS.md` (both sides kept; my changelog entries were renumbered from 0181-0187 to 0184-0190 and then to 0188-0194, with every reference to them; `AGENTS.md` keeps its three newest handoff lines, so the line of the Gild thread, `2026-11-11-2154-gild-theme-icons-matte.md`, was dropped, and the architecture handoff covers that work). Not re-driven in a window after the rebases.
- Assumed: Iskios (a real model) choosing to read the context or to change a setting by itself was never seen; the Settings screen refreshing live after `change_setting` was not looked at; a phone, the narrow window after the pane changes, and all four panes at their widest at once were not seen; the packaged-app check `apps/desktop/scripts/check-package.ts` was never run; Codex and OpenCode as Iskios's harness never run.
- The checkout `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS` (branch `main`) was clean at `01d1249` when last read; its local `main` is not moved by this work, so after the push it is behind `origin/main` and needs a fast-forward (`git pull --ff-only`). Assumed, not checked after the push.

## Decisions

- The owner did not answer the three questions put for the settings batch, so these are mine, to confirm (CHG-0193): Iskios reads details only when needed, with its tools (`read_journal`, `read_settings`), not from a full snapshot on every message; it may change every setting except the approval level, the budgets, and price fetching (they set what agents may do or spend, and a quest's text could talk Iskios into widening them); the change is made on the quoted words and told in a sentence, with no proposal card and no undo.
- The column of Iskios stays in the Guild Hall beside the hub; the floating card is kept only for a narrow window (CHG-0193). The hub's wide layout starts at 1000 px of content, since the column leaves about 830 px.
- Each right pane's least width is the one it opens at (quest panel 360, Iskios 380), so on a window under four times that a pane cannot grow, as the sidebar (CHG-0194, my choice).
- The ✕ stays where no top bar offers a way to close: Iskios's card on a narrow window with no top bar, and the quest panel taking a narrow window's place (CHG-0194, my choice).
- Earlier decisions stand: the Guild Hall keeps its name and the assistant is Iskios (CHG-0173); Iskios proposes and never opens a quest itself; realms may be deleted by Iskios in time, quests never (CHG-0174); identifiers, columns, and setting names still say Guildmaster on purpose until the renaming batch (CHG-0177).
- The changelog numbers of this work are 0188 to 0194 because main took 0181 to 0183 and 0187; renumber again only if another thread lands first.

## Next

1. Ask the owner to look at the hub, the panes and the top bar, and to confirm or change the choices above (a confirmation card before `change_setting`, a wider or different set of settings, the pane least widths).
2. Build the activity indicator on the top bar's Iskios button (Iskios working, or a proposal waiting, while folded), which is not built.
3. Ask the owner the four older open questions below, then act on the answers.
4. Rename the code: files and identifiers (`guildmaster.ts`, `GuildmasterPlace`, `ReadGuildmaster`, `isFromGuildmaster`, columns `is_guildmaster` and `opened_by_guildmaster`, `shouldShowGuildmaster`, the sidebar place `Guildmaster`), with a migration for stored data, a decision record, and every test updated.
5. Run the packaged-app check, Iskios on Codex and OpenCode, and look at the narrow window and a phone.
6. Later: the setting that hides the Guild Hall does not hide the top bar's button; with Iskios's column and the quest panel both open the quest title is cut; the Settings screen's Permissions view is told to Iskios as "Settings"; a quest without a realm shows a lozenge, not a crest.

## Open questions

- Should the card say "Create" with the realm's folder (as CHG-0173 words it), instead of "Open the new quest"? The owner decides.
- Keep "Customize the Companion" on the card? The owner decides.
- Iskios can make a realm tied to no folder that the card cannot offer: stop making them, or carry the realm's id instead of its folder path? The owner decides.
- Should `create_ritual` need the owner's quoted words like the realm tools? The owner decides.
- Is a quest shown both as waiting and as recent on the hub right? It is my assumption; the owner decides.
- The glossary still defines Workshop as MCP servers, connectors and skills, while the settings screen is titled Workshop: fix the glossary in its own change.

## Sources

- [quest coordination specification](../../documentation/capabilities/mission-coordination/specifications.md), sections "Iskios, the assistant", "Place", "Context", and the tool table
- [changelog](../../documentation/changelog.md), CHG-0173 to CHG-0180 (earlier Iskios work) and CHG-0188 to CHG-0194 (this work)
- [work in progress](../../documentation/work-in-progress.md), section "Guild Hall hub"
- [proof of the hub, panes, context, and settings](../../documentation/verification/2026-11-11-guild-hall-hub.md)
- `apps/app/src/conversation/guildHallHub.tsx`, `guildHall.ts`, `guildmaster.tsx`; `apps/app/src/shell/shell.tsx`, `topBar.tsx`, `iskiosDock.tsx`, `edgeResizer.tsx`, `railStorage.ts`, `viewing.ts`
- `packages/service/src/work/guildHall.ts`, `guildmaster.ts`, `guildmasterSettings.ts`, `messaging.ts`, `threadTools.ts`; `packages/service/src/harness/instructions.ts`; `packages/service/src/core/store.ts` (migration 0042)
- The commit "Guild Hall hub, Iskios panel on every screen, context and settings tools" and `git range-diff` against its pre-rebase form (kept as `refs/rebase-backup/guild-hall-hub` in the worktree's repository until deleted)
