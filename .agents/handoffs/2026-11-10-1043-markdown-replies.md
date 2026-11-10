# Handoff: agent replies drawn as Markdown

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `markdown-replies` (from `main` at `7a089a1`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

A reply from the Companion showed its Markdown as typed (`**bold**`, `` `code` ``, `-` lists). Done means replies, including the live draft and messages from other threads, draw as formatted Markdown in the guild's type. The look awaits the owner.

## State

- Built and committed on branch `markdown-replies`: `apps/app/src/markdown.tsx` (the `Markdown` component), `apps/app/src/markdownRules.ts` (`linkTargetOf`, `listMarkerOf`), `apps/app/src/conversationEntries.tsx` (uses `Markdown` in `AgentReply` and for messages from other threads), `apps/app/test/markdownRules.test.ts`, the `marked` dependency in `apps/app/package.json` and `bun.lock`, and changelog entry CHG-0104.
- Verified: `bun run check` and `npx tsc --noEmit` in `apps/app` pass; `apps/app` tests pass (12 files, 105 tests) with `ELECTRON_RUN_AS_NODE=1 npx electron node_modules/vitest/vitest.mjs run apps/app`. The full test suite was not run.
- Verified: the text of the owner's screenshot, plus headings, a quote, fenced code, a table, an ordered list, and a `javascript:` link, was rendered once in a browser through `react-native-web` and read by eye; nested lists, bold, code chips, and the quote, code, and table blocks drew as intended and the `javascript:` link drew as plain text. That page was temporary and is deleted.
- Not verified: the look in the running Gild window (bundled fonts, the narrow window), native builds, a very long reply or a streaming draft for speed, clicking a real link.
- Assumed: the `bun.lock` reordering of `@gild/*` entries beside the new `marked` lines is Bun's own normalisation and harmless.
- `.tmp.md` in the repository root is untracked, not part of the work, and left uncommitted.

## Decisions

- `marked` lexes the text and our own `markdown.tsx` draws it, so the drawing stays portable to native; reason and dependency note are in CHG-0104 (`documentation/changelog.md`).
- A link opens only for `http:`, `https:`, and `mailto:`; a reply is untrusted text, so any other scheme shows as plain text.
- The owner's own messages stay plain text with chips; only replies and messages from other threads use Markdown.
- Handoffs are shared and committed in this repository.
- The work went on a branch, not `main`, because `.githooks/pre-push` refuses pushes to `main`; the owner decides whether to merge it.

## Next

1. Ask the owner to look at a real reply in the running window, including a long list, code block, and table, and to say what looks wrong.
2. Run the full suite once (`env -u CLAUDE_CONFIG_DIR bun run test`) and add a proof note under `documentation/verification/` if the owner accepts the look.
3. Check a long streaming draft for speed; the lexer runs on each text change (`useMemo` on the text).
4. Merge the branch to `main` when the owner approves; pushing to `main` needs `git push --no-verify` from the owner.

## Open questions

- Should the owner's own messages, or messages between threads, also draw Markdown? The owner decides.
- Does the owner want images (`![alt](url)`) drawn? They now show their alt text only.

## Sources

- `documentation/changelog.md` (CHG-0104)
- `apps/app/src/markdown.tsx`, `apps/app/src/markdownRules.ts`, `apps/app/src/conversationEntries.tsx`
- `apps/app/test/markdownRules.test.ts`
- `apps/app/AGENTS.md`, `documentation/conventions.md`
