# Handoff: batch 13 (intel over time) built, verified, committed, awaiting the owner's acceptance

Supersedes: `2026-11-06-2325-scoped-intel-committed.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants an MVP fast and adjusts afterwards. For this session the owner said: "build, step by step and we verify it works. The look and feel will be adjusted later. Don't ask any question for this session, build what is next." An agent chose batch 13, the first part of the intel-over-time rules agreed in CHG-0050, then built, verified, and handed it off.

## State

- Verified by command output just before this handoff:
  - `bun run test` passed 253, with 5 opt-in live tests skipped.
  - `bun run typecheck`, `bun run check`, `git diff --check`, the desktop build, and `CI=1 bunx expo export --platform web` passed.
  - 20 of 20 mutations were caught in a separate worktree.
  - The new checks fail on `5901f13`, and the migration check passed.
- Verified by a fresh-context agent that reran the whole proof, including the window drive on the fake harness: every claim C1–C11 matched. C12, the look, awaits the owner.
- Assumed: batch 13, its proof, and this handoff were committed and pushed to `main` on the owner's request ("hand-off, commit and push") in the commit that adds this file. Check with `git log -1` and `git status -sb`. `.zcode/` stays untracked.
- Not agreed or accepted by the owner: batches 12 and 13 and their provisional choices (CHG-0049, CHG-0051; work-in-progress, Batches 12 and 13).
- Not verified: a live Claude Code thread using kinds, the global index, and search.
- No processes from this session are left running. The Electron and Metro instances on 8081, 8082, 9333, and 9334 were running before the session and were left alone.

## Decisions

- Provisional choices, listed in work-in-progress (Batch 13):
  - A summary is the first 80 characters, cut at a word.
  - Restore sets the last use to now without counting a use.
  - Owner edits, corrections, and widenings are not uses.
  - A global save awaiting approval keeps its kind.
- Structure:
  - `intelFading.ts` holds kinds, strength, state, and summaries, and imports no other intel module.
  - Strength is worked out when read, with no timer (`documentation/architecture.md`, Inside the local service).
- Data:
  - Migration `0017_intel_over_time` adds `kind`, `is_pinned`, `uses`, and `last_used_at` to `intels`, and `intel_kind` to `intel_changes`.
  - Intel saved before the migration becomes an active Fact.
  - Settings gains `intelHalfLives`.
- This session's proof and changelog entry are dated 2026-11-06, the local date. Files first named 2026-11-07 were renamed before the commit.

## Next

1. Ask the owner to agree to and accept batches 12 and 13. The proofs are `documentation/verification/2026-11-06-scoped-intel.md` and `documentation/verification/2026-11-06-intel-over-time.md`. Record the acceptance in the changelog.
2. Next intel batch, listed in the backlog under Intel over time:
   - duplicates saved as replacements;
   - origin references;
   - history with undo, including fading steps;
   - widening and narrowing proposed from evidence;
   - Tidy up intel and its routine;
   - "relied on" counting as a use.
3. Other candidate batches: the starting-context warning (thread-tree), tool-and-skill-loading, mission-coordination, and thread-handover.
4. With approval, run the live Claude Code checks still listed as not verified in batches 10–13.

## Open questions

- The specification's acceptance example says a temporary intel is dormant after 30 days. With a 3-day half-life, it is dormant from about 8 days and archived from about 13. The owner decides whether the example or the half-life changes.
- Carried over: there is no test for withdrawing a suggestion when a turn fails. The open questions in work-in-progress also remain.

## Sources

- `documentation/changelog.md` (CHG-0050, CHG-0051)
- `documentation/work-in-progress.md` (Batch 13)
- `documentation/verification/2026-11-06-intel-over-time.md` and its folder (screenshots, `mutations.py`, `mutations.txt`, `migration-old.test.ts`, `migration-new.test.ts`)
- `documentation/capabilities/scoped-intel/specifications.md`
- `packages/service/src/intelFading.ts`, `intel.ts`, `intelViews.ts`, `intelChanges.ts`, `intelTools.ts`, `threadTools.ts`, `store.ts`, `settings.ts`
- `packages/contracts/src/intel.ts`, `records.ts`, `requests.ts`
- `apps/app/src/intel.tsx`, `settings.tsx`, `labels.ts`
- `packages/service/test/intelOverTime.test.ts`, `intel.test.ts`
