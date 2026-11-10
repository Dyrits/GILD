# Handoff: installed app (.dmg) and full-project review fixes

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `main` at `049729b` when written; the work is committed on a branch (see State)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Two strands. (1) The owner runs an installed Gild (`.app` in a `.dmg`, built by `bun run package`) apart from `bun run dev`, which runs as "Gild Dev". (2) Finish the interrupted full-project review-and-refactor ("Fix everything you can"), then record it.

## State

- Installed app, verified this session: `bun run package` builds `apps/desktop/release/Gild-0.1.0-arm64.dmg` (128 MB); `hdiutil verify` and `codesign --verify --deep --strict` pass; launched from the mounted image on a throwaway `GILD_DATA_DIR` with a minimal PATH, the window loaded `gild-app://app/`, the service had the login shell's PATH, and a terminal opened. Proof: `documentation/verification/2026-11-10-installed-app.md`. Not opened on the owner's real `Gild` data; not notarized; no live harness turn from the installed app.
- Fixes made while verifying (each test first): `identity: "-"` and `hardenedRuntime: false` in `apps/desktop/electron-builder.yml`; `apps/desktop/src/shellPath.ts` (login-shell PATH, used in `main.ts` when packaged); `unpackedPathOf` in `apps/desktop/src/terminals.ts`.
- Review fixes, verified by `bun run typecheck` (4 packages), `biome check .` (311 files), and `bun run test` (644 passed, 10 skipped). Three tests (two in `harnesses.test.ts`, `loreOverTime.test.ts`) time out under the full run but pass alone; the same flakes occurred without these changes.
  - Done: STD-01, 02, 04 to 09, 10 (`sidebar.tsx` split into `railStorage.ts`, `topBar.tsx`, `shell.tsx`), 11 (folded Rituals remembered), 12 (`records.ts`); S-01 (handover names images), S-02 (Guildmaster quest states), S-03 (global budget lines in the Guildmaster's quest) and three test gaps.
  - Not done: S-04 (feature work), S-05, S-06, S-07, S-08, and the stale handover-spec note (see Open questions). The service `as` casts (STD-03) stay: removing them exposed real mismatches.
- The review's original reports live only in Gild's database (`~/Library/Application Support/Gild/gild.sqlite`, quest "Review and refactor full project", parent thread messages 11 and 14); assumed still there.
- `.tmp.md` (untracked) holds a live GCP private key; it must never be committed. Stage by explicit path only.
- Biome fails repo-wide if a nested git worktree sits under `.claude/worktrees/`; none remains.

## Decisions

- Only a packaged app without `GILD_DATA_DIR` is "Gild" on the default data folder; everything else is "Gild Dev" (ADR 0013, CHG-0122).
- Never start, stop or open an instance on the owner's `Gild` data; stop test instances by process id only.
- Review fixes that change behavior go test-first; S-04 is not built until the owner decides.
- Commit to a branch, not `main`; a push to `main` needs the owner's approval (`.githooks/pre-push`).

## Next

1. Confirm with the owner whether the commit went to a branch and whether to push or merge to `main`.
2. Append a changelog record for the review fixes (the installed app is CHG-0122, already updated).
3. Ask the owner to pick a review-history workspace (a named one or `repository-only`), then record the review run.
4. Get the owner's answers on S-04 to S-08 and act on them.
5. The owner quits any old Gild, installs from the `.dmg`, and looks at the app.

## Open questions

- S-04: build the unbuilt workspace-attachment behaviors (`clone_repository`, own copy with merge, hide and delete) or mark them staged? Owner decides.
- S-05 (OpenCode image support is never read from the agent) and S-06 (automatic fallbacks skip the image refusal): needs plumbing and an agreement on S-05.
- S-07 (depth and running limits adjustable), S-08 (a Ritual's realm editable), and whether the thread-handover specification's "Guildmaster not built" note is stale: owner decides.
- Rotate the exposed GCP key in `.tmp.md`: owner.

## Sources

- `documentation/changelog.md` (CHG-0122), `documentation/architecture-decision-record/0013-installed-app-apart-from-development.md`
- `documentation/verification/2026-11-10-installed-app.md`
- `apps/desktop/electron-builder.yml`, `apps/desktop/scripts/package.ts`, `apps/desktop/src/shellPath.ts`, `apps/desktop/src/terminals.ts`
- `documentation/conventions.md`, `documentation/work-in-progress.md`
