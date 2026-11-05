# Handoff: Claude Code chat batch

Supersedes: `2026-11-05-1034-first-batch-draft.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Build the first slice iteratively, one runnable and verified batch at a time. Batch 2 (Claude Code chat without tools) is done when the user accepts their run-through and its Delivery is in the changelog.

## State

- Batch 1 is delivered (CHG-0026, accepted by the user). Batch 2 is agreed (CHG-0027) and implemented; its behavior, checks, and evidence are in `documentation/work-in-progress.md`.
- Verified by command output before writing: `bun run test` passes 19 checks with 1 skipped (the opt-in live check); `bun run typecheck` passes in all four packages; `bun run check` (Biome) reports nothing.
- Verified in this session (not rerun before writing): `OPENMISSION_LIVE_CLAUDE=1 bun run test` passed against Claude Code 2.1.302 with Haiku, and the Electron window was driven with real Claude Code (streaming, follow-up context, streaming off, token totals, process cleanup on quit, session resume after relaunch, no `OPENMISSION_` variables in the child environment).
- In flight: the user's own run-through of batch 2 with `bun run dev`. It has not happened.
- Assumed: batch 2, the project skills, and this handoff are committed on `main` as a draft and pushed, as the user requested. Check `git log` and the remote. `.zcode/` is deliberately left untracked; the user has not said whether to track it.
- Project skills installed in `.agents/skills/` (locked in `skills-lock.json`, linked from `.claude/skills/` and `.zcode/skills/`): effect-ts, frontend-design (installed by the user); expo-overview, expo-router, expo-design-system, expo-data-fetching, expo-dom, expo-upgrade; cloudflare, workers-best-practices, durable-objects, wrangler, cf-cli; mcp-builder; react-native-best-practices. Only mcp-builder contains scripts (an optional evaluation harness that calls the Anthropic API).

## Decisions

- Iterate in batches; ask design questions one at a time with a recommendation (CHG-0025, `AGENTS.md`).
- Batch 2 choices are recorded in CHG-0027: chat-only Claude Code (no tools, prompts denied, no MCP, skills, or user settings), one long-lived process per thread closed after 10 idle minutes and resumed by session, model and effort picked at start from saved defaults, token usage never shown in dollars, word-by-word streaming as a setting that defaults on.
- Provisional, not agreed: a failed turn's messages become undelivered and are retried with the next message; on startup, threads left Running become Idle without replay; the desktop app loads only the Metro dev server.
- impeccable.style was assessed and not installed: its tooling targets HTML web frameworks, its full install adds hooks, a downloaded binary, and default telemetry, and it overlaps frontend-design. A skill-only install with telemetry off is an option for a later design pass.
- The user authorized this commit and push as a draft; that is not acceptance of batch 2.

## Next

1. Ask the user for the outcome of their batch 2 run-through. Fix any review gap as the next batch.
2. On acceptance, append a Delivery for batch 2 to `documentation/changelog.md` (CHG-0028 if nothing intervenes) and prune the finished batch from `documentation/work-in-progress.md`.
3. Choose batch 3 with the user, one question at a time. The agreed direction is the per-action approval prompt (thread in Attention, Approve and Deny), which lets Claude Code use tools; `--permission-prompts host` with `--permission-prompt-tool` is the verified CLI path, and the MCP thread tools (ADR 0005) are the likely carrier.
4. Settle the remaining open questions only when a batch needs them.

## Open questions

- Recovery after a crash or restart, uncertain delivery, chatter-guard resets, Idle as the fallback mission state, and the remaining dependency gates: listed in `documentation/work-in-progress.md`.
- Packaged desktop build: how it loads the exported web app and finds `claude` when launched outside a terminal (PATH). Undecided.
- Whether `.zcode/` should be tracked: the user decides.

## Sources

- `documentation/work-in-progress.md` (batch 2 behavior, evidence, open questions)
- `documentation/changelog.md`, CHG-0025 to CHG-0027
- `documentation/architecture.md`, `documentation/first-slice-design.md`, `documentation/architecture-decision-record/0005-thread-tools-over-mcp.md`
- `documentation/capabilities/action-approval/specifications.md` (for batch 3)
- `packages/service/src/claude.ts`, `packages/service/test/claude.test.ts`, `packages/service/test/fixtures/stand-in-claude.mjs`
- `README.md` (Development commands), `AGENTS.md`, `skills-lock.json`
- Repository: https://github.com/Dyrits/OPEN-MISSION
