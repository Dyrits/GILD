# Handoff: batch 16 (widening and narrowing proposed from evidence) built and verified, uncommitted, awaiting the owner

Supersedes: `2026-11-07-0125-intel-history.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants an MVP fast and adjusts afterwards. For this session the owner said: "For now, we build, step by step and we verify it works. The look and feel will be adjusted later. Don't ask any question for this session, build what is next. I'll be AFK." An agent took the next intel batch named in the previous handoff, widening and narrowing proposed from evidence, then built, verified, and handed it off.

## State

- Verified by command output just before this handoff:
  - `bun run test` passed 302, with 5 opt-in live tests skipped.
  - `bun run typecheck`, `bun run check`, `git diff --check`, the desktop build, and `CI=1 bunx expo export --platform web` passed.
  - 17 of 17 mutations were caught in a separate copy; the 15 new checks fail 15 of 15 on `b94771f`.
  - The two-step migration check of 0020 passed.
  - The window drive on the fake harness proved C5 of the proof.
- Batches 14 and 15 were committed as `b94771f` before this session. Batch 16 is **uncommitted** on it; the owner did not ask for a commit. `.zcode/` stays untracked.
- Not done: no fresh-context agent reran this proof.
- Not agreed or accepted by the owner: batches 12–16 and their provisional choices (CHG-0049, CHG-0051 to CHG-0054; work-in-progress, Batches 12–16).
- Not verified: live Claude Code threads using the intel tools of batches 12–16.
- No processes from this session are left running, and its `/tmp` copies are removed. The Metro and Electron instances on 8081, 8082, 9333, and 9334 were running before the session and were left alone.

## Decisions

- Provisional choices, listed in work-in-progress (Batch 16). The weightiest:
  - Proposals are worked out from evidence when the panel is read, like fading; only the owner's decisions are stored, keyed by the set of intels (widening) or the intel and workspace (narrowing).
  - "Its whole half-life" is the kind's half-life in Settings without the growth from uses; a rule is never narrowed; uses recorded before 0020 have no workspace and do not count.
  - Widening keeps the newest intel (text, kind, identifier), sums the uses, and merges the others ("Merged", listed under Deleted); their recorded uses move to the kept intel.
  - No widening when a global intel already says the same thing.
- Structure: `intelProposals.ts` owns the evidence, the proposals, and applying them; `countUses` in `intelViews.ts` records each use's workspace; `isSameOf` in `intelDuplicates.ts` is the replacement closeness; `halfLifeDaysOf` in `intelFading.ts` is now exported.
- Data: migration `0020_intel_proposals` adds `intel_uses (intel_id, at, workspace_id)` and `intel_proposal_decisions (id, status, at)`.
- Contract: `IntelView.proposals`, `IntelProposal`, `IntelProposalId`, request `ResolveIntelProposal`; history kinds `Narrowed` and `Merged`. Thread tools did not change.
- Drive tip: to see a narrowing in the window, move `saved_at`, `updated_at`, `last_used_at`, `intel_history.at`, and `intel_uses.at` back together past the half-life, then have a thread in one workspace search the intel.

## Next

1. Ask the owner to agree to and accept batches 12–16. The proofs are `documentation/verification/2026-11-06-scoped-intel.md`, `2026-11-06-intel-over-time.md`, `2026-11-07-replacing-intel.md`, `2026-11-07-intel-history.md`, and `2026-11-07-intel-proposals.md`. Record the acceptance in the changelog. Commit batch 16 when the owner asks.
2. Next intel batch: Tidy up intel from the panel (scoped-intel, Intel panel); its routine waits for routines, which do not exist yet.
3. Other candidate batches: the starting-context warning (thread-tree), tool-and-skill-loading, mission-coordination, and thread-handover.
4. With approval, run the live Claude Code checks still listed as not verified in batches 10–16.

## Open questions

- Carried over: should a save that duplicates a wider intel be refused or noted as redundant? Should the specification's 30-day dormant example change, or the 3-day half-life? There is still no test for withdrawing a suggestion when a turn fails.
- New: should workspace intels that repeat an existing global intel be proposed for deletion as redundant? Today no widening is proposed for them.
- `intelChanges.ts` is 390 lines, over the 250-line convention; splitting it is a candidate refactor.

## Sources

- `documentation/changelog.md` (CHG-0054)
- `documentation/work-in-progress.md` (Batch 16)
- `documentation/verification/2026-11-07-intel-proposals.md` and its folder (screenshots, `mutations.py`, `mutations.txt`, `migration-old.test.ts`, `migration-new.test.ts`)
- `documentation/capabilities/scoped-intel/specifications.md` (Widening and narrowing)
- `packages/service/src/intelProposals.ts`, `intelViews.ts`, `intelDuplicates.ts`, `intelFading.ts`, `intel.ts`, `service.ts`, `store.ts`
- `packages/contracts/src/intel.ts`, `requests.ts`, `ids.ts`
- `apps/app/src/intel.tsx`, `labels.ts`
- `packages/service/test/intelProposals.test.ts`
