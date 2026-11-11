# Handoff: consumption, estimated cost, account budgets, and plan limits

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `main` (pushed to `origin/main`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Show what every turn used and an estimated cost for every harness, count budgets by billing kind, add account budgets with credits, and show each subscription's plan limits, all without Gild holding provider credentials. The agreed behavior (CHG-0126) is built in three steps; what remains is the owner's review, a few live probes that need a paid model call, and two open decisions.

## State

- **Built and pushed** (verified: `git log origin/main` holds them; typecheck, Biome, and `bun run test --maxWorkers=3` were run after step 3 with 722 passed and 2 timing tests failing under load, which pass alone):
  - Step 1 `4724ebc`: billing kind per turn, estimated cost (`≈ $x`), the models.dev price table (`core/prices.ts`, `core/priceSources.ts`, shipped snapshot `core/priceSnapshot.ts`, refresh at startup and daily in `work/priceRefresh.ts`), the Charter's Fetch prices card, `work/consumption.ts`, and `≈` figures on the card, panels, rail, top bar, and budget window with splits by harness and model.
  - Step 2 `93e7f10`: `work/budgetScopes.ts` (mission, global, account scopes; also the budget line and refusals), `work/budgets.ts` rewritten over it, `work/accountBudgets.ts`, Switch to a backup Companion, and the Charter's "Account budgets and credits" card.
  - Step 3 `97e0457`: `reply_usage` (a line under each agent reply, the turn's remainder added to its last reply), Codex's billing kind from `account/read`, plan limits through `work/planLimits.ts` with the pure pacing gate `work/usageReadGate.ts`, shown in the rail, the Charter, and the thread panel.
  - Records: specification and blueprint under `documentation/capabilities/budget-control/`, glossary terms (Account budget, Billing kind, Estimated cost, Plan limit), requirement "Price table read carries no owner data", a proposed decision record 0014, and three proofs under `documentation/verification/`.
- **Committed with this handoff:** the changelog entry CHG-0141. Another session works in the same repository (app icons, see its own handoff); stage only your own files by path, never `git add -A`.
- **Verified live:** Codex 0.167.1 `account/read` and `account/rateLimits/read` answer the shapes the code reads (probed without a model call, 2026-11-11).
- **Assumed, not probed** (each needs a paid model call on the owner's account): Claude Code's `apiKeySource` values (`none` taken as Subscription, any other as API key), its `rate_limit_event`, whether `total_cost_usd` is a running total; OpenCode's sign-in and usage; usage per model call on any harness live. Claude Code's and OpenCode's plan limits show "Limits not reported", and OpenCode's billing kind is Unknown (counts as Subscription).
- **Not seen by the owner:** the look of every new screen (cards, panels, the stop question for an account, the Charter cards, rail plan lines, reply lines).
- **Push:** `main` was pushed with `git push --no-verify` on the owner's explicit instruction to push on `main`; the pre-push hook refuses an agent otherwise.

## Decisions

- Keep the harness command-line tools; no vendor SDK. The Claude Agent SDK is not open source and forbids claude.ai login in products built on it; the Codex SDK wraps `codex exec` with less than the app-server adapter. Recorded in the [backlog](../../documentation/backlog.md) and [decision record 0008](../../documentation/architecture-decision-record/0008-drive-harness-tools-directly.md).
- Estimates are shown, not counted, except for an API-key turn whose harness reported no cost (provisional: the owner answered "I guess"). Recorded in the specification, Budgets.
- Price table first, the harness's own cost only for a model the table lacks; prices stamped when a turn ends, never recomputed; turns before billing kinds stay unpriced. CHG-0126.
- One budget-scope module (mission, global, account) rather than another branch on the `null` convention. CHG-0126.
- Codex plan limits come from a short `codex app-server` per read, paced (one at a time, four-minute reading, 5 to 60 minute back-off); no CLI token or credential is ever read, because Comply with provider terms forbids it. [Requirements](../../documentation/requirements.md).
- Account budgets are the owner's entry, counted only from Gild's own turns, and say so ("counted by Gild"); Gild cannot read a provider's balance.

## Next

1. Confirm with the owner: their review of the new screens; whether to accept decision record 0014 (then add the read to `documentation/architecture.md`, Integrations and Decisions, and to `AGENTS.md`); the API-key rule; the requirement's wording; and whether account budgets should move onto each account's row in the Accounts card.
2. If the owner agrees to a paid call, run the live probes listed under Live probes in the budget-control specification, one harness at a time (Claude Code first), and record results there; then map Claude Code's and OpenCode's plan limits and billing kinds.
3. Check `documentation/backlog.md` for the open terms question on subscription use through the `claude` tool, and the OpenCode HTTP-server probe.
4. After any change: `bun run typecheck && bun run check`, the affected tests, and `bun run test --maxWorkers=3` (expect timing failures under load; rerun those files alone).

## Open questions

- Is driving the `claude` CLI on a subscription within Anthropic's terms, given the Agent SDK's rule against claude.ai login in products built on it? The owner decides; check Anthropic's current Claude Code legal page.
- Should an API-key turn with no reported cost count its estimate toward a cost limit (current, provisional), or never?
- Does OpenCode's HTTP server report cost and limits that ACP does not? A probe, then an amendment to decision record 0008 for OpenCode alone.

## Sources

- `documentation/capabilities/budget-control/specifications.md` and `blueprint.md`
- `documentation/changelog.md` (CHG-0126 agreement, CHG-0141 delivery)
- `documentation/verification/2026-11-10-consumption-and-cost.md`, `2026-11-11-account-budgets.md`, `2026-11-11-reply-usage-and-plan-limits.md`
- `documentation/architecture-decision-record/0014-model-prices-from-a-public-table.md` (proposed)
- `documentation/work-in-progress.md` (Consumption and cost), `documentation/backlog.md`, `documentation/requirements.md`, `documentation/glossary.md`
- Commits `4724ebc`, `93e7f10`, `97e0457`, `af5662e`
