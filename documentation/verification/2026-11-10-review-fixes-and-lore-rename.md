# Proof: the review fixes and the rename of intel to lore in the code

- **Verdict:** partly proven. The logic claims (C1 to C6, C8) are shown by checks that fail when the code is broken. The screen behavior (C7) has no test and was not seen in a window: awaiting human judgment.
- **Work:** working tree on `2221cbe`, uncommitted when proven
- **Agreement:** the owner's request of 2026-11-09 to fix every finding of the code review of commits `42a60db` and `2221cbe`, and to call intel lore in the code, keeping stored and wire names (CHG-0093). The six architecture candidates were not part of it.
- **Environment:** macOS, Electron 45 as Node (Vitest), the fake harness and the Claude Code stand-in
- **Date:** 2026-11-10

## Claims

| # | Claim | Evidence | Verdict |
| --- | --- | --- | --- |
| C1 | `samePath` matches a folder with its `/private` form and a trailing separator, and no longer matches a path that only shares an end (`/work` and `/Users/x/work`) | `apps/app/test/paths.test.ts` | proven |
| C2 | A reply from a harness that names no model keeps the thread's chosen model, so a later switch does not relabel it; the default model stays empty | `packages/service/test/replyModel.test.ts` | proven |
| C3 | Claude Code's `<synthetic>` placeholder is recorded as no model | `claude.test.ts`, "records no model for a reply under Claude Code's own `<synthetic>` placeholder" (the stand-in takes `STAND_IN_MODEL`) | proven |
| C4 | A bare Claude alias (`sonnet`) is labelled "Anthropic - Sonnet" | `apps/app/test/companionLabel.test.ts` | proven |
| C5 | A realm's lore view lists that realm's own deleted entries and no other deleted one | `lore.test.ts`, "a realm's lore" | proven |
| C6 | Intel is lore in the code, with stored and wire names kept | `bun run typecheck` and the full suite pass with every stored-name test unchanged; the remaining `intel` lines were counted by category by the rename (tool names, SQL, request tags, settings keys) | proven |
| C7 | A quest's budget or journal screen, a realm's lore and its crest studio close when another quest or realm is chosen; renaming a realm saves once; the realm panel's figures ignore the search; breadcrumbs of an archived quest and of repeated labels are right; the crest studio starts from the crest shown and its text can be cleared | code read only: these are screen behaviors with no test seam | awaiting human judgment |
| C8 | No regression | `bun run format` (no fixes), `bun run typecheck`, `bun run test`: 458 passed, 10 skipped | proven |

## Shown able to fail

Each mutation ran in a separate worktree of the end state; the checkout was untouched (`git status` unchanged) and the worktree was removed.

| Check | Mutation | Result |
| --- | --- | --- |
| C1 | `samePath` compares with `endsWith` again | fails: 2 of 3 tests |
| C2 | `saveTurnReply` stores the reported model only | fails: the chosen-model test |
| C3 | the synthetic filter in `claude.ts` removed | fails: the new test (it survived until the test was added) |
| C4 | the bare alias case in `knownModelOf` removed | fails: 1 of 4 tests |
| C5 | the workspace filter in `listDeletedLore` disabled | fails: the realm lore test (it survived until the test deleted a second, thread-scope entry) |

## Not proven

- C7: no component test seam exists for these screens. After an undo, the emblem text field can still show the earlier text.
- Symbolic links: `samePath` does not resolve a link the service resolved differently; the durable fix is architecture candidate 2 of `documentation/architecture-audit/architecture-audit-2026-11-09-2351.html`.
- Replies saved before migration `0024` have no model and still take the thread's current one for their label.

## Regressions

`bun run format`, `bun run typecheck` and `bun run test` pass. The biome check runs again in the pre-commit hook.

## Reproduce

1. `bun run test` runs all the checks above (458 passed, 10 skipped).
2. For a mutation: `git worktree add --detach /tmp/gild-mut HEAD`, apply `git diff HEAD --binary` there and copy the untracked files, link the `node_modules` folders, break one line named in the table, and run the named test file with `ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run <file>`.

Reproduced by rerunning the full suite from a clean shell after the last edit.
