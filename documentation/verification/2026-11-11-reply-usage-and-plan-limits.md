# Proof: usage under each reply, Codex's billing kind, and plan limits (step 3 of the budget-control blueprint)

- **Verdict:** partly proven. The behavior is proven against the repository's stand-in harnesses and by Codex probes that make no model call; the values only a paid model call would show (Claude Code's `apiKeySource` and `rate_limit_event`, OpenCode's reports) are not probed, and the look awaits the owner.
- **Work:** working tree on `93e7f10` (main), after steps 1 and 2, staged and uncommitted when proven
- **Agreement:** CHG-0126, [budget-control specifications](../capabilities/budget-control/specifications.md) (Seeing budget use and consumption, Plan limits, Live probes) and [blueprint](../capabilities/budget-control/blueprint.md) (delivery step 3)
- **Environment:** macOS, Codex CLI 0.167.1 signed in with a ChatGPT account (probe only), Bun workspace, Electron as Node, Expo web export on localhost:8099, Playwright (Python) with Chromium; throwaway data folder `/tmp/gild-limits`, with the stand-in Claude Code, Codex, and OpenCode and a stand-in price table (never the owner's `Gild` data)
- **Date:** 2026-11-11

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| E1 | Codex's billing kind is read from its own `account/read` (`chatgpt` is Subscription, `apiKey` is API key, anything else Unknown), and decides which unit its turns count toward | specification, Billing kind | proven against the stand-in, and the call's answer probed live |
| E2 | A subscription account's plan limits are read from Codex's app server, once, kept, and shown with their windows; an API-key account is asked for none | specification, Plan limits | proven against the stand-in |
| E3 | Reads are paced: one at a time, a reading stands four minutes, a failure waits 5, 10, 20, 40, then 60 minutes, and the last reading stays | specification, Plan limits | proven |
| E4 | A harness that cannot answer shows "Limits not reported", never a guess | specification, Plan limits | proven |
| E5 | Under each agent reply a line shows the call's tokens and cost; a turn that reports only per turn shows its use under its last reply; a reported cost is shown as reported; an unpriced model shows tokens only; the lines add up to the turn | specification, Seeing budget use and consumption | proven against the stand-ins |
| E6 | Claude Code's per-call usage from its assistant events is attached to the reply it came with | specification, Seeing budget use and consumption | proven against the stand-in |
| E7 | The rail, the Charter's account rows, and the thread panel show the plan limits, orange from 80% | specification, Plan limits | proven in the page; appearance awaits the owner |
| E8 | No regression | blueprint, step 3 | proven |

## Evidence

### Live probe of Codex (no model call)

- **Check:** a script started `codex app-server` (0.167.1), sent `initialize`, then `account/read` and `account/rateLimits/read`, and printed the answers' shapes.
- **Result:** `account/read` answered `{ account: { type: "chatgpt", planType: "plus", … } }`; `account/rateLimits/read` answered `rateLimits.primary` `{ usedPercent, windowDurationMins: 300, resetsAt }`, `rateLimits.secondary` `{ usedPercent, windowDurationMins: 10080, resetsAt }`, and `credits`. The stand-in answers the same shapes. The account's email and figures are not copied here.
- **Not probed:** Claude Code and OpenCode: each needs a paid model call on the owner's account; the specification lists what remains.

### E1 to E4: billing kind and plan limits

- **Check:** `bun run test packages/service/test/harness/harnesses.test.ts packages/service/test/usageReadGate.test.ts` ("counts a ChatGPT sign-in's turn as subscription tokens", "counts an API-key sign-in's turn as cost ...", "reads an account's plan limits from the app server, once, and keeps the reading", "shows no plan limits when the app server cannot give them, and does not ask again at once", "gives an API-key account no plan limits, and asks for none", and the five gate tests), through the service's requests and the stand-in app server's request log.
- **Shown able to fail:** ten mutations in a separate worktree were each caught: P1 (Codex always API key) 3 tests; P2 (a reading never stands) 3; P3 (failures wait a fixed 5 minutes) 1; P4 (a failed read is not waited out) 1; P5 (mislabelled windows) 1; P6 (an API-key account still asked for limits) 1; P7 (the remainder not given to the last reply) 6; P8 (Claude Code reports no per-call usage) 1; P9 (a reported cost shown as estimated) 1; P10 (the reading not kept) 1.
- **Result:** the windows read `5-hour` 40% resetting at `1794405450000` and `Weekly` 93%; the request log holds one `account/rateLimits/read` after four reads of the accounts; the gate waits 5, 10, 20, 40, 60, 60 minutes.
- **Reproduced:** by me, three runs; match.

### E5, E6: the lines under replies

- **Check:** `prices.test.ts` ("cost on each agent reply": six tests) and `claude.test.ts` ("shows the reply's own call under it, and the rest of the turn's usage with it, so the lines add up"). Expected figures are worked from the stand-in prices (1,000,000 input tokens at $3 is $3; 0.9 + 0.45 for 300,000 input and 30,000 output tokens).
- **Shown able to fail:** P7, P8, and P9 above.
- **Result:** the reply of a turn that spent 1,000,000 tokens shows `{ estimated: 3 }`; an API-key turn shows `{ reported: 2.5 }`; two turns show 3 and 6; the Claude Code stand-in's call (3 input, 7 output, 60 cache read, 5 cache write tokens) plus the turn's rest equals the turn (50, 100, 3, 10 by kind).
- **Limit:** only one reply per turn can be scripted in the stand-ins, so the per-call attachment is shown to sum to the turn, not to split it across two replies.

### E7: the screens

- **Check:** `drive.py` ([script](2026-11-11-reply-usage-and-plan-limits/drive.py), [service](2026-11-11-reply-usage-and-plan-limits/serve.ts.txt)): a Claude Code quest and a Codex quest on the stand-ins.
- **Result:** the rail shows "5-hour · 40% used · resets 14:57" and "Weekly · 93% used · resets 16:57" (the weekly line orange); the Codex thread panel shows "Plan limits 5-hour 40% · Weekly 93% · as of 10:24" and the Claude Code panel "Limits not reported"; the Charter lists each account with the same lines; under each agent reply a line such as "107 tokens · ≈ $0.00" (a cost under half a cent is now shown as "< $0.01" after this drive). Screenshots: [rail](2026-11-11-reply-usage-and-plan-limits/01-rail-plan-limits.png), [Claude Code reply](2026-11-11-reply-usage-and-plan-limits/02-claude-reply-line.png), [Codex reply](2026-11-11-reply-usage-and-plan-limits/03-codex-reply-line.png), [Charter](2026-11-11-reply-usage-and-plan-limits/04-charter-plan-limits.png).
- **Reproduced:** by me, two runs; match.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Typecheck | `bun run typecheck` | pass | pass |
| Lint and format | `bun run check` | pass | pass |
| Tests | `bun run test --maxWorkers=3` | not run | 722 passed, 10 skipped, 2 failed under load |
| The two failing tests alone | `bun run test packages/service/test/harness/harnesses.test.ts packages/service/test/lore/loreOverTime.test.ts` | not run | 54 passed |
| Web export | `cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export` | not run | pass |

- The two timing-sensitive tests (OpenCode interrupt, Lore fading) time out under parallel load, as recorded in CHG-0125; they pass alone.

## Not proven

- **Live Claude Code and OpenCode values:** `apiKeySource`, `rate_limit_event`, `total_cost_usd` as a running total, OpenCode's sign-in and usage; none is claimed. Their plan limits show "Limits not reported".
- **Live per-call usage** on any harness, and a live Codex turn with a billing kind: only the probe calls above ran live.
- **Appearance** of the rail lines, the Charter rows, the thread panel row, and the reply lines awaits the owner.
- **Two replies in one turn:** not scriptable in the stand-ins.
- **A plan limit never going stale on its own:** a reading is shown with its time and replaced only by a paced read.

## Reproduce

```sh
bun run typecheck && bun run check && bun run test --maxWorkers=3
# the window drive, from packages/service (the stand-ins are read from its test/fixtures):
cp ../../documentation/verification/2026-11-11-reply-usage-and-plan-limits/serve.ts.txt scratch-serve.ts
GILD_DATA_DIR=/tmp/gild-limits ELECTRON_RUN_AS_NODE=1 ../../node_modules/.bin/electron scratch-serve.ts > /tmp/gild-serve.log &
# from apps/app: bunx expo export --platform web --output-dir /tmp/gild-export, then `python3 -m http.server 8099` inside it
python3 documentation/verification/2026-11-11-reply-usage-and-plan-limits/drive.py documentation/verification/2026-11-11-reply-usage-and-plan-limits
# afterwards: stop both processes and delete packages/service/scratch-serve.ts
```

## New files

`packages/service/test/usageReadGate.test.ts` and this proof's folder.
