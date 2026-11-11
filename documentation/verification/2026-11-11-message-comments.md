# Verification: comments on messages (2026-11-11)

Scope: comments on a message or a selected passage of it, kept per thread, sent with the next message (CHG-0195, CHG-0196). Starting revision `588d0e3`, worktree branch `worktree/message-comments`; rebased onto `b901df9` afterwards (see the rerun below).

## Recorded results

- `apps/app/test/conversation/comments.test.ts`: 12 of 12 pass. They cover a message of comments alone and typed text then comments; the three senders named; writing then reading back whole-message and selection comments in order, multi-line quotes and notes included; closing tags inside a quote or note not ending the block; an ordinary message having none; the excerpt cut at 300 characters and leaving out an earlier message's comments; per-thread storage, forgetting when none remain, damaged or foreign content and refusing storage giving none.
- App suite: 23 files, 219 passed, 4 skipped. `bun run typecheck` passes in the four workspaces; `biome check` passes on the touched files.
- Driven in a throwaway Electron 45 window (data under `/tmp`, Expo web on port 8131 started with `--clear`, debugger on 9431, `ISKIOS_HARNESS=fake`, desktop bundle rebuilt from this tree), light mode. Seen: the Comment button on a card while hovered; a whole-message comment on the Companion's reply added with Enter, shown in the tray with its quote and a "1 comment waiting" line under the card; after a reload and reopening the quest the tray and line were still there; a drag across words of the owner's message showing Comment on selection, which opened the field and added a second comment with the quoted passage; Edit changing a note, Remove emptying the tray and the stored entry, Escape discarding a field; sending with "Please revise the plan with my comments." sent one message, drew the typed text with the two comments as quoted passages, cleared the tray and the stored entry, and the fake harness's echo showed the `<comments>` block it received; a message sent from the Guild Hall had no comment buttons and kept the quest's stored comments.
- Found and fixed while driving: the hidden Comment button of one card, hanging over the edge of the card above, took the click meant for that card's Comment on selection button (now no pointer events while unseen, and the selection button above). Metro served stale code after edits until restarted with `--clear`.
- Screens: [hover](2026-11-11-message-comments/03-hover.png), [tray](2026-11-11-message-comments/05-tray.png), [two comments](2026-11-11-message-comments/07-two-comments.png), [sent](2026-11-11-message-comments/09-sent.png).

## Not verified

- Dark mode, and the Gild theme.
- A side-quest conversation: the same screen as a quest's, not driven.
- A real harness (Claude Code, Codex, OpenCode) acting on the comments: only the fake echo.
- The phone and native builds: typecheck only; no comment can be written there.
- Many comments in a long thread; a selection across two cards (refused by design, not driven); keyboard-only use beyond the button showing on focus.
- The look and the wording, by the owner.
