# Proof: thread panel and context gauge

- **Verdict:** partly proven. Service behavior and labels are proven by tests; the panel was seen once in a browser render with the fake harness; no live harness turn was run and the owner has not accepted the look.
- **Work:** working tree on `24ccaaf` (CHG-0079)
- **Agreement:** the owner's instruction to build the backlog entry "Thread panel and context gauge" unattended; specification in [thread-panel](../capabilities/thread-panel/specifications.md), whose unsettled points are provisional.
- **Environment:** macOS, Electron 45 as Node (service) and as a page renderer, Expo web export
- **Date:** 2026-11-09

## Claims

| # | Claim | Evidence | Verdict |
| --- | --- | --- | --- |
| C1 | A thread with no reported usage has no context gauge and no spending | `threadPanel.test.ts` | proven |
| C2 | A reported context splits into Instructions, Lore, Journal, Messages, Tools and results, adding up exactly to the reported total, none negative; counted parts exceeding the total are scaled down | `threadPanel.test.ts` (two tests) | proven |
| C3 | The context is the latest turn's measure, not a sum over turns | `threadPanel.test.ts` | proven |
| C4 | A thread's spending counts only its own turns; the budget is the quest's | `threadPanel.test.ts` | proven |
| C5 | Claude Code's context is the latest assistant call's usage, not the result's sum | `claude.test.ts` against the stand-in (75 against a result sum of 162) | proven for the stand-in only |
| C6 | Codex's context is its latest call's input (cached included) plus output; OpenCode's the latest prompt's input, cached input, and output | `harnesses.test.ts` against the stand-ins (107, 138) | proven for the stand-ins only |
| C7 | The gauge turns orange from 80% and red from 95%; its text and the spending line read as specified | `labels.test.ts` | proven |
| C8 | The panel shows beside the conversation with the gauge bar, legend, lore, skills, spending, and budget | [screenshot](2026-11-09-thread-panel/desktop-1440.png), fake harness, `spend 90000 1.25` | observed once; appearance awaits the owner |

## Not proven

- That the three harnesses report per-call usage the way the stand-ins do. Claude Code's assistant events may carry a partial `output_tokens` (the call's output grows while it streams); the measure is then a little low. No live probe was run.
- The panel at other widths, the narrow layout (no panel below 820px), native builds, and the remembered open state.
- The orange and red looks, and the "Skills" row's expand toggle in the running window.

## Regressions

`bun run typecheck`, `bun run check`, and `bun run test` (430 passed, 10 skipped) pass; the web export builds.

## Reproduce

Tests: `bun run test`. The look was captured with throwaway scripts that are not kept: a script inside `packages/service` that built `serviceLayer` with `fakeHarnessLayer`, started a quest with the text `spend 90000 1.25`, and served it with `serveLoopback` (run with `ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron`, which prints the WebSocket endpoint); the web export (`cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export`) served on port 8099; and an Electron window whose preload exposed `window.gild.endpoint()` returning that endpoint, opened the quest, pressed "Thread panel", and saved `capturePage()`.
