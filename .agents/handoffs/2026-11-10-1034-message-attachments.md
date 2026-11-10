# Handoff: message attachments, the large-paste freeze, and the startup failure

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let the owner attach images to messages (paste, drop, file button) and hand them to Claude Code, Codex, and OpenCode (CHG-0102, CHG-0103). Done also means Gild opens again and a very large paste no longer freezes the message box. The look awaits the owner.

## State

- Built in the working tree on top of `01c3b72` (CHG-0101): contracts (`packages/contracts/src/attachments.ts`), service (`packages/service/src/attachments.ts`, `vision.ts`, adapters, `threads.ts`), app (`apps/app/src/attachment*.ts*`, `useAttachments.ts`, `bulkPaste.ts`, `controls.tsx` Composer). Committed in the commit that adds this file; whether it is pushed is in Open questions.
- Verified: `bun run typecheck` and `bun run check` pass, and `env -u CLAUDE_CONFIG_DIR bun run test` passes (545 passed, 10 skipped). One account test in `harnesses.test.ts` fails when `CLAUDE_CONFIG_DIR` is set in the shell.
- Verified: the startup failure `Service not found: gild/AttachmentsRoot` came from the draft sweep in `serviceLayer` (`packages/service/src/service.ts`) sitting beneath the layer that provides the root; it is now given the root. The built service stays up on a copy of the owner's data.
- Verified: pasting 17,000 lines (873,000 characters) took over 60 s through `execCommand("insertText")`; above 20,000 characters the box now inserts one text node (46 ms measured; about 1 s in the real window).
- Verified in the running window on the fake harness with a throwaway data folder: an image pasted alone becomes a thumbnail with a ×, can be sent, the echo reads `[images: shot.png]`, the sent message shows the thumbnail, a 2000×1000 PNG is stored at 1568×784. Proof: `documentation/verification/2026-11-10-message-attachments.md`.
- Verified on stand-ins: each adapter's wire form (`claude.test.ts`, `harnesses.test.ts`).
- Not verified: the + file button, drag and drop, and the Codex refusal message in the window; OpenCode with a real image; the look (the owner has not seen it).
- Assumed: the blank `Pressable` errors in the dev console from `apps/app/src/sidebar.tsx` are older than this work; not investigated.
- `.tmp.md` in the repository root is an exported transcript of the earlier session; it is untracked, not part of the work, and left uncommitted.
- Undo does not take back a large paste in one step (accepted cost of the paste fix).

## Decisions

- Images only, from the owner's messages only; upload first, then reference by identifier; refuse when the harness or model cannot read images (CHG-0102, `documentation/capabilities/message-attachments/specifications.md`).
- Above 20,000 characters a paste goes in as one text node (`apps/app/src/bulkPaste.ts`); recorded in the proof note and CHG-0103.
- Handoffs are shared and committed in this repository.

## Next

1. Ask the owner to look at the thumbnail strip, the + button, and the sent thumbnails in the running window, and to try a large paste.
2. Drive the + button, drag and drop, and the refusal for a Codex model that cannot read images in the window; add them to the proof note.
3. Run one image through OpenCode live (not yet done).
4. Decide with the owner whether to delete `.tmp.md`.
5. Look into the `Pressable` errors from `sidebar.tsx` if they still show.

## Open questions

- Is the commit pushed? Pushing to `main` is refused by `.githooks/pre-push`; the owner approves with `git push --no-verify`. Check `git status -sb` first.
- Should a larger view of a thumbnail, and images in messages between threads, be the next batch? The owner decides.

## Sources

- `documentation/capabilities/message-attachments/specifications.md`
- `documentation/changelog.md` (CHG-0102, CHG-0103)
- `documentation/verification/2026-11-10-message-attachments.md` and its folder (probe scripts, screenshot)
- `documentation/work-in-progress.md`
- `packages/service/src/service.ts`, `packages/service/src/attachments.ts`, `apps/app/src/bulkPaste.ts`, `apps/app/src/controls.tsx`
