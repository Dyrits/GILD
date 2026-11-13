# Handoff: Companion preset stacks, and what the owner noticed after

Supersedes: none
Workspace: ISKIOS repository, branch `main`, Delta worktree `/Users/dgerrits/Codelab/Dyrits/ISKIOS/.delta/worktrees/txy1690zrt2e/ISKIOS`; starting commit `b526f74`; the work is commit `cbd8666` on top of it, plus the commit that adds this file. Nothing is pushed: the owner interrupted the `git fetch` that came before the push, so the push to `origin/main` (with `--no-verify`, which the owner had approved) is still to do, and is to be confirmed again.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Make a Companion preset (Light, Balanced, Heavy) a primary Companion and its ordered backups, applied together wherever it is chosen, with the presets offered in their own card above the Companion in the Companions tab. Done: the owner has looked at the result in the window and accepted or redirected it, and has settled the provisional choices listed below.

## State

- Verified now (this session, plain Node, not Electron): `bun run check` is clean, `bun run typecheck` passes in all six workspaces, and the full suite passes (1,397 passed, 14 skipped). The pre-commit hook ran Biome, typecheck and 941 affected tests on `cbd8666` and passed. Eight mutations of the production code, run in a separate worktree, each make their covering test fail (`documentation/verification/2026-11-13-companion-stacks/mutations.py`).
- Built (CHG-0258 to CHG-0261 in `documentation/changelog.md`; proof in `documentation/verification/2026-11-13-companion-stacks.md`): tiers hold a primary and up to five backups; the Workshop edits them; choosing a preset replaces the primary and the whole backup list in one step on a thread, in a draft side-quest, on Iskios's card, and for a Ritual Iskios creates on a tier; settings changes name only the tiers they change; tiers saved without backups still read (schema default, stored settings only; a request without backups is refused).
- The owner ran the app after the layout change and the Preset card showed above the Companion fold (a screenshot in the conversation). The owner did not state acceptance; they reported the notes below.
- Not verified: the window drive (`drive.ts`) was not rerun on the new layout, and this worktree has no Electron binary. Dark mode, a phone, a paired device, narrow windows and real provider failures were not checked.
- Two reviewers (Standards, Specifications) checked the work in two rounds and found no regression. Still open from them: `requests.ts` (726), `service.ts` (701), `shell.tsx` (509) and `guildmaster.test.ts` (1,189) are smaller than before and still past 512; S21 (a `withPrimaryOf` helper), S22 (`runner` fields that hold whole stacks), S23 (the `Preset` type shape), P11 and P12 (see the working state).

## What the owner noticed (not yet worked on)

1. **The right-hand Companions column carries over into the Workshop** (owner, with a screenshot of the Workshop on its Permissions section while the column shows "✦ Companions" with Iskios's Companion, its backups and the Preset card): "Sometimes, the sidebar I opened in a quest carry over in the workshop. Should not be the case." Unfixed and unreproduced. Reading of the code, unverified: in `apps/app/src/shell/shell.tsx`, a screen with no quest panel opens the column from `isCompanionOnly`, which is reset only when no Companion is offered (`hasCompanion`); while Iskios is open its Companion is always offered (`isCompanionOffered`, `companionScope.ts`), so the flag and `pressedPill` can outlive the screen that set them. The comment there says Iskios's Companions are shown "elsewhere ... while Iskios is open" on purpose, so the owner's note changes that rule: the column's open state should belong to the screen. Start by reproducing it, then reset `isCompanionOnly` and `pressedPill` when the place changes.
2. **Model lists sometimes load slowly** (owner: "They used to be preloaded. Is it not the case?"). What the code does: `packages/service/src/harness/harnessTools.ts` keeps a harness's model list for 10 minutes (`modelsLifetimeMillis`), per harness and per account folder, and reads it only when a screen first asks (`useHarnesses`, `ListHarnesses`); nothing reads at startup and nothing refreshes in the background, so the first open after a start, and the first open after 10 minutes, wait for the harness's own tool. What was read ahead is OpenCode's effort levels, after a list read (CHG-0162). So the lists were not preloaded; the effort levels were. A fix to consider: read the lists at service start and refresh them before they expire.
3. **Pick models per account, not only per provider** (owner: "it would be nice to have not a selection only per provider but also per account, like OpenBot does"; the owner's screenshot shows the Codex model list with a "Codex" harness tab, "ChatGPT" and its CLI version, a search field, and two numbered Claude accounts in the tab strip). Today the picker has one tab per harness, models listed for that harness, and an account menu beside the tab name for the current harness only; the model list is already read per account folder in the service. The idea: a tab per account (several Claude subscriptions side by side), each with its own models, so choosing a model also chooses the account. Needs a design decision first (how it fits the Companion tab, the backups' pickers and the presets, which already store an account with each Companion).
4. **The dev console still shows the nested buttons error** at `apps/app/src/shell/sidebar.tsx` lines 335 and 358 (a Pressable in a Pressable). It predates this work and is on the narrow-window item in the backlog. The terminal also printed `SingletonLock: File exists (17)` for the "Iskios Dev" profile: another Iskios instance had the profile open, not a bug of this work.

## Decisions

- A preset is a Companion and its backups, chosen together (owner, 2026-11-13: "selecting a preset should do a full stack of companions"). The three tiers only; the owner's own presets and Save as a preset stay deferred.
- The presets sit in a card above the Companion fold, not inside it (owner, after seeing the first layout: it was confusing).
- Settled for now, not by the owner: everything under "Provisional choices" in `documentation/capabilities/companion-presets/specifications.md` (an empty preset clears a thread's backups, no presets in backup folds, Iskios's card and a Ritual Iskios creates take the tier's backups, a side-quest takes the chosen preset's stack, a request without backups is refused). The owner answered "Yes" to the question that asked both whether to commit and push and which provisional choices stay, with my recommendation (keep the clearing and the card carrying the stack, ask about the other three); I read that as approval of both, so the other three await the owner.

## Next

1. Confirm the push of `cbd8666` and this handoff's commit to `origin/main` with the owner (`git fetch`, then `git push --no-verify origin main`), as the owner approved before the interruption.
2. Reproduce and fix note 1 (the column carrying over), test first at the place logic if it can be pulled out of `shell.tsx`; `shell.tsx` is 509 lines, so the fix must shrink it.
3. Ask the owner whether to read the model lists ahead (note 2), then do it in the service.
4. Design note 3 with the owner before building: the account as part of the model choice.
5. Rerun the window drive on the new layout once an Electron binary is available, and ask the owner to settle the provisional choices.

## Open questions

- Owner: the three provisional choices still open (backup folds without presets, a side-quest taking the preset's stack, a Ritual taking the tier's backups).
- Owner: whether the Companions column should ever stay open when leaving a quest for another screen (note 1), and how per-account choosing should look (note 3).

## Sources

- `documentation/changelog.md` (CHG-0258 to CHG-0261), `documentation/verification/2026-11-13-companion-stacks.md` and its folder (`drive.ts`, `mutations.py`, screens)
- `documentation/capabilities/companion-presets/specifications.md` (Provisional choices), `documentation/backlog.md`, `documentation/work-in-progress.md`
- `apps/app/src/shell/shell.tsx`, `apps/app/src/shell/companionScope.ts` (note 1); `packages/service/src/harness/harnessTools.ts`, `apps/app/src/editors/runners.tsx` (`useHarnesses`) (note 2); `apps/app/src/editors/companionBody.tsx`, `apps/app/src/editors/presetChooser.tsx` (note 3)
