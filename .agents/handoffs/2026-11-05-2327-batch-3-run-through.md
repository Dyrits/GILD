# Handoff: batch 3 run-through and delivery

Supersedes: `2026-11-05-2318-batch-3-run-through.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Deliver batch 3 (CHG-0031 tools behind action approval, plus CHG-0032 local git without a question). Done when the owner accepts their run-through, the work is committed, and a Delivery record is appended to `documentation/changelog.md`.

## State

- Batch 3 is built and uncommitted on `main` (33 changed or new paths). Verified with `git status`.
- CHG-0032 is agreed and built: at the default level with a sandbox, OpenMission answers Claude Code's prompts for local git itself (`isLocalGit` in `packages/service/src/patterns.ts`, used in `approvals.ts`; thread instructions in `instructions.ts`). Verified: unit and integration checks in `packages/service/test/approvals.test.ts`; in the Electron window a Haiku thread created a repository, committed, and branched with no question.
- Verified by command output at 23:25: `bun run test` passes 45 with 2 skipped (the live run just before passed all, live included); `bun run typecheck` and `bun run check` pass.
- Drive results, fixes, and remaining open items: `documentation/work-in-progress.md`, section "Drive findings". Verified by reading the file.
- No Delivery record yet; by the project's pattern (CHG-0030) it follows the owner's acceptance.
- Drive processes were stopped after the last drive. Assumed (the stop commands ran; not rechecked with `ps`).
- Driving the window from an agent shell: launch Electron with `env -i` (HOME, PATH, USER, TMPDIR, LANG, a `CLAUDE_CONFIG_DIR` for a working account, `OPENMISSION_DATA_DIR` set to a temp folder) and `--remote-debugging-port`, then attach Playwright CLI over CDP; otherwise the agent's own `CLAUDE_*` and `GIT_CONFIG_*` variables leak into OpenMission's Claude Code. If Metro serves a stale module, restart it with `expo start --clear`.

## Decisions

- Batch 3 scope: CHG-0031 and `documentation/work-in-progress.md` (Batch 3, Behavior).
- Local git: CHG-0032. The owner chose this over a Claude Code auto mode level, loosening the risky list, or no change. The general rule (`documentation/requirements.md`, Approval per action) is unchanged.
- Added during the drive, recorded in Drive findings, to go into the Delivery record: the MCP server entry sets `timeout` (Claude Code aborts silent calls after 300 s); questions open only on a thread at work; Stop marks Stopped before withdrawing; an abandoned call withdraws its question.
- Nothing is committed or pushed without the owner asking.

## Next

1. Ask the owner for the run-through in `documentation/work-in-progress.md` (Checks), started with `bun run dev`, including the desktop notification on macOS. Local commits should no longer ask.
2. On acceptance: commit (the pre-commit hook runs Biome and typecheck), append the Delivery record (CHG-0033 if nothing intervenes) covering CHG-0031, CHG-0032, and the drive fixes, and mark batch 3 delivered in `documentation/work-in-progress.md`.

## Open questions

- Whether the service should pass a narrower environment to Claude Code: owner, not urgent.
- Carried over: `.zcode/` stays untracked until the owner says; packaged desktop build and PATH; recovery and the other questions in `documentation/work-in-progress.md`.

## Sources

- `documentation/work-in-progress.md` (Batch 3: Behavior, Probe evidence, Checks, Drive findings)
- `documentation/changelog.md` (CHG-0031, CHG-0032)
- `documentation/capabilities/action-approval/specifications.md` (Asking), `documentation/requirements.md` (Approval per action)
- `packages/service/src/approvals.ts`, `patterns.ts`, `instructions.ts`, `mcp.ts`, `claude.ts`, `threads.ts`; `packages/service/test/approvals.test.ts`
- Claude Code sandbox settings: https://code.claude.com/docs/en/settings-reference
