# Proof: one Containment decision for harness actions (CHG-0216)

- **Verdict:** proven for the four code claims; the app's question card and real harnesses are not seen (see Not proven)
- **Work:** working tree on `fbf830b`, later committed as CHG-0216
- **Agreement:** the [2026-11-12 architecture audit](../architecture-audit/architecture-audit-2026-11-12-2245.html), candidate 1, findings P5 and P6; CHG-0208
- **Environment:** macOS (Darwin 25.6.0), Bun and Electron 45 as the project's `test` script runs them (`ELECTRON_RUN_AS_NODE=1`), stand-in harnesses from `packages/service/test/fixtures`
- **Date:** 2026-11-13

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | `needsOf` and `isUnaskedAt` decide what an action needs from level, sandbox, action, and folder | audit candidate 1 | proven |
| C2 | Claude Code reports itself sandboxed only at the default level on a host that can sandbox | audit candidate 1 | proven |
| C3 | Codex marks requests as leaving the sandbox only at the default level, so a command asks as "Run a command" at "Also commands and edits" (P5) | audit P5 | proven |
| C4 | An edit in an OpenCode folder that is a link asks when no sandbox tool exists (P6) | audit P6 | proven |
| C5 | Existing behaviour is kept elsewhere | CHG-0208 | proven by the full suite |

## Evidence

### C1: the decision function

- **Check:** `ELECTRON_RUN_AS_NODE=1 npx electron node_modules/vitest/vitest.mjs run packages/service/test/policy/containment.test.ts` (9 tests).
- **Shown able to fail:** four mutations in a separate worktree of the end state, each turned the table red and was reverted: unprotected harness needing nothing (1 failed), `isUnaskedAt` ignoring the level (1 failed), the in-folder test inverted (2 failed), the escape ignored (1 failed). The baseline there passed 9 of 9.
- **Result:** 9 passed on the working tree.
- **Reproduced:** rerun by the author only, from the same shell; no independent reproduction.

### C2 to C4: the adapter fixes

- **Check:** `claude.test.ts` "reports itself sandboxed only at the default level on a host that can sandbox"; `harnesses.test.ts` "asks about a command as an ordinary one, not an escape, at the level asking before commands and edits" and "asks before an edit in a folder that is a link when no sandbox tool exists, without asking about the start".
- **Shown able to fail:** before and after: with `harness/codex.ts`, `opencode.ts`, `claude.ts`, and `claudeArgs.ts` stashed, the three tests failed; with them restored, they passed.
- **Result:** 124 passed, 5 skipped across the policy, Claude, and harness files.
- **Reproduced:** by the author only.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Typecheck | `bun run typecheck` | not run | pass (6 of 6) |
| Lint | `npx biome check .` | not run | pass |
| Tests | `ELECTRON_RUN_AS_NODE=1 npx electron node_modules/vitest/vitest.mjs run` | not run | pass, 1324 passed, 14 skipped, on two runs; a first run had one failure in an `InterruptThread` test that did not recur |

Nothing failed on the end state, so no failure needed to be compared with the starting commit.

## Not proven

- The new wording of the question card in the running app, and a real Codex or Claude Code at "Also commands and edits": the stand-ins prove the adapter and Approvals seam, not the real programs.
- The consequence for standing permissions (a permission saved for an ordinary command at the default level no longer covers it for Claude Code at "Also commands and edits"): derived from the code and recorded in CHG-0216, not tested on its own.
- The one-off `InterruptThread` failure: not investigated.

## Reproduce

```sh
bun install --frozen-lockfile
bun run typecheck
npx biome check .
ELECTRON_RUN_AS_NODE=1 npx electron node_modules/vitest/vitest.mjs run
```

## New files

`packages/service/test/policy/containment.test.ts`, committed with the work.
