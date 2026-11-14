# Handoff: Providers merged into one card per harness, and its small-screen layout

Supersedes: none
Workspace: ISKIOS (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`; the work was done in a Delta worktree (`.delta/worktrees/mzc9cc8cab34/ISKIOS`) and synced back to `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The Workshop's Providers section shows each harness and its accounts in one card, like the target screen the owner supplied (the page title "Workshop" kept), and reads well on small screens as well as wide ones.

## State

- Built (CHG-0268, `documentation/changelog/0.1.3-Prototype.md`): `apps/app/src/settings/providers.tsx` (replaces `accounts.tsx`; exports `ProvidersSection`) draws one card per harness: logo, name, version pill, Ready pill, "Update available · X" with Update (or Install when the harness has a problem), then its account rows (name, detail, Signed in pill, Rename, "⋯" menu with Sign in / Sign in again and, for added accounts, Remove) and a "+ Add account" button that opens a name field in place. `apps/app/src/ui/actionMenu.tsx` is the new "⋯" menu (same layer and placement as `ui/pickers.tsx`'s Menu). `settings/settings.tsx` uses `ProvidersSection` in the Providers section, below the unchanged Computer name card.
- Verified now by command: `bun run typecheck` and `bun run check` clean; `CI=1 bun run test apps/app` 366 passed, 4 skipped (run before the documentation edits; no code changed after).
- Verified by a driven window (throwaway Electron, fake harness, dark theme, about 1200 by 800): the three cards, Add account with "Work", the menu with and without Remove, Remove, Rename. Evidence: `documentation/verification/2026-11-14-providers-merged.md` and its screens.
- The owner's verdict, 2026-11-14: "Awful on small screen but really nice otherwise". Not yet looked at by an agent: the narrow layout. Assumed cause: each account row puts the name (a 140 px column), the detail, the pill, Rename and the menu on one line without wrapping (`local.account` in `providers.tsx` has no `flexWrap` since a first version that wrapped put the "⋯" alone on a second line), and the harness head wraps its pills and Update button. Not checked in a window.
- Not seen: Update and Install (the fake harness offers neither), a signed-out account, a long detail such as OpenCode's three providers, light and Gild looks, a paired device viewing a host's Providers, the phone build.
- Records changed: `documentation/capabilities/provider-accounts/specifications.md` (describes the merged section), `documentation/work-in-progress.md`, the changelog entry, the verification file.
- Environment: the worktree needed `bun install --frozen-lockfile` and the Electron binary (`node node_modules/electron/install.js` inside `node_modules/electron`) before typecheck or a window would run. The window recipe is in `documentation/verification/2026-11-13-computer-name-and-companions.md` (Reproduce) with its `scripts/cdp.ts`; it needs `ISKIOS_HARNESS=fake`, `ISKIOS_DATA_DIR`, `ISKIOS_APP_URL` and the web export. Resize the window (or the Electron window's size over the DevTools protocol) to test narrow widths.

## Decisions

- The page title "Workshop", the left section menu and the "Providers" menu label stay as they were (the owner: "Keep the title as it is"); the target's settings menu and "Connected" wording were not copied; the pill says "Signed in". Recorded in CHG-0268.
- Rename stays a text link, not a pencil, and account budgets stay on their own card in Limits (my choices, open to the owner's redirection; CHG-0268).
- Next entries of the changelog go in `documentation/changelog/0.1.3-Prototype.md`, created by CHG-0268 (rule in `AGENTS.md`).

## Next

1. Confirm with the owner what "small screen" means (a narrow window with the sidebar open, or the phone layout) and what they want there; then reproduce it in a window at that width and take a screenshot.
2. Redo the narrow layout of `providers.tsx`: a likely shape is the account row as two lines under a width threshold (name and pill on the first, detail and actions on the second) using the existing narrow-window signal (`useHasSidebar` in `foundation/shellContext`, as `settings.tsx` uses), and the harness head letting Update drop under the name. Check typecheck, Biome and a window at wide and narrow widths.
3. Record the result as a new changelog entry (CHG-0269 or later) and update the work-in-progress entry "Providers merged into one card per harness".
4. Later: look at Update and Install, a signed-out account and OpenCode's long detail with a fake or real harness that offers them.

## Open questions

- Owner: what the small screen should look like (see Next 1); Rename as a pencil like the target; account budgets on each account's row (older question, `documentation/backlog.md`).
- Owner: the look in the light and Gild themes.

## Sources

- `apps/app/src/settings/providers.tsx`, `apps/app/src/ui/actionMenu.tsx`, `apps/app/src/settings/settings.tsx`.
- `documentation/changelog/0.1.3-Prototype.md` (CHG-0268); `documentation/verification/2026-11-14-providers-merged.md`; `documentation/work-in-progress.md`; `documentation/capabilities/provider-accounts/specifications.md`.
- `apps/app/AGENTS.md` and `documentation/conventions.md` for the app's rules.
