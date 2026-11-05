# Handoff: choose and build the workspace batch

Supersedes: `2026-11-05-2327-batch-3-run-through.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Next batch: workspace attachment, so a mission's threads work in a real folder instead of the scratch folder. The owner's first target is that OpenMission works well enough to build itself: start a mission on the OpenMission repository and have it make, check, and commit a change there. Done when that batch is agreed in the changelog, built with its checks, accepted, and delivered.

## State

- Batches 1 to 3 are delivered (CHG-0026, CHG-0030, CHG-0033). Verified by reading `documentation/changelog.md`. Batch 3's owner run-through was skipped and its desktop notification is unverified (CHG-0033).
- Verified by command output at 23:28: `bun run test` passes 45 with 2 skipped (the live checks; they passed with `OPENMISSION_LIVE_CLAUDE=1` earlier in the session); `bun run typecheck` and `bun run check` pass.
- Threads run in a scratch folder under the data directory (`ScratchRoot` in `packages/service/src/threads.ts`, `join(scratchRoot, missionId)`). Standing permissions are scoped to the mission or everywhere (`packages/service/src/permissions.ts`). Verified by reading the code.
- At the default level, local git in the working folder runs without a question (CHG-0032); push and other risky actions ask. Verified by the checks in `packages/service/test/approvals.test.ts`.
- Committed and pushed with this handoff. Assumed until `git log origin/main` shows it.
- Driving the window from an agent shell: see the previous handoff's State; launch Electron with `env -i` and only the needed variables, or the agent's `CLAUDE_*` and `GIT_CONFIG_*` leak into OpenMission's Claude Code.

## Decisions

- Recorded agreements: CHG-0031 (approval), CHG-0032 (local git), and `documentation/capabilities/workspace-attachment/specifications.md` (agreed behavior). The first-slice design limits the first workspace step to: an existing folder under a browsable root, stable workspace identity, attachment fixed after start, and the folder's instructions; cloning, own copies, relocation, and workspace management are staged (`documentation/first-slice-design.md`, Workspace row).
- When workspaces arrive, standing permissions gain workspace scope (owner, batch 3: "Mission scope for now, but will be extended to workspace folder.").
- Code follows `documentation/conventions.md`; work proceeds in batches recorded in `documentation/work-in-progress.md`; pushes to `main` need the owner's approval.

## Next

1. Propose the workspace batch to the owner, one question at a time with a recommendation, aimed at self-hosting: at minimum, choosing a folder under browsable roots when starting a mission, threads running there with the folder's `AGENTS.md` and `CLAUDE.md`, and standing permissions scoped to the workspace. Settle which harness settings and skills the workspace may load (batch 3 runs Claude Code with `--setting-sources ""` and `--strict-mcp-config`), and how a thread runs the project's checks (`bun run test`, typecheck, Biome) inside the sandbox.
2. Record the agreement (CHG-0034 if nothing intervenes) and the batch in `documentation/work-in-progress.md`.
3. Build it test-first, run the checks, drive it in the window on a copy or worktree of this repository, then ask the owner for a run-through.

## Open questions

- Sandbox fit for self-building: whether `bun install`, Metro, Electron, and the test runner work under Claude Code's sandbox in a real repository, and which network hosts they need. Unverified; probe early.
- Whether the service should pass a narrower environment to Claude Code: owner, not urgent.
- Carried over: `.zcode/` stays untracked until the owner says; packaged desktop build and PATH; recovery and the other open questions in `documentation/work-in-progress.md`.

## Sources

- `documentation/capabilities/workspace-attachment/specifications.md`, `documentation/first-slice-design.md` (Workspace row), `documentation/backlog.md`
- `documentation/work-in-progress.md`, `documentation/changelog.md` (CHG-0031 to CHG-0033)
- `documentation/capabilities/action-approval/specifications.md`, `documentation/capabilities/tool-and-skill-loading/specifications.md`
- `packages/service/src/threads.ts`, `claude.ts`, `approvals.ts`, `permissions.ts`, `instructions.ts`
- Repository: https://github.com/Dyrits/OPEN-MISSION
