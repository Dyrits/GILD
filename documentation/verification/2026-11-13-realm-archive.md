# Realm archive, recovery, and grouped overview

Starting revision: `b6e03247c1caeab64a0eacdaf5d7e79dc99c2518`.
Agreement: [CHG-0268](../changelog/0.1.3-Prototype.md#chg-0268--2026-11-13--realm-archive-recovery-and-the-realms-overview) and [mission-tracking behavior](../capabilities/mission-tracking/specifications.md#archiving-and-restoring-a-realm).
Status: built and checked for the original agreement; review fixes implemented; owner acceptance and the new content-disposition decisions remain open. No Delivery is claimed.

## Checks run

- `bun run check`: passes.
- `bun run typecheck`: passes in all workspaces.
- `bun run --filter desktop build`: passes.
- Final completed `CI=1 bun run test --maxWorkers=4`: **1,500 passed, 14 skipped; 140 files passed, one skipped**, in 90.31 seconds on Electron's Node runtime.
- `git diff --check`: passes.
- Focused tests cover realm archive/restore, old individual archives, running descendants, stale quest and lore previews, refusal of implicit archived-folder reuse, same-id fresh recovery, recoverable deletion of realm lore without deleting quest lore, duplicate-name acknowledgement, persistence through a service restart, and the additive migration on a realm saved before archive support.
- New review regressions were observed red before their corrections: adding an idle ninth side-quest behind the eight-running limit must stale a realm confirmation; archiving a quest moved after its ending preview must return its current parent; Iskios must ask before accepting duplicate realm names even when the owner named the action exactly.
- Plain app tests cover name/crest comparisons, mixed picks, folder-name fallback, duplicate labels, post-archive parent selection, and the recovery flow's ordering, equality skipping, cancellation, duplicate acknowledgement, and stale-preview restart.

The installed Bun is **1.4.3**, not the README/CI pin of 1.4.4. No dependency or runtime upgrade was made.

## The interrupted full rerun

After the review corrections, one full run was lost when its background terminal became unavailable. A subsequent foreground run was cut off at its 120-second terminal limit and had 20-second test timeouts during migrations in `steering.test.ts` and `work/threads.test.ts`.

The host then reported an uptime of six minutes and load averages of **40.15, 120.91, 73.26** on ten CPUs. The same two test files passed without retries in **3.81 seconds** (28 tests), without a production-code change. The next complete full run, with a 240-second terminal allowance, passed in 90.31 seconds as recorded above. No Vitest timeout, retry policy, or assertion was weakened. This supports an environmental-load explanation rather than establishing a new admission regression; the interrupted run is not counted as a passing check.

## Desktop evidence

Aside could list the owner's browser tabs but cannot attach to the Electron window's preload bridge. The check therefore reused the repository's existing CDP helper with a throwaway Electron window and disposable data, on the fake harness. No paid provider turn or installed-app data was used.

The [drive](2026-11-13-realm-archive/drive.ts) passed all four groups in both dark and light:

1. Quest archive returns to its realm or the Borderlands.
2. Realm archive confirms, Cancel changes nothing, running work is stopped, and success returns to Realms.
3. Restoring the realm does not reopen quests individually archived earlier.
4. Reusing an archived folder keeps the realm id, offers independent name/crest picks, makes no change on Cancel, and clears only realm lore after the final confirmation.

Screens inspected:

- [Dark grouped Realms overview](2026-11-13-realm-archive/screens/realms-grouped.png).
- [Dark realm archive confirmation](2026-11-13-realm-archive/screens/archive-confirmation.png).
- [Light grouped Realms overview](2026-11-13-realm-archive/screens/light/realms-grouped.png).
- [Light independent name/crest comparison](2026-11-13-realm-archive/screens/light/recovery-comparison.png).

These window drives precede the review corrections and structural refactors. The final source's full tests, typecheck, and desktop build pass, but **the window drive must be repeated on that source and after any approved content-disposition changes**. The owner has not accepted the appearance or interaction.

The first attempts exposed two driver issues, not a passing product check: imports were resolved from the wrong workspace, and the driver clicked Archive before the fake lore turn became idle. The drive now resolves the installed contracts/Effect, waits on observable idle state, parenthesizes presence predicates, and waits for finite UI animations before screenshots.

### Repeating the drive

Use fresh, disposable data on each full run; the drive creates fixtures and deliberately preserves them for inspection.

```sh
bun run --filter desktop build
cd apps/app && BROWSER=none bunx expo start --port 8114
```

In another terminal, from the repository root:

```sh
ISKIOS_DATA_DIR="$PWD/.expo/realm-archive-proof-data-new" ISKIOS_HARNESS=fake \
ISKIOS_APP_URL=http://127.0.0.1:8114 \
node_modules/.bin/electron --remote-debugging-port=9364 apps/desktop/dist/main.js
```

Then:

```sh
bun documentation/verification/2026-11-13-computer-name-and-companions/scripts/cdp.ts \
  9364 "$PWD/documentation/verification/2026-11-13-realm-archive/drive.ts" \
  "$PWD/documentation/verification/2026-11-13-realm-archive/screens" \
  "$PWD/.expo/realm-proof-folder"
```

For light, use a new data directory and prefix the last command with `ISKIOS_PROOF_LOOK=light`; choose a different screenshot directory. This switches the throwaway app through Workshop → Look and feel → Light.

## Review dispositions

### Standards

Reviewer: `ksQQZB6WMyCYTN-gpio-GcIS6pLOAA9yU5IBxBD4Hb2XjQRLFolB9uuuDumM`. All five findings were accepted and re-verified as **resolved** by the same reviewer on the actual parent checkout, with no introduced regression or open Standards finding. Their independent read-only checks passed `git diff --check` and 24 focused tests across recovery flow, thread admission/lifecycle, and Iskios duplicate-name confirmation. The final running-window proof remains a separate gap.

- **STD-1:** extracted exhaustive destination rendering to `shell/appScreen.tsx`, using a typed `Record<Place, ReactNode>` rather than extending the old switch. `App.tsx` is now 229 lines rather than the initial 308.
- **STD-2:** moved turn admission and its data shape to `work/turnAdmission.ts`; `turns.ts` is now 217 lines rather than 313.
- **STD-3:** extracted the creation decision and recovery event/state transitions to `realms/realmRecoveryFlow.ts`, with seven plain tests. The component renders the flow and performs its requests.
- **STD-4:** consolidated folder-name, collision, and label rules in `realms/realmLabels.ts`; removed duplicate parsing from the new-realm modal.
- **STD-5:** renamed the recent migration module to `core/recentStoreMigrations.ts`, since it also holds migration 0045 for account labels. No migration identifier or SQL changed in the rename.

The Iskios duplicate-name correction also extracted realm-specific action derivation from the oversized provenance module into `work/realmActions.ts`.

### Specifications

Reviewer: `ksQQZB6WMyCYTN-gpio-GcIS6pLOAA9yRpIBxBD4Hb2XjQRLFolB9uuuDumM`. All three defects were accepted, corrected with regression tests, and re-verified as **resolved** by the same reviewer on the actual parent checkout. They found no supported regression in the corrections/refactors and independently passed 19 tests across four focused files plus `git diff --check`. DECISION-1 remains open; final-source window verification and owner acceptance remain separate requirements.

- **SPEC-1:** the confirmation digest now covers all descendant identities, parentage, states, generations, and workspace attachments, including idle descendants, rather than only working ids.
- **SPEC-2:** `EndMission` returns the quest's current parent placement from its transaction; successful archive navigation uses that result rather than the summary captured when the dialog opened.
- **SPEC-3:** duplicate names are confirmable through Iskios's existing provenance/receipt flow, with a warning that always asks even for an exactly named owner request. Deny changes nothing. Previously blocking expectations were updated; folder uniqueness and ambiguous-target refusal remain.
- **DECISION-1:** realm/Ritual behavior is not settled. The owner asked for explicit confirmation and suggested offering to move quests to the Borderlands instead of archiving them. Q12 and Q13 are pending, recorded in working state. Do not treat the current incidental handling of Ritual backing quests as approved behavior.

## Remaining limits

- No owner visual/interaction acceptance.
- Repeat the running-window proof after the review corrections and after the content-disposition choices.
- No packaged-app, paired-device UI, narrow-window, native-phone, or Windows/Linux drive.
- The existing nested-button warnings in the sidebar remain. They were not introduced or fixed by this batch.
- No commit, push, tag, release, or landing was performed at this checkpoint.
