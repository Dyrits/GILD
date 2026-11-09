# Proof: the Companion's label names the model that wrote the reply

- **Verdict:** partly proven. The service records the model Claude Code reports for each reply, and the label is built from it; both are shown by checks that fail when the code is broken. How the label looks in the window was not seen, and Codex and OpenCode report no model to Gild yet.
- **Work:** working tree on `42a60db` (uncommitted when proven)
- **Agreement:** the owner's request in the session of 2026-11-09 to write the model in the Companion's answer label, as "Provider - Model name and version", from the model the harness reports, with the model's company as provider. No CHG yet.
- **Environment:** macOS, Electron 45 as Node (Vitest), the Claude Code stand-in `packages/service/test/fixtures/stand-in-claude.mjs`
- **Date:** 2026-11-09

## Claims

| # | Claim | Evidence | Verdict |
| --- | --- | --- | --- |
| C1 | The model on a Claude Code reply (`message.model`) is saved on that reply's message (`messages.model`, migration `0024_message_model`) and reaches the conversation as `Message.model`; the owner's own message has none | `claude.test.ts`, "runs the thread's model and effort…": `messages.map(m => m.model)` equals `[null, "claude-sonnet-5-5"]` | proven |
| C2 | The label is the model's company, then its name and version: `claude-sonnet-5-5` gives "Anthropic - Sonnet 5.5", `claude-opus-4-1-20250805` "Anthropic - Opus 4.1", `claude-3-5-haiku-20241022` "Anthropic - Haiku 3.5", `gpt-5.1-codex` "OpenAI - GPT-5.1 Codex" | `apps/app/test/companionLabel.test.ts` | proven |
| C3 | With no reported model, the label falls back to the thread's chosen model under the harness's company ("Anthropic - Sonnet", "OpenAI - Default model"); an unknown model id is kept as it is | same file | proven |
| C4 | The label appears above each Companion reply and on the "writing…" draft | code read only (`conversationEntries.tsx`, `conversation.tsx`) | awaiting human judgment |
| C5 | Existing databases migrate: the column is added as nullable, so earlier replies keep a null model and show the fallback | the full suite runs every migration on a fresh database; an older database was not opened | unproven |

## Shown able to fail

Each run in a separate worktree of the end state, with the change applied there; the user's checkout was not touched (`git diff` identical before and after).

| Check | Mutation | Result |
| --- | --- | --- |
| C1 | `claude.ts` sends `model: null` in the Reply event | fails: expected `[null, null]` to equal `[null, "claude-sonnet-5-5"]` |
| C1 | `messaging.ts` inserts `null` instead of the model | fails |
| C2 | `companionLabelOf` drops the version | fails: 1 of 3 tests |
| C2, C3 | the start commit, with the new test file | fails: `companionLabelOf is not a function` |

## Not proven

- Codex and OpenCode: their events are not read for a model, so their replies carry none and always show the fallback. Claude Code's own `message.model` was read from a stand-in, not from a live `claude` process.
- The look of the label in the running window, and its length in the thread panel and narrow widths.
- A migration over a database written before `0024`.

## Regressions

`bun run check`, `bun run typecheck`, and `bun run test` (450 passed, 10 skipped) pass.

## Reproduce

From the repository root: `bun run test packages/service/test/claude.test.ts apps/app/test/companionLabel.test.ts` passes. To see each check fail, in a throwaway worktree with `node_modules` linked, replace `model: textFieldOf(fieldOf(event, "message"), "model")` in `packages/service/src/claude.ts` with `model: null`, or `${message.model ?? null})` in `packages/service/src/messaging.ts` with `null)`, and run the first file; replace `${known.provider} - ${known.name}` in `apps/app/src/formatting.ts` with `${known.provider} - ${known.name.split(" ")[0]}` and run the second. The commands were rerun from a clean shell by their author; no fresh-context reproduction.
