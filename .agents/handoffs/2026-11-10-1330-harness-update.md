# Handoff: update a harness from the Charter

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked that the Charter's Harnesses card offer an update when a harness has a newer version ("like OpenBot does"). Done means the owner has seen Update appear for an outdated harness in the running app and a real update worked.

## State

- Built (CHG-0110): `HarnessInfo.update` (newer version or null) and the `UpdateHarness` request in `packages/contracts`; `HarnessTools.findUpdate` and `update` in `packages/service/src/harnessTools.ts` (newest version from `https://registry.npmjs.org/<package>/latest`, cached 30 minutes, any failure reads as no update; update runs the harness's own command with a 5-minute limit); `updateHarness` in `accounts.ts`; the handler in `service.ts` runs outside the command queue; version parsing and comparison in `packages/service/src/harnessVersions.ts`; the card in `apps/app/src/accounts.tsx` (`HarnessesCard`, `HarnessState`) shows "Ready · <version> is available" and an Update button. Verified by reading the diff.
- Verified: `bun run typecheck` and `bun run check` pass; new tests in `harnessVersions.test.ts` and `harnesses.test.ts` ("offers an update only to a harness with a newer version, and updates it") pass with the other service harness and app tests (150 passed, 1 failed).
- Verified: the registry answers for the scoped package URL (`@anthropic-ai/claude-code`); on this computer Claude Code 2.1.311 would be offered 2.1.322 and Codex 0.160.1 would be offered 0.167.0; OpenCode v2.2.0 is above the registry's 1.19.5 and is offered nothing.
- Not run: any real update (`claude update`, `codex update`, `opencode upgrade`); the card was not driven in the window.
- Known failure outside this change: `packages/service/test/harnesses.test.ts` › "runs a thread with an added account's own folder" (CODEX_HOME), already noted in CHG-0109.
- Commit and push: committed on `main` from the worktree `/private/tmp/gild-main-wt` together with CHG-0109 (`f3497fe`, the one-side-panel merge), and pushed. Assumed here; check with `git log origin/main`.
- Left alone: the checkout at `/Users/dgerrits/Codelab/Dyrits/CANOPY` on branch `one-side-panel` holds another session's uncommitted work (backups, Done) in files this change also touched (`requests.ts`, `service.ts`); it also still shows this change's edits as uncommitted until that branch is brought up to `main`.

## Decisions

- The update runs the harness's own command rather than a package manager, because each harness knows how it was installed (native installer, Homebrew, npm).
- The newest version comes from the npm registry for all three harnesses; no harness has a check-only command. A lower or unreadable newest version offers nothing.
- `UpdateHarness` is not a `commands.run` command, so a slow update does not block the command queue.

## Next

1. Ask the owner to look at the Harnesses card in the running app; if no harness is outdated, check it with a fake offer or an older install.
2. Run one real update (for example `opencode upgrade` or `codex update`) and confirm the card refreshes to the new version.
3. Decide with the owner whether "like OpenBot does" meant more than an inline Update button (OpenBot's own interface was not inspected).
4. Bring `one-side-panel` up to `main` in the CANOPY checkout, keeping the other session's uncommitted work.

## Open questions

- Does the owner want running threads restarted after an update? Today they keep the old version until they restart.
- What does "like OpenBot does" ask for beyond what is built? The owner answers.

## Sources

- `documentation/capabilities/provider-accounts/specifications.md` (Harnesses), `documentation/changelog.md` (CHG-0110)
- `packages/service/src/{harnessTools,harnessVersions,harnessCatalog,accounts,service}.ts`, `packages/contracts/src/{harnesses,requests}.ts`, `apps/app/src/accounts.tsx`
- `packages/service/test/{harnessVersions,harnesses}.test.ts`
