# Handoff: Sidebar flat matte icons, reviewed

Supersedes: `2026-11-12-1355-sidebar-flat-icons.md` (its state is still accurate for the icons; this one adds the review and its fixes)
Workspace: ISKIOS, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner replaced the sidebar's icons with their own flat matte set (`guildmaster-flat-matte-icons`). Done means the sidebar shows those drawings in both themes and both looks as the owner wants; the owner's look in the running app is what remains.

## State

- Verified now (git log): the icons are committed on `main` as `a88c8d9` (CHG-0207). The review fixes, this handoff, and the `AGENTS.md` pointer are committed together in the commit that carries this file.
- Verified by command output in this session, after the review edits: `bun run check` (Biome) passes with no errors; `bun run typecheck` passes in all six workspaces.
- Verified by review: the Standards and Specifications reviewers each re-checked the applied edits on their own axis and reported them resolved; no open Standards finding remains except S6, and P4 stays open for the owner (see Open questions).
- Review fixes applied in this commit: `apps/app/src/shell/navIcons.tsx` JSDoc reflowed to one sentence per line and "themes" changed to "looks" (the sets are keyed by look); the glossary's Gild entry no longer lists gilt and bronze sidebar icons; CHG-0207 now says "13 flat matte drawings supplied, 12 used".
- Not re-run in this session: the app test suite, the `expo export` bundle, the Electron window and its screenshots. The earlier recorded results stand as recorded in CHG-0207 and the verification record.
- In flight: nothing. The owner has not yet looked at the result.

## Decisions

- Both looks share the two colorways: ivory on dark, slate blue on light, whatever the theme. Recorded in CHG-0207.
- Each 256 px source is cropped to its drawing and fitted to 192 px, as the sets before it, so rows line up at 22 px and 28 px.
- File names are unchanged, so the Borderlands keep `free-realms.png` (CHG-0161).
- The supplied Realmless drawing is not added: the sidebar has no Realmless destination.
- The `as const satisfies` form and the twelve-line `require` tables stay: the bundler needs literal `require` arguments, and the `satisfies` check guards a missing look or icon.

## Next

1. Have the owner look at the sidebar in the running app (`bun run dev`), dark and light, in Iskios and in Gild (Workshop, Theme); adjust size, tone, or a drawing if they ask.
2. Decide the main-row icon size (P4 below). The main rows use 28 px icons and the other rows 22 px; the menu requirement in the mission-tracking specification asks for smaller icons but gives no pixel figure.

## Open questions

- Whether the drawings read well at the bar's size, and whether the ivory is too warm on Iskios's navy or right on Gild's brown; the owner answers by looking.
- P4: the main-row icons at 28 px against the narrower-menu requirement, which gives no pixel figure. Pre-existing, not changed by CHG-0207; for the owner to judge.
- S6: the `NavIcon` default `size = 22` is never relied on, since every caller passes a size. Optional cleanup, pre-existing.
- Whether the Realmless sparkles drawing should be kept for a future screen; it is unused today.

## Sources

- `documentation/changelog.md` (CHG-0207) and `documentation/verification/2026-11-12-sidebar-flat-icons.md` with its screenshots.
- `apps/app/src/shell/navIcons.tsx`, `apps/app/assets/nav/dark/`, `apps/app/assets/nav/light/`, `apps/app/src/shell/sidebar.tsx`.
- `documentation/glossary.md` (Gild entry; Look and Theme terms).
- The forked thread: `.agents/handoffs/2026-11-12-1355-sidebar-flat-icons.md` and `.agents/handoffs/2026-11-11-2154-gild-theme-icons-matte.md`.
