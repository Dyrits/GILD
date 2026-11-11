# Handoff: only Realms and Borderlands, built

Supersedes: none (first handoff for this batch)
Workspace: ISKIOS, branch `main`, starting commit `10684a9`; committed locally, not pushed

To resume: read this whole file first. Treat every claim not marked verified as unverified, and check it against the Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner's CHG-0161: a quest belongs to a Realm (tied to a folder or to none, lore shared) or to the Borderlands (autonomous, no workspace, no shared lore); Free Realm and Realmless dropped without migration. Then the owner's sidebar requests during the build, CHG-0163: Borderlands = the Realmless section renamed; Realms, Borderlands, The Keep fold alike; a scroll after folder-tied realms; fold arrows (a bow arrow) and action buttons only on whole-row hover or keyboard focus; minimum width fitting "Borderlands", maximum a quarter of the window; the full quest list nesting side-quests.

## State

- Verified: typecheck (four workspaces) and Biome pass; new and updated tests pass; the full suite has 3 failures outside this change (CHG-0164 names them; lore fading/proposal timeouts also occur on `10684a9`, checked in a temporary worktree).
- Verified in the web export on the fake harness, dark and light: see `documentation/verification/2026-11-11-realms-and-borderlands.md`.
- Not verified: the Electron window; the owner's judgment of the look; creating a realm through the menu in the app.

## Decisions

- Storage ([ADR 0015](../../documentation/architecture-decision-record/0015-realms-tied-or-not-and-one-borderlands.md)): a realm is a `workspaces` row with a nullable path; the migration sets thread and permission references aside while it rebuilds the table, because foreign keys cannot be switched off inside the migrator's transaction (the first attempt failed with a FOREIGN KEY error, caught by `test/core/store.test.ts`).
- Keyboard-only reveal: `foundation/inputModality.ts` follows keydown and pointer events, since React Native Web has no `:focus-visible`.
- Tooltips: react-native-web drops `title`, so the scroll's title is set on its DOM element.
- Assumptions to confirm are listed in CHG-0163.

## Next

1. Show the owner the sidebar in the running app; settle the CHG-0163 assumptions.
2. Let the Guildmaster and the realm chooser place quests in realms tied to no folder (they place by path today).
3. Quest moves between placements (spec'd, never built).

## Sources

- `documentation/changelog.md` CHG-0161, CHG-0163, CHG-0164; `documentation/capabilities/mission-tracking/specifications.md`
- `packages/service/src/core/store.ts` (0039), `packages/service/src/work/workspaces.ts`, `missions.ts`, `missionDetail.ts`
- `apps/app/src/shell/sidebar.tsx`, `questTree.ts`, `questListPage.tsx`, `railStorage.ts`, `apps/app/src/foundation/inputModality.ts`
