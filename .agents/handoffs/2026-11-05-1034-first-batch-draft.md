# Handoff: first batch draft

Supersedes: `2026-11-05-1009-first-slice-boundaries.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Build the first slice iteratively: each batch leaves a runnable application with its checks, and decisions are settled only when a batch needs them. Batch 1 (thin end-to-end with the fake harness) is done when the user accepts their run-through and its Delivery is in the changelog.

## State

- Verified by command output before writing: `bun run test` passes 11 Vitest checks on Electron's Node 24.22.2; `bun run typecheck` passes in all four packages; `bun run check` (Biome) reports nothing.
- Verified in this session (not rerun before writing): the app was driven through the Electron window over the DevTools protocol with a throwaway data folder (start, echo, follow-up, dashboard, relaunch persistence, tokenless refusal), and `bun run dev` started and stopped Metro and Electron together. Details are in `documentation/work-in-progress.md`.
- Assumed: the batch, its documentation, and this handoff are committed on `main` as a first draft and pushed to origin, as the user requested. Check `git log` and the remote.
- In flight: the user's own run-through of `bun run dev`. They said they would try it later; it has not happened.
- Code lives in `packages/contracts`, `packages/service`, `apps/desktop`, and `apps/app`. The fake harness is in `packages/service/src/execution.ts`; there is no Claude Code adapter yet.

## Decisions

- Iterate in batches; do not prototype. Ask the user design questions one at a time, each with a recommendation. Recorded in CHG-0025 and `AGENTS.md`.
- Service runs in Electron's utilityProcess on its bundled Node; SQLite through Effect's Node driver over `node:sqlite`; contracts in Effect Schema (the app may call only Schema decode/encode); one authenticated loopback WebSocket; Vitest with `@effect/vitest`, run on Electron's Node; Biome. Recorded in CHG-0025, `documentation/architecture.md`, and the ADR 0010 amendment.
- Provisional, not agreed: on startup, threads left Running become Idle and interrupted turns are not replayed. `OPENMISSION_DATA_DIR` overrides the data folder for checks. The desktop app loads only the Metro dev server.
- The user authorized this commit and push as a first draft; that is not acceptance of the batch.

## Next

1. Ask the user for the outcome of their `bun run dev` run-through. Fix any review gap as the next batch.
2. On acceptance, append a Delivery for batch 1 to `documentation/changelog.md` and prune the finished batch from `documentation/work-in-progress.md`.
3. Choose batch 2 with the user, one question at a time. Candidates: child threads with messaging between parent and child, Stop and Resume, or the Claude Code adapter after verifying the installed CLI (2.1.302) and its official protocol documentation.
4. Settle the open questions below only when the chosen batch needs them, and record consequential choices as CHG-0026 onward.

## Open questions

- Crash and restart recovery, and uncertain delivery: the user decides; the earlier recommendation was Attention with an explicit Continue choice and no automatic replay.
- What resets the chatter count; Idle as the mission state when no thread is urgent; dependency gates before live turns. All in `documentation/work-in-progress.md`.
- Packaged desktop build and how it loads the exported web app: undecided.

## Sources

- `documentation/work-in-progress.md` (batch 1 behavior, evidence, open questions)
- `documentation/changelog.md`, CHG-0025
- `documentation/architecture.md`, `documentation/architecture-decision-record/0010-effect-in-the-service-and-relay.md`
- `documentation/first-slice-design.md` and the mission-tracking, thread-tree, and thread-messaging blueprints
- `README.md` (Development commands), `AGENTS.md`
- `packages/service/test/` (acceptance checks)
- Repository: https://github.com/Dyrits/OPEN-MISSION
