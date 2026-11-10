# Handoff: source files grouped into folders

Supersedes: none
Workspace: Gild repository (`/Users/dgerrits/Codelab/Dyrits/CANOPY`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked for a better file structure than every file in `src`, then to apply all recommendations of the architecture audit of 2026-11-10 21:19. Done means the service and the app are grouped into folders that follow the import graph, tests mirror them, and the rules are written down.

## State

- Done and verified (proof: `documentation/verification/2026-11-10-source-folders.md`, rerun from a clean shell): `packages/service/src` is split into `core/`, `harness/`, `lore/`, `policy/`, `work/` plus four entry files in `src/`; the four leaf folders have an `index.ts` exporting only what other folders import; no leaf folder imports `work/`. `apps/app/src` is split into 13 folders in one downward chain (`foundation, attachments, terminal, ui, editors, crest, realms, rituals, quests, lore, conversation, settings, shell`) with no `index.ts`. Tests mirror the folders under `test/<folder>/`, shared fixtures stay in `test/fixtures/`. The check script is `documentation/verification/2026-11-10-source-folders/check-layout.py`, shown able to fail by five mutations.
- Verified with commands: `bun run test --maxWorkers=4` 647 passed and 10 skipped (live) on the end state and on the starting commit `d421b47`; `bun run typecheck` and `bun run check` pass; the desktop `bun build` of the service and main process and `expo export --platform web` bundle.
- Code changes beyond moving files: `tokensOf`, `wordsOf`, `ToolAnswer` moved to `core/`; the tool-name constants to `harness/toolNames.ts`; `ThreadAccess` (in `core/execution.ts`) gained `unaskedTools`, set in `work/threads.ts` and used by `harness/claudeArgs.ts` (`baseArgsOf`); the shell's context hooks moved to `foundation/shellContext.tsx`; `require("../../assets/…")` paths fixed in `ui/banner.tsx`, `ui/sketches.tsx`, `quests/questPanel.tsx`; two `import.meta.dirname` fixture paths in the harness tests.
- Documentation written: CHG-0125 in `documentation/changelog.md`, a Layout section in `documentation/conventions.md`, a Source layout note in `documentation/architecture.md`, and an Outcome section in the audit report. Bare file names in the other documents are unchanged and still find their file.
- Committed and pushed to `main` in the one commit that adds this file (assumed until you run `git log -1 -- .agents/handoffs/` and `git status`).
- Not verified: the running app was not driven after the move, so its look and behavior are unproven (claim C6 in the proof).
- Known and pre-existing: the default `bun run test` times out on about 5 service tests under full parallel load (`harnesses.test.ts`, `loreOverTime.test.ts`, `loreProposals.test.ts`), also on the unmoved `d421b47`; they pass alone and with `--maxWorkers=4`.

## Decisions

- Candidate 2 of the audit (splitting `work/`, 41 files that call each other in a ring) was not applied: the audit advised against it until `work/` is deepened. Recorded in CHG-0125.
- The `spend` folder of the audit's diagram was dropped; the budget modules stay in `work/` because they call `commands` and `lifecycle`; `spending` lives in `core/`.
- The app has no per-folder `index.ts`: components import each other directly. Recorded in the audit's Outcome section.
- A folder's `index.ts` is its interface; inside a folder files import siblings directly so loading never loops through the index. Recorded in `documentation/conventions.md` (Layout).

## Next

1. Run `bun run dev` and look at the board, a quest, the Guildmaster, the Charter, and a Ritual to settle claim C6; report to the owner.
2. Ask the owner whether to deepen `work/` (audit candidate 2) and, if so, start with the thread tree and quest seams named in the audit's card.
3. Decide with the owner what to do about the default test run's timeouts under load (raise the 5-second test timeout or cap workers in `vitest.config.ts`).

## Open questions

- Does the owner want `index.ts` files for the app folders after all? The owner decides.
- Rotate the service-account key that sits in the untracked `.tmp.md` in the repository root, and delete or ignore that file: it is not committed and must not be. The owner decides.
- Another session's compact left navigation work (CHG-0123 and CHG-0124, its specifications, verification, and code in the sidebar, shell, and conversation) was in the same working tree and went into the same commit at the owner's choice; its look still awaits the owner's review in the running app.
