# Handoff: architecture audit 2026-11-12, Containment done, four candidates open

Supersedes: `2026-11-11-2343-architecture-deepening.md`
Workspace: Iskios repository, branch `main`, starting commit `fbf830b`; the work below is committed with this handoff (check `git log` and `git status` for whether the push went through).

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Implement the relevant candidates of the [2026-11-12 architecture audit](../../documentation/architecture-audit/architecture-audit-2026-11-12-2245.html) without changing agreed behaviour beyond the bugs the audit names. Done when candidates 1 to 5 are built and checked, or the owner declines the rest.

## State

- Candidate 1 (Containment), built in part and recorded as CHG-0216 in the changelog.
  - `packages/service/src/policy/containment.ts` holds `needsOf` and `isUnaskedAt`; `work/approvals.ts` gathers facts and calls them; adapters report facts through `HarnessAdapter.containmentOf(harness, level)` (`core/execution.ts`).
  - Fixed: Claude Code reports unprotected at "Also commands and edits" (`isSandboxedOf` now takes the level); Codex marks requests as leaving the sandbox only at the default level (audit P5); OpenCode runs the linked-folder check with no sandbox tool, so an edit there asks (audit P6).
  - Verified now, this session: `bun run typecheck` 6 of 6, `npx biome check .` clean, full suite `ELECTRON_RUN_AS_NODE=1 npx electron node_modules/vitest/vitest.mjs run` 1324 passed and 14 skipped on two consecutive runs. A first run had one failure in an `InterruptThread` test ("This thread is not running", `service.ts` near line 350) that did not recur; not investigated. The three new behaviour tests (`claude.test.ts`, `harnesses.test.ts`) were shown to fail with the three adapter files stashed, then pass.
  - A fresh worktree has no `node_modules`; `bun install --frozen-lockfile` was run first.
- Not done from candidate 1: OpenCode's launch order stays inline in `opencode.start` (that is candidate 3); OpenCode keeps its own `isUnaskedEdit` pre-allow because `harness/` imports nothing from `policy/`; audit P4 not tried (reading the code, `takeAllowance` already matches on the escape flag).
- Candidates 2 (one definition per structural action in `guildmasterProvenance.ts`), 3 (sandboxed OpenCode launch module), 4 (Host access module in `remote/`), 5 (message admission module out of `service.ts`): not started.
- The earlier audit (2026-11-11, candidates A to D) is already delivered (CHG-0187) and on `origin/main`; its owner decisions are still open (see Open questions).
- Assumed, not checked: that a real Codex or Claude Code at the stricter level asks with the new wording; the question card in the app.

## Decisions

- Containment lives in `policy/` because it needs the capability names in `policy/patterns.ts`, and `harness/` does not import `policy/`. Adapters report facts; one function decides.
- A standing permission saved for an ordinary command at the default level no longer covers it at "Also commands and edits" for Claude Code: that level is now unsandboxed, so the command needs "Run without a sandbox", as for any unprotected harness. Recorded in CHG-0216; the owner has not been asked.
- At Codex's stricter level, a thread's `request_approval` with `outsideSandbox: true` no longer matches Codex's ordinary ask, so it asks again (safe direction).
- The 11-12 audit file was untracked in the main checkout; a copy is committed in `documentation/architecture-audit/`.

## Next

1. Ask the owner whether to continue with candidate 2 (the audit's fallback, also fixes `rename_realm` asking for an Allow on an action the tool then refuses), then 3, 4, 5.
2. Candidate 3 builds on candidate 1: the launch should report its facts to Containment.
3. Look into the one-off `InterruptThread` failure if it recurs.
4. Remaining items of the sandbox review follow-up that this work did not touch (P1 rest, P2, P3, P7, P10, P11, P8 and P9 owner decisions) are in `2026-11-12-1405-sandbox-review-follow-up.md`; P5 and P6 there are now fixed.

## Open questions

- Owner: which of candidates 2 to 5 to build, and whether the permission-coverage change at the stricter level is acceptable.
- Owner, still open from the 2026-11-11 audit: P1 (category lists capped at 12), P2 (mixed list files 8 to 5), P4 of that review (deleted sender note), P5 of that review (reply rule), P6 (title from a raw `@quest:` token), P7 (closed-chip wording), S3 (failed mention read ignored). The composer and the Dock icon were never driven in a window.
- The audit's note: confirm the release name (`434e4fb` renamed 0.1.0-Alpha to 0.1.0-Prototype).

## Sources

- [architecture audit 2026-11-12](../../documentation/architecture-audit/architecture-audit-2026-11-12-2245.html), [audit 2026-11-11](../../documentation/architecture-audit/architecture-audit-2026-11-11-2256.html)
- [changelog](../../documentation/changelog.md), CHG-0208, CHG-0187, CHG-0216
- `packages/service/src/policy/containment.ts`, `packages/service/src/work/approvals.ts`, `packages/service/src/core/execution.ts`, `packages/service/src/harness/{claude,claudeArgs,codex,opencode}.ts`
- `packages/service/test/policy/containment.test.ts`, `packages/service/test/harness/{claude,harnesses}.test.ts`
- [sandbox review follow-up handoff](2026-11-12-1405-sandbox-review-follow-up.md), [superseded handoff](2026-11-11-2343-architecture-deepening.md)
