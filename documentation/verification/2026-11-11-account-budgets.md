# Proof: budget scopes, account budgets, and credits (step 2 of the budget-control blueprint)

- **Verdict:** partly proven. The behavior is proven by tests at the service's public interface, mutations that each check caught, and a drive of the real service and the web build; the look awaits the owner.
- **Work:** working tree on `0e16c79` (main), on top of step 1 (`4724ebc`), staged and uncommitted when proven
- **Agreement:** CHG-0126, [budget-control specifications](../capabilities/budget-control/specifications.md) (Account budgets and credits, Reaching a limit, Record) and [blueprint](../capabilities/budget-control/blueprint.md) (delivery step 2)
- **Environment:** macOS, Bun workspace, Electron as Node, Expo web export on localhost:8099, Playwright (Python) with Chromium; throwaway data folder `/tmp/gild-accounts` and the fake harness (never the owner's `Gild` data)
- **Date:** 2026-11-11

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| D1 | An account's budget stops the threads running on that account across quests, and no thread on another account | specification, Reaching a limit | proven |
| D2 | Raising the budget lets the stopped threads carry on; Stop leaves them Stopped | specification, Reaching a limit | proven |
| D3 | A quest started on an account at its budget is refused with a reason naming the account | specification, Reaching a limit | proven |
| D4 | An account budget counts only the account's own turns since counting began (the period's start, or the day of the credits) | specification, Account budgets | proven |
| D5 | Credits show what is left, **Add credit** raises the cost limit, and an account with none left stops and still decodes in the app | specification, Credits | proven |
| D6 | Removing an account removes its budget | specification, Account budgets | proven |
| D7 | **Switch to a backup Companion** hands the held thread to its next backup, which carries on, and is refused when there is none | specification, Reaching a limit | proven |
| D8 | Each stopped quest gets a line naming the account and what was reached, and each turn's budget line carries the account's share | specification, Record; Seeing budget use | proven |
| D9 | The stop question for an account shows the quick raises, Switch to a backup Companion, and Stop; the Charter lists each account's budget with "counted by Gild" | specification, Account budgets | proven in the page; appearance awaits the owner |
| D10 | The mission and global budgets behave as before the scope refactor | blueprint, Budget scope | proven |
| D11 | No regression | blueprint, step 2 | proven |

## Evidence

### D1 to D8: the service

- **Check:** `bun run test packages/service/test/accountBudgets.test.ts` (12 tests: "stops the threads on the account across quests, and no others", "is raised by the owner ...", "leaves its threads stopped when the owner answers Stop", "refuses a quest started on an account at its budget", "counts only what the account's own turns used since it began counting", "tells each thread how much of the account's budget is used", "records a line in each stopped quest", the three credits tests, the two switching tests), through the service's requests with the fake harness on an added account "Work".
- **Shown able to fail:** the 12 tests were red before the code; nine mutations in a separate worktree were each caught: N1 (a stop covers every account) 1 test; N2 (spending ignores the start of counting) 1; N3 (the account left out of the reached scopes) 8; N4 (Add credit adds nothing) 1; N5 (the budget survives the account's removal) 1; N6 (Switch does not release the held thread) 1; N7 (a start on a reached account is allowed) 1; N8 (the account part left out of the budget line) 1; N9 (no stop line) 1. The decode check of D5 failed against the first contract (`remaining` reused `BudgetLimits`, which rejects 0), a defect the drive found first.
- **Result:** the stop reads `{ scope: "Account", account: { accountId, harness: "claude" }, accountLabel: "Claude Code · Work" }`; the line reads "Account Claude Code · Work reached its budget: 2,000 of 1,000 tokens"; the turn's note reads "account Work: 20% of this month's tokens".
- **Reproduced:** by me, four runs; match.

### D10: the refactor

- **Check:** the 19 existing tests of `budget.test.ts` pass unchanged through the new scope module, which replaced the `missionId | null` convention.
- **Shown able to fail:** N3 above removes the scope list the mission and global stops are built on and 8 tests fail.

### D9: the screens

- **Check:** `drive.py` ([script](2026-11-11-account-budgets/drive.py), [service](2026-11-11-account-budgets/serve.ts.txt)): an account "Work" with a 1,000-token budget, a quest on it that spent 2,000, a second quest on it still running, and a third on the computer's own sign-in.
- **Result:** the stopped quest shows "The budget of Claude Code · Work is reached. Its running quests and side-quests stopped." with Raise budget +25%, +50%, Double, Switch to a backup Companion, and Stop, and the line "Account Claude Code · Work reached its budget: 2,000 of 1,000 tokens"; Double makes 2,000 of 2,000, still reached (the question stays); a second Double makes 4,000 and the question is gone; the Charter lists "Claude Code · This computer" and "Claude Code · Work" with "2,000 of 4,000 tokens · 50% left this month · counted by Gild". Screenshots: [stop question](2026-11-11-account-budgets/02-account-stop.png), [after the first Double](2026-11-11-account-budgets/03a-after-first-raise.png), [after the second](2026-11-11-account-budgets/03b-after-second-raise.png), [Charter](2026-11-11-account-budgets/04-charter-account-budgets.png).
- **Shown able to fail:** the first drive found the quick raises missing and the Charter list empty (the contract defect above), so the drive can fail.
- **Reproduced:** by me, three runs; match.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Typecheck | `bun run typecheck` | pass | pass |
| Lint and format | `bun run check` | pass | pass |
| Tests | `bun run test --maxWorkers=3` | not run | 700 passed, 10 skipped |
| Web export | `cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export` | not run | pass |

## Not proven

- **Appearance** of the stop question, the quick raises, and the Charter card awaits the owner.
- **Account periods starting over** (the release timer now watches the accounts' periods): not driven by a test clock; the existing global-period release is unchanged.
- **Credits' day** is the owner's local day typed as `YYYY-MM-DD`; only a future day is tested, not the day boundary.
- **The account row** is a separate "Account budgets and credits" card in the Charter's Limits section, not on each account's row in the Accounts card as the specification words it.

## Reproduce

```sh
bun run typecheck && bun run check && bun run test --maxWorkers=3
# the window drive, from packages/service:
cp ../../documentation/verification/2026-11-11-account-budgets/serve.ts.txt scratch-serve.ts
GILD_DATA_DIR=/tmp/gild-accounts ELECTRON_RUN_AS_NODE=1 ../../node_modules/.bin/electron scratch-serve.ts > /tmp/gild-serve.log &
# from apps/app: bunx expo export --platform web --output-dir /tmp/gild-export, then `python3 -m http.server 8099` inside it
python3 documentation/verification/2026-11-11-account-budgets/drive.py documentation/verification/2026-11-11-account-budgets
# afterwards: stop both processes and delete packages/service/scratch-serve.ts
```

## New files

`packages/service/test/accountBudgets.test.ts` and this proof's folder.
