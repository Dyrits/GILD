# Handoff: comments on messages in a quest or side-quest

Supersedes: none
Workspace: ISKIOS repository, branch `main`; built in worktree `ISKIOS-message-comments` (branch `worktree/message-comments`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants to comment on anything in a quest or side-quest, as in Delta.dev: comments are collected while reading and all go with the owner's next message. This batch covers whole messages and selected text; other items are left for later batches. Done for this batch means built, checked, and awaiting the owner's look.

## State

- Built, app only (no service or contract change): `apps/app/src/conversation/comments.ts` (comment type, the `<comments>` block written into a message and read back, quotes, per-thread storage under `iskios:comments:<thread id>`), `useComments.ts` (thread list and context, present only in a quest's or side-quest's conversation), `commentViews.tsx` (field, tray, quotes drawn in a sent message), `commentable.web.tsx` and `commentable.tsx` (hover and focus Comment button, Comment on selection button; plain card on native). `conversation.tsx` adds the waiting comments to what is sent and clears them once the service accepts the message; `conversationEntries.tsx` wraps the owner's, thread, and agent cards. Verified by reading the files at this commit.
- Agreed and built in CHG-0195 and CHG-0196 (`documentation/changelog.md`); spec in `documentation/capabilities/thread-messaging/specifications.md` under "Comments on messages"; glossary term "Comment".
- Verified now, on the rebased tree: `bun run typecheck` passes in four workspaces; `biome check .` passes; `vitest run --testTimeout=60000 --maxWorkers=3`: 891 passed, 2 failed. `loreHistory.test.ts` "records no fading step for a rule" timed out under load (machine load about 10) and passes alone. `loreOverTime.test.ts` "never fades a rule or a pinned lore entry" fails alone as well; the changelog records it as failing without this change (CHG-0182). `comments.test.ts`: 12 of 12.
- Verified earlier, before the rebase onto `b901df9`: driven in a throwaway Electron window on the fake harness (light mode): hover button, whole-message and selection comments, tray, reload persistence, edit, remove, Escape, send with typed text. Proof and screens in `documentation/verification/2026-11-11-message-comments.md`. Not rerun in a window after the rebase: assumed to hold, since the rebase conflicted only in the changelog.
- Not checked: dark mode and Gild; a side-quest conversation (same screen as a quest's); a real harness acting on the block (only the fake echo); the phone build beyond typecheck; many comments in a long thread; the owner's look.

## Decisions

- Targets for this batch: a whole message, and any selected text inside one message. Reason: the owner's words, "reply to a specific message" and "comment any selected text". Recorded in CHG-0195.
- Gesture: a hover button (also shown on focus). Keeping: per thread in the browser's storage until sent or removed. The owner accepted both recommendations.
- My choices, awaiting the owner's confirmation (CHG-0195): comments travel inside the message text as a `<comments>` block after the typed text, so no new request is needed; Enter saves, Shift+Enter breaks the line, Escape cancels; a whole-message quote is its first 300 characters; Iskios's own conversation has no comments; comments stay on the machine and window that wrote them.

## Next

1. Ask the owner to look at the feature (hover button, selection button, tray, sent quotes) and confirm or change the choices above.
2. If asked, extend comments to other items (step groups, question and suggestion cards, lore changes, journal entries, the quest panel); the `Commentable` wrapper and the block format would take an `about` kind for each.
3. Drive a side-quest and dark mode in a throwaway window (Expo with `--clear`, `ISKIOS_HARNESS=fake`) and add the screens to the verification file as a new file.

## Open questions

- Should comments also be offered in the Guild Hall (Iskios's conversation)? The owner has not asked; it has none today.
- Should a comment that is sent keep a visible link back to the commented message in the thread? Today the sent message shows the quote only.
- Does a real harness make good use of the `<comments>` block? Only the owner running a real quest can tell.

## Sources

- `documentation/changelog.md`: CHG-0195 (agreement), CHG-0196 (delivery).
- `documentation/verification/2026-11-11-message-comments.md` and its screens folder.
- `documentation/capabilities/thread-messaging/specifications.md`, "Comments on messages".
- `apps/app/test/conversation/comments.test.ts`.
- Commits: `b901df9` (base on `main`), the comments commit on top of it.
