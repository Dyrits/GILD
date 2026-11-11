# Handoff: architecture deepening of the @ menu and Gild work (done and checked; owner decisions pending)

Supersedes: none (forked from `2026-11-11-2156-at-mentions.md`)
Workspace: ISKIOS repository, branch `main`; starting commit `588d0e3`; committed with this handoff (check `git log` and `git status` for whether the push went through)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review and refactor the last changes (CHG-0181 to CHG-0183), then deepen the modules an architecture audit flagged, without changing behaviour. Done when the four candidates are in, checked, and recorded, and the behaviour changes that need the owner are listed.

## State

- Done, recorded as CHG-0187: the review's refactors, and four deepenings.
  - A, turn reach: `packages/service/src/work/reach.ts` (`mayMessage`, `mayReadJournal`); `work/mentions.ts` resolves a mention once for the note and the grants; `isWithinReach` left `tree.ts`. Verified: `packages/service/test/work/mentions.test.ts` passes, including two new cases (a realm mention grants nothing; a thread's own `@` opens nothing).
  - B, composer list: `apps/app/src/ui/composerList.ts` (pure), `ui/useComposerList.ts` (hook), used by `ui/controls.tsx`. Verified: `apps/app/test/ui/composerList.test.ts` passes, including the `/` list.
  - C, one mention resolver: `chipOfMentionable` and `chipsOf(text, { entries, mentionables, skills })` in `ui/chipPlaces.ts`; `useChipsOf` in `ui/chips.tsx`. Verified: `apps/app/test/ui/mentionMenu.test.ts` passes.
  - D, appearance: `foundation/themeName.ts`, `foundation/desktopTheme.ts` (`syncDesktopTheme`), `applyAppearance` in `colorScheme.ts`, `apps/desktop/src/appIcon.ts` table. Verified: `apps/app/test/foundation/desktopTheme.test.ts` and `apps/desktop/test/appIcon.test.ts` pass.
- Verified now: typecheck passes in all four workspaces (`bun run typecheck`); Biome clean (`npx biome check .`) before the changelog and handoff edits. Full suite: 842 passed, 14 skipped, 8 failed with 5 s timeouts under load 14 in `prices`, lore, and `harnesses` suites that import none of the changed modules; those files rerun serially passed except one `prices` test, which passed with `prices.test.ts` alone twice.
- Assumed (not checked): the composer in a real window (the hook's wiring to the field was not driven; only the pure functions are tested); the Dock icon; Gild screens beyond CHG-0183's; a failed Dock call (code path is tested with a fake bridge only).
- The audit report is `documentation/architecture-audit/architecture-audit-2026-11-11-2256.html`.

## Decisions

- Refactors keep behaviour and every user-facing and tool text unchanged (instruction of this session); P4 and P5 stay as before.
- A refused Dock call is ignored, since the icon is decoration (builder's choice for the review's S1).
- `Theme` is spelled in its own file because importing `themeRules.ts` into the desktop app fails with TS1287 (the app package is not an ES module).
- The changelog entry is CHG-0187 because the `guild-hall-hub` worktree already holds CHG-0184 to CHG-0186.

## Next

1. Drive the composer in a throwaway window (`/` and `@`: categories, Backspace back, arrows, Tab) and look at the Dock icon on a theme change, then note the result.
2. Ask the owner about the behaviour changes left open: P1 (category lists capped at 12), P2 (mixed list files 8 to 5), P4 (deleted sender note), P5 (reply rule), P6 (title from a raw `@quest:` token), P7 (closed-chip wording), S3 (failed mention read ignored).
3. Merge with the `guild-hall-hub` worktree work (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS-guild-hall-hub`, branch `worktree/guild-hall-hub`), which has its own changelog numbers.
4. Leftover audit ideas: `controls.tsx` and `sidebar.tsx` size, and the review's S13 to S19 (subjective), if wanted.

## Open questions

- Which of P1 to P7 and S3 does the owner want changed, and how? The owner decides.
- Did the push to `main` pass the guard and the pre-push hook? Check `git status` and `git log origin/main`.

## Sources

- [changelog](../../documentation/changelog.md), CHG-0181 to CHG-0183 and CHG-0187
- [architecture audit](../../documentation/architecture-audit/architecture-audit-2026-11-11-2256.html)
- [glossary](../../documentation/glossary.md): Mention, Reach, Theme, Look, Gild
- `packages/service/src/work/reach.ts`, `packages/service/src/work/mentions.ts`, `apps/app/src/ui/composerList.ts`, `apps/app/src/ui/chipPlaces.ts`, `apps/app/src/foundation/desktopTheme.ts`
- [previous handoff](2026-11-11-2156-at-mentions.md)
