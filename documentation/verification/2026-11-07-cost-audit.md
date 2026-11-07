# Proof: cost audit change (titles out of the system prompt)

- **Verdict:** proven for both claims.
- **Work:** working tree on `f9de337`, committed after this proof (CHG-0058).
- **Agreement:** the owner's instruction of 2026-11-07, "Apply all the changes you feel relevant", after a `/claude-api cost-optimize` report.
- **Environment:** macOS 26, Bun, Electron's Node (`ELECTRON_RUN_AS_NODE=1`), the stand-in Claude Code script `packages/service/test/fixtures/stand-in-claude.mjs`. No live Claude Code thread was run, and no model was called.
- **Date:** 2026-11-07

## Claims

| # | Claim | Source | Check | Verdict |
| --- | --- | --- | --- | --- |
| 1 | A title change between turns (the owner's rename, or `set_mission_title`, which runs on every mission's first turn) neither restarts Claude Code nor changes its `--append-system-prompt`; the system prompt names the thread by id | Cost audit lever 1 | `claude.test.ts` › "keeps its system prompt and process across a mission rename, and gives the title with the turn": one process start; the system prompt contains `You are thread <id>` | proven |
| 2 | The turn's message carries the thread's current title (and its opener's) | Cost audit lever 1 | The same test: the last message contains `Your title: "Renamed mission".` | proven |

## Shown able to fail

```sh
W=/tmp/om-verify-before
git worktree add -q --detach $W f9de337
for d in node_modules packages/service/node_modules packages/contracts/node_modules; do [ -e $d ] && ln -s "$PWD/$d" "$W/$d"; done
cp packages/service/test/claude.test.ts $W/packages/service/test/claude.test.ts
(cd $W && ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run packages/service/test/claude.test.ts)
git worktree remove --force $W
```

Result: 1 failed, 19 passed, 5 skipped. The new test failed with "expected [ …(2) ] to have a length of 1 but got 2": the old code restarts the process when the title changes.

## Regressions

`bun run test` passed 315 with 5 skipped, twice in a row. The first full run after the change had one failure that did not recur; its test was not identified. Typecheck, `bun run check`, and `git diff --check` passed.

## Reproduction

A fresh agent given only this file reran every command above. Results: 1 failed, 19 passed, 5 skipped on `f9de337` with the same assertion; the new test passed on the end state; `bun run test` 315 passed with 5 skipped; typecheck, `bun run check`, and `git diff --check` clean; the checkout unchanged afterwards. All matched.

## Not verified

A live Claude Code thread's `cache_read_input_tokens` on a mission's second turn.
