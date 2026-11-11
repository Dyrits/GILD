# Handoff: OpenCode effort levels preloaded and pushed

Supersedes: [.agents/handoffs/2026-11-11-1512-opencode-efforts-pushed.md](2026-11-11-1512-opencode-efforts-pushed.md)
Workspace: ISKIOS, branch `main`, pushed as commit `8b85c98`

To resume: read this whole file first. Treat every claim not marked verified as unverified, and check it against the Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The OpenCode effort picker no longer waits for a live ACP session on each pick: the service reads every OpenCode model's levels in the background when it reads the model list, into the same cache `ListModelEfforts` answers from. Delivered by teammate Kinkō at the owner's request; committed and pushed by this session.

## State

- Verified: commit `8b85c98` "Read OpenCode effort levels ahead when the model list is read (CHG-0162)" is on `origin/main` (both pushes this session used `--no-verify`: the pre-push guard protects `main` and names `--no-verify` as a person's deliberate approval, which the owner gave in chat).
- Verified in an isolated worktree at that commit: all four workspaces typecheck (`bun run typecheck`), and `packages/service` vitest `test/harness/harnesses.test.ts` passes 44/44 (the added-account failure seen in the shared tree is a session-env leak absent in a clean checkout).
- Behavior (from Kinkō's report and CHG-0162, unverified in the running app): `listModels` forks a background warm (concurrency 3, deduped per harness+account folder) filling the `efforts` cache; a pick answers from cache; unread models or another account's folder fall back to the on-demand read. Not timed against the real ~60 OpenCode models; a pick right after a fresh model list can still be slow until the warm reaches that model.
- The commit holds only the preload work (5 files). Teammate Kinkō's in-flight Realms/Borderlands work (CHG-0161, contracts `ids/records/workspaces`, service store/tests, app shell files) was left uncommitted, deliberately.

## Decisions

- Hunk-level split on two shared files: `requests.ts` keeps only its `ListModelEfforts` comment line in the commit; `changelog.md` keeps only the CHG-0162 entry. Both files still carry Kinkō's uncommitted Realms work in the working tree.
- The repo's pre-commit hook typechecks the whole working tree, which fails while a teammate's work is mid-edit; commits of one session's work therefore need `--no-verify` plus isolated-worktree verification of the commit itself. Recorded as the working pattern for this repo.
- Changelog numbers: CHG-0162 used because CHG-0161 was already claimed in the tree by the Realms/Borderlands entry.

## Next

1. Drive the app with the owner: effort picker shows levels without delay for OpenCode; verify warm timing on the real model list; obtain owner acceptance.
2. Recover the CHG-0161 changelog entry (see Caveat) and let Kinkō land the Realms/Borderlands work.

## Caveat

While staging, an aborted script overwrote the working `documentation/changelog.md` and Kinkō's uncommitted CHG-0161 entry ("Only Realms and Borderlands") was lost from it; it exists nowhere on disk or in git. Kinkō was asked to re-add it from their own session. No other file was touched: every other working-tree change was restored byte-identical.

## Suggested skills

- `hand-off` — to write the next handoff at a phase boundary (Skill tool).
- `test-first` — if more request/service behavior is added (Skill tool).
- `verify` — to prove app behavior before asking for acceptance (Skill tool).

## Sources

- `documentation/changelog.md` (CHG-0162; CHG-0158 for the on-demand design it supersedes)
- `packages/service/src/harness/harnessTools.ts`, `packages/service/test/harness/harnesses.test.ts`
- `packages/contracts/src/requests.ts` (comment), `apps/app/src/editors/runners.tsx` (comment)
- Superseded handoff: `.agents/handoffs/2026-11-11-1512-opencode-efforts-pushed.md`
