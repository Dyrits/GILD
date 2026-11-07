# Handoff: review, refactor, and architecture pass

Supersedes: none
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked for a standards and specifications review of the whole project, with the refactors and simplifications that keep the conventions, and then for all six candidates of the architecture audit, documented. This work is committed and pushed to `origin/main` in one commit, recorded as CHG-0062. The behavior changes still need the owner's acceptance, and the Specifications findings still need implementing.

## State

- **Done (CHG-0062):**
  - the review refactors;
  - harness processes (`harnessProcesses.ts`, `lineProcess.ts`; `rpcProcess.ts` removed);
  - `askOwner` on each turn, so Codex and OpenCode prompts reach Approvals in-process;
  - the harness registry (`harnesses.ts`);
  - the intel store (`intelStore.ts`, `intelDecisions.ts`);
  - the starting-context module (`startingContext.ts`, `turns.ts`);
  - the command runner (`commands.ts`).

  All of it is in `packages/service/src/`, with tests in `packages/service/test/`.
- **Verified by command output on 2026-11-07, before the commit:**
  - `bun run test`: 371 passed and 8 skipped, twice in a row (the baseline at `26bbb1d` was 339);
  - `bun run typecheck`, `bun run check`, `git diff --check` and `apps/desktop` `bun run build` passed;
  - the bundled service started on the fake harness.

  The steps are recorded in `documentation/verification/2026-11-07-architecture-pass.md`.
- **Assumed, not verified:**
  - the app behaves as before when driven in the window;
  - the live harnesses (Claude Code, Codex, OpenCode) behave as their stand-ins do.

  Neither was run.
- **Push:** `origin/main` should hold this commit. Check with `git log origin/main -1`; before the commit it was at `26bbb1d`.
- **Untracked, owned by the owner:** `.zcode/` stays untracked.

## Decisions

- **Scope.** "The full project" was read as every tracked file at `26bbb1d`, reviewed from the empty tree.
- **Specifications findings.** None of the 16 was changed. Each needs a behavior change, so each goes back to test-first implementation. They are listed in `documentation/work-in-progress.md`, in the section "Review, refactor, and architecture pass".
- **Review findings dismissed:**
  - a shared app hook for request errors: one-line handlers, and the 13 screens have no tests;
  - wrapping `ownerRulesOf` in its own Effect: it already runs inside the turn, and `userSettingsPath` is its seam;
  - renaming `Toggle`'s `value`: it is forwarded to React Native's `Switch`.

  The verification scripts that still import `fixtures/batch7.ts` were deliberately left: they run in checkouts of past revisions.
- **Intel deletions.** Only the owner's deletion declines awaiting changes. The difference is kept, now encoded once by actor in `intelStore.ts`.
- **Starting-context size.** The size now counts the fixed instructions, which reverses a provisional Batch 17 choice. It is recorded as awaiting the owner, in work-in-progress (Batch 17) and in CHG-0062.

## Next

1. Show the owner CHG-0062's list of behavior changes and get their acceptance or reversal.
2. Ask the owner whether every intel deletion should decline its awaiting changes.
3. Drive the app in the window: a mission, a thread beneath with the starting-context preview, the intel panel with undo, and a Stop. Then run one live Claude Code mission that changes a thread's model, to confirm it restarts and resumes.
4. Implement the High Specifications findings test-first:
   - the quote check (`approvals.ts`);
   - shell-wrapped commands skipping the sensitive list (`patterns.ts`), after a live Codex probe.

## Open questions

- Does the owner accept the CHG-0062 behavior changes? The owner decides.
- Should every intel deletion decline its awaiting changes? The owner decides.
- Which glossary term should name the harness, account, model and effort bundle that the code calls "runner"? The glossary says to avoid "runner". The owner decides.
- Do the widened sandbox hosts let `git push` or `npm publish` run unasked? A live probe answers it; the owner then decides.

## Sources

- `documentation/changelog.md` (CHG-0062)
- `documentation/work-in-progress.md`, section "Review, refactor, and architecture pass", and Batches 17–18
- `documentation/architecture.md`, section "Inside the local service (as built)"
- `documentation/architecture-audit/architecture-audit-2026-11-07-1830.html`
- `documentation/verification/2026-11-07-architecture-pass.md`
- `documentation/conventions.md`
