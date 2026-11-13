# Companion preset stacks · 2026-11-13

## Outcome

The three tier presets now copy their primary Companion and ordered backups together. The owner rejected the primary-only CHG-0258; this check covers the correction in CHG-0260, starting at `b526f74`.

Implemented and checked, not yet visually accepted by the owner. All provider execution used the fake harness or the suite's existing stand-ins. No paid model call, relay publication, or ordinary application data was used.

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Formatting and lint | `bun run check` | Pass |
| Workspace types | `bun run typecheck` | Pass, six workspaces |
| Full suite | `bun run test` | 1,385 passed, 14 skipped at first (Electron's Node, per the implementer); rerun on plain Node after the review fixes, see the last section |
| Desktop build | `bun run --filter desktop build` | Pass |
| Web export | From `apps/app`: `bunx expo export --platform web --output-dir "$DELTA_SCRATCH_DIR/preset-web"` | Pass |
| Window drive | `bun documentation/verification/2026-11-13-companion-stacks/drive.ts 9357 "$DELTA_SCRATCH_DIR/preset-shots"` | Pass, all five logged checks, on the layout before the owner's change (not rerun since) |

The earlier primary-only tests did not prove the requested behavior. Added tests failed before the fixes: an empty preset omitted `backups`, stack selection compared only primaries, a draft side-quest inherited its parent's backups instead of the chosen preset's, and a proposed tier lost its backups when its primary matched Default.

Current regression coverage:

- `apps/app/test/editors/presets.test.ts`: tier ordering and unset tiers, complete-stack copying, explicit empty lists, ordered-backup comparison, account and effort matching.
- `apps/app/test/conversation/suggestionChoices.test.ts`: Default and a tier with the same primary but different backups are distinct choices.
- `packages/service/test/presets.test.ts`: persistence, five-backup limit, old saved tiers without a `backups` field, per-tier settings changes. `packages/service/test/work/presetStacks.test.ts`: atomic primary/backup changes, same-primary changes, empty-list clearing, running-thread refusal, invalid-account rollback, draft side-quest copying and clearing without changing its parent, and fallback after the chosen primary fails.
- `packages/service/test/work/suggestionBackups.test.ts` (moved from offTopic.test.ts): a quest opened from a card takes the supplied backups, keeps the default list when the card sends none or sends the default list (even with a removed account), and is refused and rolled back when a supplied backup names a missing account.
- `packages/service/test/work/guildmasterPresets.test.ts` (moved from guildmaster.test.ts): a proposed tier carries its stack even with the default primary; a Ritual created on a tier takes its backups as fallbacks and says so in its approval question.

The full suite was rerun after the radio controls and the two additional fallback/empty-side-quest checks. A final small helper-parameter naming cleanup was also checked by the focused preset suites and typecheck.

## Window drive

Aside's profile was not connected to its daemon. Used Electron's DevTools protocol instead, with the exported web build, fake harness, and a new data directory beneath the turn's scratch directory. The [driver](2026-11-13-companion-stacks/drive.ts) seeds only that throwaway service and checks its stored answers after UI actions.

Observed:

1. In Workshop > Companions > Presets > Heavy, two backup folds appear. Adding a third saves it and updates the page's table to "3 backups".
2. Choosing Heavy on a new quest changes its primary to Opus at high effort and installs all three backups. Unset Balanced is absent. Heavy is checked only after the complete stack matches.
3. Choosing Light, which has no backups, removes all three.
4. Choosing Heavy again, then editing its definition to one backup, leaves the quest's three backups unchanged. The chooser updates to one backup and no longer marks the quest as matching Heavy.
5. Opening a draft side-quest, choosing the revised Heavy, and sending its first message creates it with one backup. Its parent still has three.

Screens:

- [Workshop preset editor](2026-11-13-companion-stacks/screens/workshop-preset-backups.png)
- [Quest with the complete stack](2026-11-13-companion-stacks/screens/quest-whole-stack.png)
- [Light clears the backup list](2026-11-13-companion-stacks/screens/quest-empty-stack.png)
- [Copied values do not follow preset edits](2026-11-13-companion-stacks/screens/quest-copied-not-linked.png)
- [Side-quest after sending](2026-11-13-companion-stacks/screens/side-quest-preset.png)

The first window check exposed that `accessibilityState` alone did not emit the checked attribute in this web build. The preset controls now use radios with explicit `aria-checked`; the by-hand disclosure has explicit `aria-expanded`. Choosing a preset folded away the manual model browser; that layout was replaced on the owner's request (see the layout change below).

## Reproduce

From the repository root, use a fresh scratch directory and separate shells for the server and Electron:

```sh
bun run check
bun run typecheck
bun run test
bun run --filter desktop build
cd apps/app
bunx expo export --platform web --output-dir "$DELTA_SCRATCH_DIR/preset-web"
```

From the root in another shell:

```sh
python3 -m http.server 8107 --bind 127.0.0.1 --directory "$DELTA_SCRATCH_DIR/preset-web"
```

From the root in another shell:

```sh
ISKIOS_DATA_DIR="$DELTA_SCRATCH_DIR/preset-data" \
ISKIOS_HARNESS=fake ISKIOS_APP_URL=http://127.0.0.1:8107 \
node_modules/.bin/electron --remote-debugging-port=9357 apps/desktop/dist/main.js
```

Then run the driver command from the table. It reloads the page, sets only the throwaway service's Light and Heavy presets, adds a new empty quest, and drives its controls. Stop the throwaway Electron and static server afterward. Outside Delta, replace `$DELTA_SCRATCH_DIR` with an absolute temporary directory of your own.

## Limits and remaining review

- Appearance still needs the owner's acceptance.
- The light desktop window was driven at 1200×800. The Workshop's existing squeezed-card layout is still visible there; the narrow-window/mobile pass remains in the backlog.
- Dark mode, a phone, a paired device, a packaged installer, and real provider failures were not checked in this batch.
- Custom preset names, Save as a preset, unavailable-preset reasons, and the owner's Ritual-form preset chooser remain deferred.
- The full suite passes, but this was not a fresh-context independent review. The CHG-0259 conventions arrived during verification; the recorded oversized-file debt was not swept here.

## Layout change after the owner's review

The owner found the presets inside the Companion fold confusing and asked for the preset selection above the Companion choice. The presets now sit in a "Preset" card above the Companion fold, which holds the by-hand picker alone (`editors/presetChooser.tsx`). Checked after the change: typecheck, Biome, and the app suite (341 passed, 4 skipped). Not driven in a window: this worktree has no Electron binary, so the screenshots and `drive.ts` above predate the layout and the drive's steps are unrun against it.

## After the review fixes (CHG-0261)

Run in plain Node on this worktree: `bun run check`, `bun run typecheck`, `node node_modules/vitest/vitest.mjs run`: pass, 1,397 tests passed and 14 skipped. Tests added or changed for the fixes: an off-topic card keeps the default backups even when one names a removed account (failed before the fix); a card naming a backup on a missing account opens no quest and the rollback leaves one quest; a refusal keeps an existing backup list; a change naming one tier keeps the others; the approval question names a Ritual's fallbacks, and none when Iskios names its own Companion; backup lists and preset lists compare by whole stack. Not rerun: the window drive and screenshots above, which show the earlier layout.

Size: after the second round of fixes no file the change touched is larger than at the start except `work/suggestions.ts` (314 to 315 lines, an import); `contracts/requests.ts` (726), `service.ts` (701), `shell.tsx` (509) and `test/work/guildmaster.test.ts` (1,189) shrank and remain past 512. No new file is past 256. A Default or no-tier proposal on Iskios's card now sends the default list, which the service leaves unchecked (tested in `work/suggestionBackups.test.ts`).

## Proof by mutation (verify, after the second round of fixes)

Method: a separate worktree of the end state (the uncommitted diff applied, new files copied, dependencies installed), one line of production code broken at a time, the test that covers it run, the file restored. [`mutations.py`](2026-11-13-companion-stacks/mutations.py) holds the eight mutations and runs them: `git worktree add <path> HEAD`, apply the diff and copy the untracked files, `bun install --frozen-lockfile`, then `python3 documentation/verification/2026-11-13-companion-stacks/mutations.py <path>`. Baseline in the worktree: the preset service tests pass before any mutation. Result of the run (13 November 2026, plain Node): all eight fail as they must.

| Claim | Mutation | Test that fails |
| --- | --- | --- |
| A card with the default list, or none, opens a quest even with a removed account in that list | the default list is checked again | `work/suggestionBackups.test.ts` |
| A settings change replaces only the tiers it names | every tier is replaced | `presets.test.ts` |
| Choosing a preset stores its backups | the backups are not stored | `work/presetStacks.test.ts` |
| A side-quest opened with a preset takes its stack, not the parent's | it always inherits | `work/presetStacks.test.ts` |
| A preset is marked chosen only when the whole ordered stack matches | primary compared alone | `apps/app/test/editors/presets.test.ts` |
| A Ritual Iskios creates on a tier takes the tier's backups as fallbacks | no fallbacks | `work/guildmasterPresets.test.ts` |
| A tier saved before presets had backups reads with none | the stored default is removed | `presets.test.ts` |
| A request naming a tier without backups is refused | the request schema gets the default | `presets.test.ts` |

Before and after, from earlier in the work: the off-topic regression test and the Default-chip test failed before their fixes (`ServiceFailure: No such Codex account.`), the per-tier settings test failed before the merge fix, and the primary-only comparison failed the whole-stack test. The mutation run shows each check can fail; it does not show that the failure is the one named, only that the covering test fails.

Verdicts: the stack behavior (copying, atomic refusal, clearing, side-quest, Ritual, per-tier merge, old saved tiers, strict requests) is **proven** at the service and the plain-logic level (tests, mutations, and the full suite: 1,397 passed, 14 skipped). The tab, the Preset card, the Workshop's backup editor and the draft side-quest are **awaiting human judgment**: the window drive ran only on the earlier layout, and this worktree has no Electron binary. Provisional choices (see the specification) are **awaiting the owner**.

Reproduction: the mutation script and the commands in the table were run from a clean shell by the same agent, not by a fresh-context agent; the two review agents (Standards and Specifications) reran the preset test files separately and passed.
