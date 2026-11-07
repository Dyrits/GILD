# Handoff: batch 14 (replacing duplicates, origins, relying on intel) built and verified, uncommitted, awaiting the owner

Supersedes: `2026-11-06-2350-intel-over-time.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants an MVP fast and adjusts afterwards. For this session the owner said: "For now, we build, step by step and we verify it works. The look and feel will be adjusted later. Don't ask any question for this session, build what is next. I'll be AFK." An agent chose batch 14, the next part of the intel-over-time rules agreed in CHG-0050, then built, verified, and handed it off.

## State

- Verified by command output just before this handoff:
  - `bun run test` passed 267, with 5 opt-in live tests skipped.
  - `bun run typecheck`, `bun run check`, `git diff --check`, the desktop build, and `CI=1 bunx expo export --platform web` passed.
  - 20 of 20 mutations were caught in a separate copy.
  - The new checks fail on `7b6ee2e` (12 of 13), and the two-step migration check of 0018 passed.
  - The window drive on the fake harness proved C7 of the proof.
- Not done: the work is **uncommitted** on `7b6ee2e`, which matches `origin/main`. The owner did not ask for a commit this session. `.zcode/` stays untracked.
- Not done: no fresh-context agent reran this proof.
- Not agreed or accepted by the owner: batches 12, 13, and 14 and their provisional choices (CHG-0049, CHG-0051, CHG-0052; work-in-progress, Batches 12–14).
- Not verified: a live Claude Code thread using kinds, the index, search, replacements, `journalEntry`, and `relied_on_intel`.
- No processes from this session are left running, and its `/tmp` copies are removed. The Electron and Metro instances on 8081, 8082, 9333, and 9334 were running before the session and were left alone.

## Decisions

- Provisional choices, listed in work-in-progress (Batch 14). The weightiest:
  - A save replaces only an intel in the same scope. A narrower intel that differs from a wider one is an override, so the wider one is only named. This choice came from an existing lookup check that failed when wider intels were replaced.
  - Closeness is shared words (Dice): 0.6 and at least 2 shared words to replace, 0.3 to be named as close.
  - A replacement keeps its identifier and uses, takes the new kind and origin, and its last use becomes now.
  - The origin is the named journal entry, or else the latest message delivered to the thread. It is stored as an excerpt.
- Structure:
  - `intelDuplicates.ts` holds the closeness and the replacement choice, and is pure.
  - `intelOrigins.ts` reads an origin.
  - `relyOnIntel` and the shared `countUses` sit in `intelViews.ts` next to `search_intel`.
- Data:
  - Migration `0018_intel_origins` adds `origin_kind`, `origin_entry`, `origin_from`, and `origin_excerpt` to `intels` and `intel_changes`.
  - `IntelChangeKind` gains `Replace`.
  - `Intel` gains `origin`.
- Contract: `save_intel` takes an optional `journalEntry`, and a new tool `relied_on_intel` takes `ids` (at least one). The specification's tool table now lists both.
- Drive tip: on the dashboard, `playwright-cli click` on the "Send" text does nothing, because the pressable is its parent. Press Enter in the composer instead. The service also needs `OPENMISSION_DATA_DIR` to exist.

## Next

1. Ask the owner to agree to and accept batches 12–14. The proofs are `documentation/verification/2026-11-06-scoped-intel.md`, `2026-11-06-intel-over-time.md`, and `2026-11-07-replacing-intel.md`. Record the acceptance in the changelog. Commit batch 14 when the owner asks.
2. Next intel batch: history with undo, including fading steps and which intel replaced which. After it come widening and narrowing proposed from evidence, then Tidy up intel and its routine. Routines do not exist yet.
3. Other candidate batches: the starting-context warning (thread-tree), tool-and-skill-loading, mission-coordination, and thread-handover.
4. With approval, run the live Claude Code checks still listed as not verified in batches 10–14.

## Open questions

- Should a save that duplicates a wider intel be refused or noted as redundant, instead of being saved as a narrower copy? It is saved for now, and the answer names the wider intel.
- Carried over: should the specification's 30-day dormant example change, or the 3-day half-life? There is still no test for withdrawing a suggestion when a turn fails. The open questions in work-in-progress also remain.

## Sources

- `documentation/changelog.md` (CHG-0050, CHG-0052)
- `documentation/work-in-progress.md` (Batch 14)
- `documentation/verification/2026-11-07-replacing-intel.md` and its folder (screenshots, `mutations.py`, `mutations.txt`, `migration-old.test.ts`, `migration-new.test.ts`)
- `documentation/capabilities/scoped-intel/specifications.md`
- `packages/service/src/intelDuplicates.ts`, `intelOrigins.ts`, `intelChanges.ts`, `intelViews.ts`, `intelTools.ts`, `intel.ts`, `threadTools.ts`, `store.ts`
- `packages/contracts/src/intel.ts`
- `apps/app/src/intel.tsx`, `labels.ts`
- `packages/service/test/intelReplacing.test.ts`
