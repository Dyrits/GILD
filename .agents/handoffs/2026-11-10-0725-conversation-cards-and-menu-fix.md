# Handoff: Conversation cards, provider logos, and the picker menu fix

Supersedes: none
Workspace: Gild repository, `main` from `660ca07`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The quest conversation pane looks like the owner's mockup: parchment cards, a provider logo (Claude, OpenAI/Codex, OpenCode) beside each agent reply instead of a crest, and no bottom toolbar in the composer. Done means the owner has seen it in the running window and accepted the look.

## State

- **Verified (run this session):** `bun run typecheck`, `bun run check`, `bun run test` (458 passed, 10 skipped) pass.
- **Verified (browser run, throwaway Electron with the fake harness, driven over CDP):** the Harness menu in the Guildmaster composer opens inside the window and choosing Codex changes the harness (red before the fix, green after). A quest with one reply shows the Claude logo, the model label and the time on a parchment card.
- **Built:** `apps/app/src/providerMarks.tsx` (`ProviderMark`: official single-path logos, Claude and OpenCode from Simple Icons, OpenAI from LobeHub icons); `AgentReply` and card styles in `conversationEntries.tsx` and `styles.ts` (`messageCard*`, `messageRow*`, `medallion`, `senderHeader`, `senderName`, `senderTime`); the streamed draft uses `AgentReply` in `conversation.tsx`; the open question card has a red border.
- **Fixed:** the harness, model, and effort menus could not be used when opened above their button. `local.floating` in `pickers.tsx` set `top: undefined`, which react-native-web skips, so the shared `top: 100%` stayed and the list sat at the window's bottom edge, outside it. It is now `top: "auto"`. No unit test: the defect is in browser style merging and no seam reaches it; the reproduction script was throwaway and is not kept.
- **Not verified:** the OpenAI and OpenCode logos on screen (only Claude was seen); other widths; the native build; the owner's acceptance of the look.
- **Not done from the mockup:** the large crest and title header of the conversation, and the labels "Counsel" and "Summons".
- **Local history changed outside this work:** the reflog shows `reset: moving to origin/main` dropping two unpushed commits, `0d3aa7c` (illustrated Guildmaster desk) and `ee50f9f` (thin separators, CHG-0096). `git reflog` still holds them. This work was committed on `660ca07` and does not include them.

## Decisions

- The provider logo follows the thread's harness (`thread.harness`), not the reported model: Claude Code shows Claude, Codex shows OpenAI, OpenCode shows OpenCode.
- The composer gets no Aa, attachment, code, list, or sparkle toolbar (owner's instruction); the composer is otherwise unchanged.
- The logos are trademarks of their owners and only identify the provider; their licences are those of the icon sets named in `providerMarks.tsx`.

## Next

1. Ask the owner whether the two dropped commits (`0d3aa7c`, `ee50f9f`) were meant to go, and recover them from the reflog if not.
2. Run the real window and judge the conversation cards, the logos for Codex and OpenCode, and the red question card; adjust with the owner.
3. Decide with the owner whether to bring the mockup's header (crest and title) and its Counsel and Summons labels to the conversation.
4. Write the changelog record and work-in-progress entry for this change (not yet written).

## Open questions

- Were the two dropped commits intentional? The owner can answer.
- Should the header and labels of the mockup be adopted? The owner can answer.

## Sources

- `apps/app/src/providerMarks.tsx`, `apps/app/src/conversationEntries.tsx`, `apps/app/src/conversation.tsx`, `apps/app/src/styles.ts`, `apps/app/src/pickers.tsx`
- `documentation/work-in-progress.md`, `documentation/conventions.md`
- `git reflog` for `0d3aa7c` and `ee50f9f`
