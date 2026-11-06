# Handoff: batch 4 agreed, autonomous threads, awaiting the owner's run-through

Supersedes: `2026-11-06-0017-workspace-batch-draft.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Batch 4 (workspace attachment, first step) delivered, so OpenMission can build itself: a mission on this repository makes, checks, and commits a change with threads that work autonomously and ask only before sensitive actions. Done when the owner runs it through and the Delivery is recorded in the changelog.

## State

- Batch 4 is agreed (CHG-0034) and reshaped (CHG-0035). Both are recorded in `documentation/changelog.md`, and the batch's behavior, checks, and open items are in `documentation/work-in-progress.md` (Batch 4). Verified by reading both files.
- Built this session, all test-first:
  - A thread about to start a turn in a missing workspace folder goes to Attention with Retry. This uses the `threads.blocker` column (migration `0006_thread_blocker`), the `RetryThread` request, and `MissingFolderNotice` in `apps/app/src/workspaces.tsx`.
  - The sandbox of a workspace thread allows registry and GitHub download hosts, Bun's and Electron's cache folders, loopback binding, and `NODE_USE_ENV_PROXY=1` (`workspaceSandbox` in `claude.ts`).
  - Harness prompts run without a question unless `sensitivityOf` in `patterns.ts` recognizes a sensitive action. Each one that runs leaves an `AllowedAutomatically` line.
  - Questions use plain wording and three buttons (`questions.tsx`). The local-git special case (`isLocalGit`) is removed.
  - The desktop picks folders through the native dialog (`openmission:chooseFolder` in `apps/desktop/src/main.ts` and `preload.ts`).
  - The in-app browser, the browsable roots, and Show hidden are kept for the phone in `packages/service/src/folders.ts` and `apps/app/src/folderBrowser.tsx`. The app does not show them.
- `bun run test` passes 71 with 2 skipped, and `bun run typecheck` and `bun run check` pass. Verified by command output at 07:12. With `OPENMISSION_LIVE_CLAUDE=1`, 65 of 65 passed before the browsing code was restored, and the live checks were not rerun after. The desktop shell builds (`bun run build` in `apps/desktop`).
- Not driven in the Electron window: the native dialog, the new question card, the Retry notice, and the auto-run lines. Assumed to work from typecheck and the service checks only.
- Sandbox probe, 2026-11-06, Claude Code 2.1.302, on a fresh clone. With the CHG-0034 settings, `bun install` and `bun run test` (61 passed) ran inside the sandbox. Details are in work-in-progress. Verified in this session.
- Committed and pushed with this handoff. Assumed until `git log origin/main` shows it.

## Decisions

- Threads are autonomous at the default level, now named "Sensitive actions only". Only sensitive actions ask, judged by a built-in list plus the thread's own `request_approval`. Questions are written for casual users. Recorded in CHG-0035 and `documentation/capabilities/action-approval/specifications.md`. The owner's reason: users are either casual and need natural-language explanations, or advanced and want to be asked only for really sensitive operations, and an assistant that asks all the time cannot do anything by itself.
- The desktop uses the system folder dialog, and any existing folder may be chosen. The folder browser and roots are kept, not deleted, for remote and phone use (owner: "keep that aside and not totally delete it"). Recorded in CHG-0035 and the workspace-attachment specification.
- Retry is built now, while Relocate and Clone again stay staged. Workspace threads get the download hosts. Recorded in CHG-0034.
- Carried over: code follows `documentation/conventions.md`, work proceeds in batches, and pushes to `main` need the owner's approval. The owner gave it for this push ("commit and push").

## Next

1. Ask the owner for the run-through in work-in-progress (Batch 4, Checks):
   - choose this repository with Finder;
   - see reads and listings run with no question, and a push ask in plain words;
   - see the thread follow `AGENTS.md`, run `bun run test`, and commit;
   - rename the folder, see Retry, rename it back, and retry.
2. Fix what the run-through finds, test-first. Rerun `OPENMISSION_LIVE_CLAUDE=1 bun run test`.
3. On acceptance, append the Delivery record (next CHG number) and mark batch 4 delivered in work-in-progress.

## Open questions

- In a fresh clone, `bun install` ends with an error in the sandbox. The `prepare` script writes `.git/config`, which the sandbox protects. Owner decision.
- Whether a workspace should load its own Claude Code settings and skills (`--setting-sources project`). Owner decision.
- A missing-folder wait raises no desktop notification.
- The sensitive list is best effort. Its coverage may need tuning from real use.
- Carried over: `.zcode/` left untracked, a narrower environment for Claude Code, the packaged desktop build, and the questions in `documentation/work-in-progress.md`.

## Sources

- `documentation/changelog.md` (CHG-0034, CHG-0035)
- `documentation/work-in-progress.md` (Batch 4)
- `documentation/capabilities/action-approval/specifications.md`, `documentation/capabilities/workspace-attachment/specifications.md`
- `packages/service/src/patterns.ts`, `approvals.ts`, `instructions.ts`, `threads.ts`, `claude.ts`, `folders.ts`, `workspaces.ts`; `packages/service/test/approvals.test.ts`, `workspaces.test.ts`, `claude.test.ts`
- `apps/app/src/questions.tsx`, `workspaces.tsx`, `folderBrowser.tsx`; `apps/desktop/src/main.ts`, `preload.ts`
- Repository: https://github.com/Dyrits/OPEN-MISSION
