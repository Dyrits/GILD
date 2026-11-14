# Handoff: unsent message text survives leaving a screen

Supersedes: none (forked from `2026-11-13-2248-release-0-1-2-and-changelog-per-release.md`)
Workspace: ISKIOS (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Text the owner has typed in a message box and not sent must not vanish when they leave the screen (for example to the Workshop) and come back. The owner reported it for a new quest's box.

## State

- Cause, verified by a window drive: `Composer` (`apps/app/src/ui/controls.tsx`) held its text in `useState("")`, so it left with its screen. On the unfixed code `documentation/verification/2026-11-14-composer-draft/drive.ts` went red (box empty after Workshop and back); on the fixed code it went green. The drive runs against a throwaway Electron window with `ISKIOS_HARNESS=fake` and disposable data; it needs the Electron window to run outside the sandbox and a freshly started Expo dev server (a server started earlier did not pick up edits).
- Fix (CHG-0269, `documentation/changelog/0.1.3-Prototype.md`): `apps/app/src/ui/unsentText.ts` keeps unsent text in memory per named box. `Composer` takes `draftKey` and `ChipEditor` an `initialText`. Boxes named: `thread:<id>` (any quest or side-quest thread), `iskios`, `handoff:<realm path>`. Sending or emptying forgets the text. Closing or reloading the window forgets it too, and a chip comes back as its plain token. The side-quest form is not named, so unchanged.
- Verified on the rebased tree (on `origin/main` at `008dd03`): Biome clean, typecheck clean, app tests 372 passed, 4 skipped, including `apps/app/test/ui/unsentText.test.ts`. No component test renders the composer, so the drive is the only guard of the real behavior.
- Not checked: the native (phone) text field, a quest on a paired host, the side-quest form, and the owner's own use of it.
- The owner's checkout `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS` still holds a large uncommitted realm-archive batch (see its section in `documentation/work-in-progress.md`). Its own CHG-0268 realm entry in an untracked `documentation/changelog/0.1.3-Prototype.md` collides with the remote's CHG-0268 (providers merged) in that file; the fix's entry was added to the remote's file as CHG-0269.

## Decisions

- Only the fix was committed and pushed; the realm-archive batch was left uncommitted because it is unaccepted with Q12 and Q13 open.
- Approval prompts are governed by the owner's approval level, which an agent cannot change. An agent tries every command inside the sandbox first and asks to leave it only after a sandbox error.

## Next

1. Ask the owner to try it: type in a quest's box, open the Workshop, come back.
2. Whoever resumes the realm-archive batch: update the checkout to `origin/main`, resolve the changelog collision (renumber the realm entry), then continue with Q12 and Q13.
3. Optional: name the side-quest form's box, and persist unsent text across reloads (storage), if the owner wants it.

## Open questions

- Whether unsent text should also survive closing the window (owner).

## Sources

- `documentation/changelog/0.1.3-Prototype.md` (CHG-0269), `apps/app/src/ui/unsentText.ts`, `apps/app/src/ui/controls.tsx`, `documentation/verification/2026-11-14-composer-draft/drive.ts`.
