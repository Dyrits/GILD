# Proof: message attachments, the large-paste freeze, and the startup failure

- **Verdict:** proven on the fake harness in the running window, and on stand-ins for each adapter; the look awaits the owner, and OpenCode was not run live.
- **Work:** working tree on `01c3b72` (CHG-0102 and CHG-0103), with the Workshop work (CHG-0101) in the tree and not mine
- **Agreement:** CHG-0102, and the owner's report that pasting 17,000 lines into the message box froze the window and that Gild then did not open
- **Environment:** macOS, Electron 45 (page and service), Expo web dev server, fake harness, throwaway data folder (`GILD_DATA_DIR`)
- **Date:** 2026-11-10

## Claims

| # | Claim | Evidence | Verdict |
| --- | --- | --- | --- |
| C1 | The service starts: the startup sweep of drafts was given no `AttachmentsRoot`, so it exited with `Service not found: gild/AttachmentsRoot` | before: the built service run under Electron as Node on a copy of the owner's data exited with that line; after: the same run stays up; `src/main.ts` no longer fails to typecheck | proven |
| C2 | Pasting 17,000 lines (873,000 characters) no longer freezes the window | `paste-insertText-probe.cjs`: `insertText` took 0.19 s for 1,000 lines, 2.9 s for 4,000, and over 60 s (killed) for 17,000; `paste-bulk-probe.cjs`: the fix takes 46 and 48 ms with layout, text intact, caret after it; `drive-window.mjs` in the real window: 0.96 s from paste to a sendable box | proven |
| C3 | An image pasted with no text becomes a thumbnail with a ×, and an image alone can be sent | `drive-window.mjs`, [capture](2026-11-10-message-attachments/composer-and-sent-images.png) | proven |
| C4 | The sent message shows the thumbnail, the strip empties, and the harness is told of the image | same run: the echo reads `[images: shot.png]` | proven |
| C5 | A 2000×1000 PNG is stored scaled to 1568×784 | the stored files' PNG headers | proven |
| C6 | Claude Code, Codex, and OpenCode each get the image in their own form | `claude.test.ts`, `harnesses.test.ts` (stand-ins) | proven on stand-ins |

## Not proven

- The file button, drag and drop, and the refusal text for a Codex model that cannot read images, in the window (the refusal is tested in `attachments.test.ts`).
- Pasting in the quest-opening form of a side-quest and in the board's quest form was not driven; both use the same box.
- OpenCode with a real image; the sent image's larger view (not built).
- The look: the owner has not seen it.

## Cause and fix

- The freeze: the box inserted a paste with `document.execCommand("insertText")`, whose cost grows with the square of the text. Above 20,000 characters it now inserts one text node (`apps/app/src/bulkPaste.ts`); the browser's undo then does not take that paste back in one step.
- The startup failure: in `serviceLayer`, the draft sweep sat beneath the layer that provides `AttachmentsRoot`, so it never saw it; it is now given the root directly.
- Two failures here were separate: the freeze came from the paste, and Gild not opening came from the unfinished attachments work reaching the rebuilt service.

## Regressions

`bun run typecheck`, `bun run check`, and `bun run test` (545 passed, 10 skipped; run without `CLAUDE_CONFIG_DIR` in the environment, which one account test reads).
