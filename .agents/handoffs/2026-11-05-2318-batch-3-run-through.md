# Handoff: batch 3 run-through and delivery

Supersedes: `2026-11-05-2219-choose-batch-3.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Deliver batch 3 (CHG-0031: Claude Code's built-in tools behind action approval). Done when the owner settles the sandbox `.git` question, accepts their run-through, the work is committed, and a Delivery record is appended to `documentation/changelog.md`.

## State

- Batch 3 is fully built and uncommitted on `main` (31 changed or new paths; new service modules `approvals.ts`, `mcp.ts`, `patterns.ts`, `permissions.ts`, `questions.ts`, `sandbox.ts`, `instructions.ts`; new app files `questions.tsx`, `permissions.tsx`, `notifications.ts`). Verified with `git status`.
- Verified by command output at 23:17: `OPENMISSION_LIVE_CLAUDE=1 bun run test` passes 44 of 44 (live checks used Haiku); `bun run typecheck` and `bun run check` pass.
- Driven in the Electron window with real Claude Code; what was verified, the five fixes made during the drive (each test-first), and the open items are in `documentation/work-in-progress.md`, section "Drive findings". Verified by reading the file.
- No Delivery record yet in the changelog: by the project's pattern (CHG-0030) it follows the owner's acceptance.
- Drive processes (Electron, Expo, an orphan service from the previous session) were stopped. Verified with `ps`.
- Driving the window from an agent shell: launch Electron with a minimal environment (`env -i` with HOME, PATH, USER, TMPDIR, LANG, a `CLAUDE_CONFIG_DIR` for a working account, `OPENMISSION_DATA_DIR` set to a temp folder) and `--remote-debugging-port`, then attach Playwright CLI over CDP. Otherwise the agent's own `CLAUDE_*` and `GIT_CONFIG_*` variables leak into OpenMission's Claude Code. Metro served a stale module once; `expo start --clear` fixed it.

## Decisions

- All batch 3 choices are recorded in CHG-0031 and `documentation/work-in-progress.md` (Batch 3, Behavior).
- Added this session, not yet in the changelog: the MCP server entry sets `timeout: 2147483647` because Claude Code aborts a silent call after 300 s; a question opens only on a Running or Attention thread; Stop marks the thread Stopped before interrupting and withdrawing; a call whose HTTP connection closes withdraws its question. Reasons are in the code comments and Drive findings.
- Nothing is committed or pushed without the owner asking.

## Next

1. Ask the owner how to handle the sandbox refusing writes under `.git` (each local `git init` or commit asks at the default level). Research Claude Code's sandbox filesystem settings first if they want that option.
2. Ask the owner for the run-through listed in `documentation/work-in-progress.md` (Checks), started with `bun run dev`, including the desktop notification on macOS.
3. On acceptance: commit (the pre-commit hook runs Biome and typecheck), append the Delivery record (next CHG number) with the Drive findings fixes, and mark batch 3 delivered in `documentation/work-in-progress.md`.

## Open questions

- Sandbox `.git` refusal: the owner decides.
- Whether the service should pass a narrower environment to Claude Code: owner, not urgent (a normal launch is unaffected).
- Carried over: `.zcode/` stays untracked until the owner says; packaged desktop build and PATH; the recovery and other questions in `documentation/work-in-progress.md`.

## Sources

- `documentation/work-in-progress.md` (Batch 3: Behavior, Probe evidence, Checks, Drive findings)
- `documentation/changelog.md` (CHG-0031)
- `documentation/capabilities/action-approval/specifications.md`
- `packages/service/src/approvals.ts`, `packages/service/src/mcp.ts`, `packages/service/src/claude.ts`, `packages/service/src/threads.ts`, `packages/service/test/approvals.test.ts`
- `.agents/ai-tooling.md` (Playwright CLI)
