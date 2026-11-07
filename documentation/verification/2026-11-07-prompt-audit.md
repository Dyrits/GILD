# Proof: prompt audit changes

- **Verdict:** proven for the four service claims. The instruction-file claims (5) were checked against the repository.
- **Work:** working tree on `ab85b66`, committed after this proof (CHG-0057).
- **Agreement:** the owner's instruction of 2026-11-07, "Apply all the changes you feel relevant", after a `/claude-api prompt-audit` report.
- **Environment:** macOS 26, Bun, Electron's Node (`ELECTRON_RUN_AS_NODE=1`), the stand-in Claude Code script `packages/service/test/fixtures/stand-in-claude.mjs`. No live Claude Code thread was run.
- **Date:** 2026-11-07

## Claims

| # | Claim | Source | Check | Verdict |
| --- | --- | --- | --- | --- |
| 1 | A journal change between turns neither restarts Claude Code nor changes its `--append-system-prompt`; the system prompt carries the journal's instructions, not its contents | Audit finding 1 | `claude.test.ts` › "keeps its system prompt and process across a journal change, and sends the change with the turn": one process start; the system prompt contains `# Mission journal` but no `Briefing (version` | proven |
| 2 | The turn's message carries the journal, intel, and budget ahead of a `---` line, then the messages | Audit finding 1 | The same test: the reply echoes `# Mission journal at this turn … Chose SQLite. … \n---\n\nTwo` | proven |
| 3 | Every argument a thread fills in has a description; `save_intel` names the temporary kind | Audit findings 5–7 | `threadTools.test.ts` › "describes every argument a thread fills in", "names every intel kind in save_intel" | proven |
| 4 | The budget line ends with what happens at a limit | Audit finding 8 | `budget.test.ts` › "carries a budget line in each turn's context…" now also expects "At a limit, OpenMission stops the work under it and asks the owner." | proven |
| 5 | `apps/app/AGENTS.md` and `.agents/ai-tooling.md` match the repository | Audit findings 2–4, 9 | `grep -n "export const claudeHarnessLayer" packages/service/src/claude.ts` gives line 217; root `package.json` defines `check` (Biome) and `apps/app/package.json` defines `typecheck`; `documentation/architecture.md:3` names the web build in the Electron window | proven by reading |

## Shown able to fail

The four new checks were run against the starting commit `ab85b66`, in a separate worktree, with only the end state's test files copied in:

```sh
W=/tmp/om-verify-before
git worktree add -q --detach $W ab85b66
for d in node_modules packages/service/node_modules packages/contracts/node_modules; do [ -e $d ] && ln -s "$PWD/$d" "$W/$d"; done
for f in packages/service/test/claude.test.ts packages/service/test/budget.test.ts packages/service/test/threadTools.test.ts packages/service/test/fixtures/stand-in-claude.mjs; do cp $f $W/$f; done
(cd $W && ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run packages/service/test/claude.test.ts packages/service/test/budget.test.ts packages/service/test/threadTools.test.ts)
git worktree remove --force $W
```

Result: 4 failed, 35 passed, 5 skipped. Each new check failed for its claim's reason:
- the journal test failed with "expected [ …(2) ] to have a length of 1 but got 2", because the old code restarts the process when the journal changes;
- the budget test failed because the old line has no "At a limit" sentence;
- both tool-listing tests failed.

The existing tests passed there with the updated helper and stand-in.

## Regressions

`bun run test` (314 passed, 5 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, and `bun run build` in `apps/desktop` passed on the end state.

## Not verified

The cache reads of a live Claude Code thread across a journal change. To check: run a thread on Claude Code, add a journal entry, send a second message, and compare the second turn's `cacheRead` with the first's.

## Reproduction

A fresh agent that had not seen the implementation reran every command in this proof from the file alone. Its results matched:
- the same 4 failures on the starting commit, with the same reasons;
- 314 passed and 5 skipped on the end state;
- typecheck, check, `git diff --check`, and the desktop build passed.

It found one wrong citation, which is now corrected: the Electron web-build sentence is on `architecture.md:3`, not `:44`.
