# Handoff: Review fixes, the lore rename, and the architecture audit

Supersedes: none
Workspace: Gild repository, `main`, committed and pushed from `2221cbe`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The code review of the realms/crests and Companion-label commits is fully fixed, intel is called lore in the code, and the owner has chosen which of the six architecture candidates to deepen first. Done also means the owner has seen the screen behaviors listed under Not verified.

## State

- **Verified (run just before writing):** `bun run format` (no fixes), `bun run typecheck`, and `bun run test` pass (458 passed, 10 skipped). Five mutations in a separate worktree each made a new test fail ([proof](../../documentation/verification/2026-11-10-review-fixes-and-lore-rename.md)).
- **Fixed, review findings:** dashboard sub-screen state is tied to the quest or realm (`dashboard.tsx`); realm panel keyed by realm, one save per rename, figures from all the realm's quests, shared `QuestLedger` (`questPanel.tsx`); `samePath` exact in `apps/app/src/paths.ts`; crest studio starts from the shown crest and its text field clears (`crestStudio.tsx`); breadcrumb keys and archived quest trail (`sidebar.tsx`); reply records the chosen model when the harness names none and `<synthetic>` is no model (`turns.ts`, `claude.ts`, `formatting.ts`); a realm's lore lists its deleted entries and hides the scope choice (`loreViews.ts`, `loreHistoryViews.ts`, `lore.tsx`); the ending message and the desktop notification say quest.
- **Done, rename:** intel is lore in code (CHG-0093): 22 files moved to `lore*`, types are `LoreEntry`, `LoreScope`, `LoreView`. Kept as `intel`: SQL tables and migrations, request tags (`ListIntel` and eight others), thread tool names (`save_intel`...), settings keys `intelHalfLives` and `intelWarningPercent`.
- **Done, audit:** `documentation/architecture-audit/architecture-audit-2026-11-09-2351.html` lists six candidates; none is started.
- **Not verified:** the screen behaviors have no test seam and were not seen in a window (proof claim C7). After an undo, the emblem text field can show the earlier text. Replies saved before migration `0024` take the thread's current model for their label.
- **Not committed by this session:** `.zcode/` (an untracked folder of tool skills that predates the session).

## Decisions

- The rename is code only, keeping stored and wire names, so saved data and existing agents keep working. Reason: the owner chose it over renaming storage and tools; recorded in CHG-0093.
- The glossary keeps Mission, Workspace, Attention and the other technical terms in identifiers; the interface says Quest, Realm, Summons. The owner asked for an audit of the pairs, which found only two wrong visible texts (fixed); renaming identifiers was not asked for.
- Push to `main` after committing without asking (the owner's standing instruction; the pre-push hook needs `--no-verify`).

## Next

1. Ask the owner which architecture candidate to explore; the audit recommends candidate 1 (one navigation module owning where the owner is), then 2 (realm identity resolved in the service, which also fixes the symbolic-link case of `samePath`) and 3 (a realm ledger).
2. Have the owner look at the screen behaviors in the proof's C7 and fix what they find.
3. Decide whether to rename the settings keys `intelHalfLives` and `intelWarningPercent` with a migration of the stored settings.

## Open questions

- Should the two settings keys move to lore (needs a migration of saved settings)? The owner decides.
- Should identifiers move from Mission/Workspace/Attention to Quest/Realm/Summons too? Not asked; it would touch storage, tags, and tools.

## Sources

- `documentation/architecture-audit/architecture-audit-2026-11-09-2351.html`
- `documentation/verification/2026-11-10-review-fixes-and-lore-rename.md`
- `documentation/changelog.md` (CHG-0093, CHG-0094), `documentation/glossary.md`, `documentation/work-in-progress.md`
- `.agents/handoffs/2026-11-09-2323-realms-and-crests.md` (the work this review covered)
