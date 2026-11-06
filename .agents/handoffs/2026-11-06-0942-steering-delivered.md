# Handoff: batch 6 delivered, interrupts and steering; choose batch 7

Supersedes: `2026-11-06-0935-steering.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Batch 6 is delivered. Next: choose and agree batch 7 with the owner, then build it the same way (agreement record, test-first, proof, owner's look, Delivery record).

## State

- Batch 6 (interrupts and steering) is agreed (CHG-0039), built test-first, driven in the window, accepted by the owner, and recorded as delivered (CHG-0040); work-in-progress marks it delivered. Verified by reading `documentation/changelog.md` and `documentation/work-in-progress.md`.
- Proof: `documentation/verification/2026-11-06-steering.md`, with screenshots and `mutations.txt` (8 of 8 mutations caught; 102 passed once restored). Verified by reading both.
- `OPENMISSION_LIVE_CLAUDE=1 bun run test` passed 107 of 107 at about 09:25; typecheck, Biome, and the desktop build passed. Verified by command output in this session.
- The window was driven on `OPENMISSION_HARNESS=fake`: Claude Code hit its session limit at about 09:30 ("resets 12pm (Europe/Paris)"). A real Claude turn has not been steered or interrupted in the window. The drive's Electron and Metro (port 8082) are stopped.
- The owner's `bun run dev` (pid 13001) still runs the batch 5 service bundle; it needs a restart to run batch 6. Assumed still running.
- Committed and pushed to `main` with this handoff, on the owner's instruction. Assumed until `git log origin/main` shows it.

## Decisions

- Batch 6 choices (Send + Queue button, Interrupt in the composer, Waiting when threads beneath run) and the Claude Code mechanism: recorded in CHG-0039.
- A steered message Claude Code has not taken in by the turn's end closes its process so it is not run unseen; it is sent again at the next turn. Provisional; recorded in work-in-progress (Batch 6, Provisional).
- `SendMessage.delivery` is required and nullable (null uses the owner's default), following `documentation/conventions.md` on absence.
- Settings saved before a field existed read that field's default (`packages/service/src/settings.ts`), so no settings migration is needed for new fields.
- Driving the window: start a separate Metro without `CI=1` on another port and point Electron at it with `OPENMISSION_APP_URL`; the data folder given by `OPENMISSION_DATA_DIR` must exist; Playwright CLI clicks land after focusing the window through `documentation/verification/2026-11-06-batch-4-drive/main-eval.ts`; buttons that ignore a click are reached with Enter in the text box.
- Carried over: work proceeds in batches; pushes to `main` need the owner's approval each time.

## Next

1. Ask the owner which batch 7 to build: the remaining staged thread-tree and thread-messaging items (folding agent threads, deleting, the chatter guard, journal in starting context, `@` references), or an item from `documentation/backlog.md`.
2. Optionally, after Claude Code's limit resets, drive one real Claude turn steered and interrupted in the window and add it to the batch 6 proof's Not verified list as checked, in a new proof note.
3. Refactor candidates before they grow further: `packages/service/src/threads.ts` (about 405 lines) and `packages/service/src/claude.ts` (about 423 lines) are past the conventions' ~250-line split point; steering could move to its own module.

## Open questions

- Whether the closing race (a message the model may see twice) needs handling. The owner decides if it shows up.
- Carried over: `--setting-sources project` for workspaces, the side tree on a phone, `.zcode/` untracked, a narrower Claude Code environment, the packaged desktop build, and the questions at the end of `documentation/work-in-progress.md`.

## Sources

- `documentation/changelog.md` (CHG-0039, CHG-0040)
- `documentation/work-in-progress.md` (Batch 6)
- `documentation/verification/2026-11-06-steering.md` and `documentation/verification/2026-11-06-steering/`
- `documentation/capabilities/thread-messaging/specifications.md`, `documentation/backlog.md`
- `packages/service/test/steering.test.ts`, `packages/service/test/claude.test.ts`
- Repository: https://github.com/Dyrits/OPEN-MISSION
