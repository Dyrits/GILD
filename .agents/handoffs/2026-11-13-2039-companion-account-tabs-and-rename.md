# Handoff: Companion picker tabs per account, and renaming accounts

Supersedes: `2026-11-13-1745-panel-ownership-and-follow-ups.md`
Workspace: ISKIOS, branch `main`, Delta worktree `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS/.delta/worktrees/h637a9v6ncrk/ISKIOS`; starting commit `170a43c`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants the Companion selection based on provider account (two Claude subscriptions show as two options) and every account renamable apart from the computer's name. Done means the owner has seen both in a window and accepted or redirected them.

## State

- Built, from the starting commit `170a43c`, as CHG-0264 and CHG-0265 in `documentation/changelog.md`; the work is committed at the end of this session (read `git log` for the hash). Verified by running now: `bun run typecheck`, `bunx biome check .` clean, and `bun run test` 1,413 passed, 14 skipped.
- Picker: one tab per harness account, each with that account's own models; choosing a model sets harness, account and model (`apps/app/src/editors/accountModels.ts`, `companionBody.tsx`, `runners.tsx`). `AccountStatus.models` (optional) is read per signed-in account by `packages/service/src/work/accounts.ts`. Verified by the tests in `apps/app/test/editors/accountModels.test.ts` and `packages/service/test/harness/harnesses.test.ts`.
- Renaming: Rename on each Accounts row (`apps/app/src/settings/accounts.tsx`); a harness's own sign-in has its own per-harness name (`RenameOwnAccount`, table `own_account_labels`, migration 0045), falling back to the host's name. Verified by a service test only.
- Shared harness list: `useHarnesses` in `runners.tsx` now keeps one list per host connection, because the owner saw a rename need a refresh to show elsewhere. Assumed, not verified: it fixes the owner's report. Only typecheck covers it; no hook test exists and it was not driven in a window.
- Not checked at all: the tabs and rename controls in a window (look, wrapping with several or long account names, light and Gild looks), a real second subscription with differing model lists, a paired device, the phone build, the usage page's names after a rename.
- The working tree had `bun install` run in it (dependencies were absent); nothing from that is committed.

## Decisions

- The picker's tabs are per account, replacing the Account menu in the Companions tab, backups and presets. The Workshop's default Companion keeps showing each harness's own sign-in only, because it has no account field (CHG-0257); this was chosen by the implementation, not the owner. Recorded in the provider-accounts specification and CHG-0264.
- Own sign-in names are per harness, not one name for all; a blank name returns to the host's name. Chosen by the implementation (CHG-0265); the owner has not confirmed.
- The owner's wording is quoted in the specification and changelog; do not treat the two choices above as the owner's.

## Next

1. Ask the owner to restart `bun run dev` and look at the account tabs and the rename controls, including renaming while the Companions tab is open (the refresh report).
2. If the shared list did not fix the stale name, find which screen still holds its own copy (grep `ListHarnesses` and `useServiceQuery` readers of account names).
3. Settle with the owner the two implementation choices above, and whether the Workshop's default Companion should gain an account.
4. Then the backlog's slow model lists item: reading a list per signed-in account makes the first open slower, so reading ahead matters more now.

## Open questions

- Owner: should the Workshop's default Companion be able to name an account?
- Owner: one name for a computer's sign-ins, or per harness as built?
- Owner: how the tabs look with many or long account names.
- Whether the sync to the original checkout and the push to GitHub `main` happened: read live refs; this file was written before them.

## Sources

- `documentation/changelog.md`, CHG-0264 and CHG-0265; `documentation/capabilities/provider-accounts/specifications.md`; `documentation/backlog.md`; `documentation/work-in-progress.md`.
- `apps/app/src/editors/accountModels.ts`, `companionBody.tsx`, `runners.tsx`, `apps/app/src/settings/accounts.tsx`; `packages/service/src/work/accounts.ts`, `packages/service/src/remote/hostAccess.ts`, `packages/service/src/core/store.ts`.
- Tests: `apps/app/test/editors/accountModels.test.ts`, `packages/service/test/harness/harnesses.test.ts`.
- Superseded handoff: `.agents/handoffs/2026-11-13-1745-panel-ownership-and-follow-ups.md`.
