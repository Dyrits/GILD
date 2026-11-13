# Verification: review fixes (CHG-0255)

Verdict: partly proven. Scope: the batch described in CHG-0255, against the starting commit `39fee06`.

## Claims

| Claim | Evidence | Verdict |
| --- | --- | --- |
| A reconnection that fails before opening is retried; closing ends a pending attempt | `apps/app/test/foundation/client.test.ts`: fails on `39fee06` (2 sockets instead of 3; a timer still fires after close), passes on the end state | proven |
| `ChangeSettings` merges into saved settings and refuses invalid values | `packages/service/test/changeSettings.test.ts`: fails on `39fee06` (unknown request), passes on the end state | proven |
| `ReadThreadTree` returns the mission's threads' places and refuses an unknown mission | `packages/service/test/threadTree.test.ts`: fails on `39fee06`, passes on the end state; passed 6 of 6 repeated runs | proven |
| The image cache is bounded, shares in-flight fetches, forgets failures | `apps/app/test/attachments/imageCache.test.ts`: module absent on `39fee06`, 5 tests pass on the end state | proven |
| The side panel mode (`detailsModeOf`) matches the former conditional | `apps/app/test/shell/navigation.test.ts`, 5 tests; the old conditional was read against the new one, not run | proven for the function, unproven for the screen |
| `useServiceQuery` shows only its latest read; the composer clears only what was sent; the quest list reads once | Typecheck and a source-level probe in the review only; no component test | unproven |
| The screens behave as before in a window | Not driven; the web bundle compiles (`expo export --platform web`) | awaiting human judgment |

## Regressions

- `bun run check` and `bun run typecheck`: pass.
- `bun run test`: passed 3 runs in a row on a quiet machine (1364 passed, 14 skipped by condition). Before the `timing` project and `retry` were added, `harness` and `lore` tests failed intermittently, also without this batch's changes (7 failures in 6 runs on `39fee06`, 1 with the batch).
- `hostOnlyRequests` failed on `39fee06` (stale list) and passes after its update.

## Reproduce

`bun install`, then `bun run check`, `bun run typecheck`, `bun run test`. For before and after, copy the five new test files into a worktree of `39fee06` and run them with `bunx vitest run <files>`.

Reproduction by a second agent was not done.
