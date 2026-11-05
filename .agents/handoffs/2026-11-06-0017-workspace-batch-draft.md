# Handoff: workspace batch built as a draft, awaiting the owner

Supersedes: `2026-11-05-2328-workspace-batch.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Workspace attachment, first step, so OpenMission can build itself: a mission starts on a folder such as this repository and its thread makes, checks, and commits a change there. Done when the owner agrees the batch (changelog Agreement), runs it through, and the Delivery is recorded.

## State

- Batch 4 is built and committed as a draft, without the owner's agreement. The owner asked for autonomous work while away. Scope, choices, checks, and open items are in `documentation/work-in-progress.md` (Batch 4). Verified by reading the file.
- Service: `packages/service/src/workspaces.ts` (roots, browsing, New folder, workspace identity, working folder and starting context), migration `0005_workspaces` in `store.ts`, and workspace-scoped standing permissions in `permissions.ts`. App: `apps/app/src/workspaces.tsx` (picker, roots in Settings). Contracts: `StartMission.workspacePath`, `BrowseFolders`, `CreateFolder`, `AddBrowsableRoot`.
- `bun run test` passes 61 with 2 skipped (live checks not rerun), and `bun run typecheck` and `bun run check` pass. Verified by command output at 00:15. Each workspace check fails under mutation: `documentation/verification/2026-11-06-workspace-batch.md` and its `mutations.sh`. A fresh-context agent reproduced the proof and every result matched. Verified from its report.
- Review-and-refactor ran on two axes. Its refactors are applied and verified by the same reviewers. Its open findings are listed in work-in-progress (Batch 4, Checks).
- Driving the window needs care. With `HOME` set to a temporary folder, Claude Code cannot reach its keychain login ("Not logged in"). Keep the real `HOME` in `env -i` and add a root for a temp folder, or seed it in that data directory. Verified in this session.
- Committed and pushed with this handoff. Assumed until `git log origin/main` shows it.

## Decisions

- Choices made without the owner, all listed in work-in-progress (Batch 4, Behavior and Open):
  - hidden folders are not listed;
  - instruction files are cut at 50,000 characters, and `@` imports are not followed;
  - a missing folder fails the turn;
  - no root removal;
  - Claude Code still runs with `--setting-sources ""`.
- No changelog record yet. The changelog holds only Agreements and Deliveries, so batch 4 gets CHG-0034 when the owner agrees it.
- The rest carries over from the superseded handoff: code follows `documentation/conventions.md`, work proceeds in batches, and pushes to `main` need the owner's approval. The owner gave it for this push ("commit and push").

## Next

1. Present batch 4 to the owner, one question at a time with a recommendation:
   - agree the scope or change it;
   - keep hidden folders out, or not;
   - build Retry for a missing folder now, or with Relocate;
   - sandbox fit: allow the package-registry and Electron download hosts, or keep asking.
2. Record the agreement (CHG-0034), apply any changes test-first, and ask for the run-through in work-in-progress (Batch 4, Checks).
3. On acceptance, append the Delivery and mark batch 4 delivered.

## Open questions

- Sandbox fit, observed and still to be decided by the owner. `bun install` needs to run outside the sandbox (tempdir EPERM). `bun run test` needs the Electron binary, whose download the sandbox refuses. `check` and `typecheck` run sandboxed.
- Whether workspaces should load their own Claude Code settings and skills (`--setting-sources project`). Owner decision.
- Carried over: whether to pass Claude Code a narrower environment, `.zcode/` left untracked, the packaged desktop build, and the questions in `documentation/work-in-progress.md`.

## Sources

- `documentation/work-in-progress.md` (Batch 4)
- `documentation/verification/2026-11-06-workspace-batch.md`
- `documentation/capabilities/workspace-attachment/specifications.md`, `documentation/first-slice-design.md` (Workspace row)
- `packages/service/src/workspaces.ts`, `permissions.ts`, `threads.ts`, `store.ts`; `packages/service/test/workspaces.test.ts`; `apps/app/src/workspaces.tsx`
- Repository: https://github.com/Dyrits/OPEN-MISSION
