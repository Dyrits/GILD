# Handoff: thread-opening indicators (CHG-0067)

Supersedes: none
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wanted to see when a thread was opened beneath another, like delta's "Fork: …" and "Forked from: …" lines. Done means the owner accepts how both lines look and behave.

## State

- **Done (CHG-0067):**
  - The parent's conversation shows "Opened beneath: <title>" ("Agent opened beneath" for agent-opened threads) where the thread was opened. Clicking it selects that thread. Asides are left out.
  - The child pane shows "Opened from: <parent title>" under the header. Clicking it selects the parent.
  - `ThreadSummary.openedAt` holds the time of the thread's first message. It is computed in `missionDetail.ts`, with no migration.
  - `entriesOf` was moved to `apps/app/src/entries.ts`, so it can be tested.
- **Verified on 2026-11-08 by command output and app drive:**
  - `bun run test`: 399 passed, 10 skipped.
  - Typecheck, `bun run check`, `git diff --check`, and the web export passed.
  - Mutations showed each check able to fail.
  - Both lines were seen and clicked in the Electron window with the fake harness.
  - Details are in `documentation/verification/2026-11-08-thread-opening-indicators.md`.
- **Git:** committed and pushed with this handoff on `main` (assumed until `git log origin/main` shows it). `.zcode/` stays untracked.

## Decisions

- The opening time is taken from the thread's first message, not from a new `threads.created_at` column. This avoids a migration. Every thread is inserted together with its first message (`tree.ts`, `missions.ts`).
- Asides get no "Opened beneath" line, because their suggestion line already leads to them.
- Agent-opened threads get the line even when agent threads are folded in the side tree.
- The thread-tree specifications are unchanged. The behavior is provisional until the owner accepts it.

## Next

1. The owner judges how the lines look (claim C4 of the proof) and accepts or reverses CHG-0067.
2. Optional, when the owner asks: confirm why the subthread "What is my name?" knew the owner's name but not their wife's. The hypothesis is that a journal entry was written after "My wife is Diana". Then `openerMessagesOf` (`packages/service/src/journal.ts`) passed no opener messages, and the name came through the journal alone. That follows the spec ("the opener's messages since the journal's last change log entry"). The owner's data directory would settle it.

## Open questions

- Should the wording follow delta ("Fork" or "Forked from") rather than "Opened beneath" or "Opened from"? The glossary and specs say "open a thread beneath", so the current wording uses their terms. The owner decides.

## Sources

- `documentation/changelog.md` (CHG-0067)
- `documentation/verification/2026-11-08-thread-opening-indicators.md` and its screenshots
- `documentation/capabilities/thread-tree/specifications.md`, "Opening a thread"
- `apps/app/src/entries.ts`, `conversationEntries.tsx`, `conversation.tsx`; `packages/contracts/src/records.ts`; `packages/service/src/missionDetail.ts`
