# Handoff: New-realm crest shown is not the crest saved

Supersedes: none
Workspace: ISKIOS repository, branch `worktree/realm-crest-mismatch` (linked working copy `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS-realm-crest-mismatch`, started from `main` at `b6e0324`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

When the owner creates a realm and does not touch the crest, the crest saved for the realm must be the one the creation window showed. Done means the saved realm wears that crest, and the owner has seen it in a window.

## State

- Cause (verified by reading the code): `NewRealmModal` draws an undesigned crest with `CrestBadge` from an id (the folder path, or `"new-realm"` with no folder), but sent `crest: null` when the owner pressed create. The service then stored no crest (`createRealm` and `attachWorkspace` in `packages/service/src/work/workspaces.ts`), and the realm drew its default from its own new id, which gave another crest.
- Fix (verified: file read, formatter, type check, tests): the window now sends the crest it shows. New pure helpers `newRealmCrestId` and `shownCrestOf` in `apps/app/src/realms/newRealmCrest.ts`; `apps/app/src/realms/newRealmModal.tsx` uses them for the badge, the crest studio, and the create button. A designed crest is kept as is. The callers (`apps/app/src/shell/sidebar.tsx`, `apps/app/src/rituals/rituals.tsx`) already forward `realm.crest` unchanged.
- Test added: `apps/app/test/realms/newRealmCrest.test.ts`. Run now: Biome on `apps/app/src/realms` and `apps/app/test/realms` passes; `tsc --noEmit` in `apps/app` passes; `node node_modules/vitest/vitest.mjs run apps/app/test/realms apps/app/test/crest` gives 3 files and 13 tests passed. The full suite and `bun run check` were not run.
- Not checked: the fix in a running window (assumed to work; the owner has not looked). A folder that already has a realm keeps the existing realm and its crest, as before.
- Not done: no changelog entry. The main folder had an uncommitted `documentation/changelog/0.1.3-Prototype.md` using numbers up to CHG-0268, so a number written here could collide; give the fix the next free number when the work lands there.
- Landing: the work is committed on the branch; the owner asked to land it on `main` and push. The main folder has many uncommitted changes of other work, so check live refs and the main checkout before moving `main`.

## Decisions

- Save the displayed crest rather than keeping `null` and changing the default's id: the realm's id does not exist until it is saved, so only an explicit crest makes what is shown equal what is saved. This also means a realm made this way holds a crest in the database, not an id-derived default.
- A pure helper in its own file, so the test does not import React Native code.

## Next

1. Confirm with the owner whether the fix is landed on `main` and pushed, reading live refs first.
2. Ask the owner to create a realm in a window without changing the crest, with and without a folder, and compare the crest in the window with the one in the sidebar.
3. Add the changelog entry under the next free CHG number in the newest release file in `documentation/changelog/`.
4. Run `bun run check`, `bun run typecheck`, and the full tests before any release.

## Open questions

- Should realms made before this fix, which hold no crest and draw an id-derived default, be left as they are? Only the owner can say; nothing was changed for them.

## Sources

- `apps/app/src/realms/newRealmModal.tsx`, `apps/app/src/realms/newRealmCrest.ts`, `apps/app/test/realms/newRealmCrest.test.ts`
- `apps/app/src/crest/crestShapes.ts` (`defaultCrestOf`, `crestOf`), `packages/service/src/work/workspaces.ts`
- Branch `worktree/realm-crest-mismatch`
