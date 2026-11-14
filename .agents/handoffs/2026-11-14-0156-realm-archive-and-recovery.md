# Handoff: Realm archive, recovery, grouped Realms overview, and the quest and Ritual choices

Supersedes: none
Workspace: ISKIOS repository, branch `main` (checked out at `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner can remove a realm by archiving it (never by deleting it), get sent to the right parent view after archiving a quest or a realm, see a Realms overview grouped by realm, and recover an archived realm by choosing its folder again. Done means the owner has looked at the running app, in dark and light, and accepted the interaction and the appearance.

## State

- **Landed.** Commits `3f6093b` (the feature, rebased onto `6adb863`) and `2739963` (CHG renumbering and the verification record) are on `origin/main`. Verified now: `git rev-parse HEAD` and `origin/main` are both `2739963`.
- **Built** (the specification and the code are under Sources): realm archive and restore with preserved lore, journals, folder and previously archived quests; archive from the realm panel and the top-right archive button; return to the parent after a quest archive and to the Realms overview after a realm archive; the grouped Realms overview and the sidebar's overview button; archived realms in the Archive with Restore; same-folder recovery with Restore, Start afresh (clears only realm-level lore through the existing recoverable deletion), and a two-column name and crest comparison; duplicate-name warnings with folder hints; a quest checklist in the archive dialog (check a quest to move it with its tree to the Borderlands, none checked by default, a quest at work cannot be checked); the realm's Rituals are switched off, kept, shown as "Realm archived", and cannot be switched on or run until the realm is restored. A Ritual's quest is no longer counted or archived as an ordinary quest.
- **Verified (the full tests were run after the rebase, on the pushed tree):** `bun run check`, `bun run typecheck`, `bun run --filter desktop build`, and `CI=1 bun run test --maxWorkers=4` pass, with 1,511 tests passed and 14 skipped. The five tests in `packages/service/test/work/realmArchiveDisposition.test.ts` failed first for the expected reasons (no `quests` or `rituals` in the preview, a Ritual archived as a quest) and pass now.
- **Not verified, do not rely on:**
  - **The window drive has not run on the final code.** `documentation/verification/2026-11-13-realm-archive/drive.ts` now also covers the checklist move and a Ritual, but the owner interrupted its launch. The checked-in screenshots, dark and light, predate the checklist, the Ritual notice and the review fixes. The dialog's checkboxes, its button label ("Archive realm, move N"), and the "Realm archived" notice on a Ritual card and panel have never been seen in a window.
  - The test that a quest at work, a quest of another realm, or a Ritual's quest cannot be moved failed before only on a missing field, so its refusal is not shown able to fail by mutation.
  - The two independent reviews (Standards, Specifications) cleared the code before the checklist and Ritual changes. The new code (`realmLifecycle.ts` archive and preview, `realmArchiveChoices.tsx`, the Ritual guards in `rituals.ts`) has not been reviewed.
  - No packaged-app, paired-device, narrow-window, native-phone, Windows or Linux check. No owner acceptance. No Delivery is recorded.
- **Local, not in git:** the backup ref `refs/rebase-backup/main` (the pre-rebase commit `a686e5a`), and the untracked folder `.expo/` with throwaway proof data. The checkout also holds another session's uncommitted harness and policy changes (`packages/service/src/harness/*`, `policy/containment.ts`, `work/approvals.ts` and their tests): they are not part of this work and must not be committed with it.

## Decisions

- Archive, never delete, a realm; Restore brings back the quests active at archive time, and quests archived earlier stay archived. Recorded in `documentation/capabilities/mission-tracking/specifications.md` (Archiving and restoring a realm) and CHG-0271.
- Folder uniqueness holds while a realm is archived: choosing its folder offers Restore, Start afresh or Cancel, never a second realm. Start afresh keeps the realm id and every old quest archived, and deletes only realm-level lore through the existing recoverable deletion. Both paths show a name and crest comparison, skipping equal rows. A blank name is the folder's name and the shuffled crest is a real proposed value. Recorded in the same specification and CHG-0271.
- Duplicate active realm names are allowed, with a confirmation and folder hints. Same place, CHG-0271.
- Quests can be moved to the Borderlands from the archive dialog; running quests cannot be chosen, because a move never stops threads. Rituals are switched off and kept, left off after Restore and Start afresh, and are not moved. The owner asked for the checklist and for a confirmation about Rituals; the unchecked default, the "at work" rule and the Ritual notice were my choices within that request, and the owner may change them. Recorded in CHG-0270.
- A new realm is made wearing exactly the crest its menu shows (upstream commit `4b26afa`); the rebase kept this by sending `shownCrestOf(editing)` through the new creation flow.
- Change numbers: upstream already used CHG-0268 (Providers) and CHG-0269 (composer text), so the realm agreement is CHG-0271 and the checklist and Ritual agreement is CHG-0270.
- Right-click actions across menus are deferred, recorded in `documentation/backlog.md`.

## Next

1. Run the window drive on disposable data and the fake harness, in dark and light, as `documentation/verification/2026-11-13-realm-archive.md` describes (build the desktop app, start Expo on port 8114, launch the throwaway Electron window, run the drive through the repository's CDP helper). Replace the stale screenshots, and record the result in that verification file. Ask the owner before launching windows if they interrupt again.
2. Ask the owner to look at the archive dialog (checklist, Ritual wording), the Realms overview, the recovery comparison and a Ritual of an archived realm, and to accept or redirect them.
3. Have the new code reviewed by independent reviewers, and show by mutation that the move refusals in `realmArchiveDisposition.test.ts` can fail.
4. When the owner accepts, record a Delivery in `documentation/changelog/0.1.3-Prototype.md` and prune `documentation/work-in-progress.md`.

## Open questions

- A Ritual whose run was stopped by the archive keeps a Stopped thread, so after a restore "Run now" says to resume it first. Should a restore resume it, or is that acceptable? The owner decides.
- Should a later batch offer moving a Ritual to the Borderlands, as quests can be moved? Not offered now.
- The owner's look decides the dialog's size and wording with many quests, and the grouped overview on small screens.
- Realms made before this batch hold no crest and draw an id-derived default (see the crest-mismatch handoff); the owner has not said whether to change them.

## Sources

- `documentation/capabilities/mission-tracking/specifications.md` (Archiving and restoring a realm, Reusing an archived realm's folder, Realm names, Realms overview)
- `documentation/changelog/0.1.3-Prototype.md` (CHG-0270, CHG-0271)
- `documentation/work-in-progress.md`, section "Realm archive, recovery, and grouped overview"
- `documentation/verification/2026-11-13-realm-archive.md` and `documentation/verification/2026-11-13-realm-archive/` (drive script and screenshots)
- `packages/service/src/work/realmLifecycle.ts`, `realmAccess.ts`, `realmHandlers.ts`, `rituals.ts`; `packages/contracts/src/realmRequests.ts`
- `apps/app/src/realms/realmArchiveAction.tsx`, `realmArchiveChoices.tsx`, `realmRecoveryModal.tsx`, `newRealmModal.tsx`; `apps/app/src/shell/realmsPage.tsx`, `archivePage.tsx`
- Tests: `packages/service/test/work/realm*.test.ts`, `apps/app/test/realms/`
- Commits `3f6093b` and `2739963`; `AGENTS.md` for the project rules (including the Git guard and the pre-push hook)
