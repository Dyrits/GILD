# Handoff: Realms and Borderlands sidebar, polished through the owner's feedback

Supersedes: `2026-11-11-1640-realms-and-borderlands.md`
Workspace: ISKIOS repository, branch `main`, everything described here committed (last commit `2c60a92`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A quest belongs to a Realm (tied to a folder or to none, with lore shared across its quests) or to the Borderlands (autonomous quests, no workspace, no shared lore); the sidebar built for it follows the owner's visual feedback. Done means the owner has judged the sidebar in the running Electron window and chosen what comes next.

## State

- Verified now by `bun run typecheck` (4 workspaces pass), `bunx biome check .` (passes), `git diff --check`, and `bun run test --maxWorkers=3`: 771 passed, 10 skipped, 1 failed (`harnesses.test.ts`, "added account's own folder": the `CODEX_HOME` of the running session leaks into the test; unrelated to this work).
- Committed on `main`: `977c1f8` (Realms and Borderlands, CHG-0161, CHG-0163, CHG-0164), `c42e08e` and `bfb3369` (logo trial and spacing measures, CHG-0165), `59e88cd` and `eaacc55` (other sessions' commits that also carried the realm indent CHG-0167, the logo removal, and the grouping and folder icon CHG-0170), `2c60a92` (CHG-0171). Pushed up to `eaacc55`; whether `2c60a92` and this handoff are pushed: check `git log origin/main`.
- Recorded by the previous session, not rerun by this one: whole-row hover fixed (cause: React Native Web's Pressable hover ends when the pointer reaches a nested Pressable; rows now use `onPointerEnter` and `onPointerLeave`), reproduced before and after with a real pointer in the web export and in a throwaway Electron window (`documentation/verification/2026-11-11-realms-and-borderlands/rowhover.py`, screenshots beside it); spacing measured 36 px rows, 37 px apart, labels at x 50, dark and light (`spacing.py`). CHG-0171 holds the figures.
- In the sidebar now: Guild Hall (label and icon unchanged); Realms (fold arrow, "+" for a new realm), each realm 20 px in from the title; realms tied to a folder first, then a thin hairline, then the realms tied to none; a small folder icon after the name of a tied realm with the path as tooltip; the Borderlands section (the former Realmless, mountain icon, new-quest button); Rituals; Craft; The Keep; Reserves and Workshop pinned. Fold arrows (a bow arrow), action buttons, and quest counts show only on hover of the whole row or keyboard focus. Width: minimum 284 px, maximum a quarter of the window. The full quest list nests side-quests.
- Not conclusive: whole-row hover in a throwaway Electron window on the Expo dev server. The probe passed in 2 of 3 runs; the third failed on 2 positions of the realm Atlas. So the owner's problem is not proven fixed in the real app. That dev window also logs "Maximum update depth exceeded" from `useServiceQuery` in a loop (381 times in about 2 minutes), which also happens with the app at `10684a9`; it predates this work and may be why the Electron result is unreliable.
- Not verified: anything in the owner's own running Electron window as seen by the owner, light mode appearance by the owner, creating a realm through the menu, the Guildmaster and the realm chooser for realms tied to no folder.

## Decisions

- Placements reduced to Realms and Borderlands, no migration of data (CHG-0161, ADR 0015). Borderlands stays a separate section, not nested under Realms (the owner considered nesting it and chose to leave it).
- The mark for a folder-tied realm is a simple folder icon; a rolled scroll, then the owner's closed-scroll art, was tried and dropped (CHG-0170). The owner's scroll SVGs stay in `/Users/dyrits/OpenBot/Shared/Transfers/73ede5aa-3677-4012-ba8b-c7a80b7af01c/` only.
- The Guild Hall keeps its name and icon. The owner's Iskios logo was tried above the sidebar and removed; the file `apps/app/assets/iskios-logo.png` stays, unused (CHG-0165).
- The icon set in `~/Downloads/guildmaster-menu-icons-fixed` (vector traces) was compared and not adopted: flatter than the current icons and some clipped at the right edge. Not recorded in the changelog; this paragraph is its only record.
- Hover rules, counts shown on hover only, the 20 px realm indent, tied-before-untied ordering, and the even spacing inside blocks are in the specification and CHG-0163, CHG-0167, CHG-0170, CHG-0171.

## Next

1. Find the cause of the "Maximum update depth exceeded" loop in `useServiceQuery` (`apps/app/src/foundation/useServiceQuery.ts`) and fix it; then rerun `documentation/verification/2026-11-11-realms-and-borderlands/rowhover.py`-style probes in Electron to settle whole-row hover.
2. Ask the owner to judge the sidebar in the running app (`ISKIOS_HARNESS=fake bun run dev`), in dark and light, including hover on whole rows, the folder icon, the hairline between realm groups, and the narrowest width.
3. Settle the open questions below.
4. Let the Guildmaster and the realm chooser place quests in realms tied to no folder; then quest moves between placements (specified, never built).

## Open questions

- Is the nested full quest list (side-quests under their quests, quests unfolded, counts of quests only) what the owner wants, or a flat list? Assumption recorded in CHG-0163.
- What uses `iskios-logo.png`, if anything (app icon, a header)? The owner decides.
- Does the owner want vector icons? The supplied set needs a corrected version first.
- Does whole-row hover now work in the owner's Electron window? Only the owner's trial, after the update-loop fix, can say.

## Sources

- `documentation/changelog.md`: CHG-0161, CHG-0163 to CHG-0165, CHG-0167, CHG-0170, CHG-0171.
- `documentation/capabilities/mission-tracking/specifications.md` (left navigation, placement), `documentation/architecture-decision-record/0015-realms-tied-or-not-and-one-borderlands.md`.
- `apps/app/src/shell/sidebar.tsx`, `questTree.ts`, `railStorage.ts`, `questListPage.tsx`, `apps/app/test/shell/questTree.test.ts`.
- `documentation/verification/2026-11-11-realms-and-borderlands.md` and its folder (scripts and screenshots).
- `.agents/handoffs/2026-11-11-1640-realms-and-borderlands.md` (superseded).
