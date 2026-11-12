# Handoff: Release readiness for 0.1.0-Alpha, and Iskios's app guide

Supersedes: none
Workspace: ISKIOS repository, branch `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Get the repository to a state where a first alpha (`0.1.0-Alpha`) can be tagged and published through the existing tag workflow, and give Iskios (the Guild Hall assistant) a source to explain how the app works.
Done for the release means: a green hosted check on `main`, manual installer builds smoke-tested on real systems, and a version tag the owner approves. The app guide is done when the owner has reviewed its text and a real model has been seen using it.

## State

- Verified by reading the repository and `gh run list` at the start of the session: before this work, the hosted `check` job failed on the last pushes to `main`, no tag, release, or manual package run existed, and there was no `LICENSE`.
- Verified by reading logs of failed runs `43224198050`, `43223551915`, and `43194372071`, and by reading the tests: two tests failed only on the hosted runner. `packages/service/test/prices.test.ts` ("stamps an estimated cost on each turn from the price table") raced the price table's background read at startup, so a turn that started first was priced from the snapshot alone; `packages/service/test/lore/loreOverTime.test.ts` ("never fades a rule or a pinned lore entry") timed out at 20 s advancing 1000 test days. Both passed locally. Fixed in commit `4dcf4d8` (CHG-0210): `startOn` waits for the fetched table unless told the source cannot be read, and the lore test advances 400 days with a 60 s limit. No production code changed.
- Verified by `gh run view 43293644636`: the hosted run for `4dcf4d8` succeeded (its `check` job passed; the package and release jobs were skipped because it was neither a tag nor a manual run). A later run, `43302806998`, for `6572977` was still in progress when this was written and is not checked.
- Verified by `git log` and `git fetch`: `4dcf4d8` is on `origin/main`. `LICENSE` (Apache License 2.0) was added in it, and the README's License section was updated. `main` was pushed with `git push --no-verify` because the repository's pre-push guard refuses pushes to `main`; the owner approved that for that push only.
- Built in this session (CHG-0211): an app guide Iskios reads on demand. `packages/service/src/work/appGuideTopics.ts` holds 14 topics; `packages/service/src/work/guildmasterGuide.ts` implements the thread tool `read_app_guide` (no topic lists the topics; a topic id or a few words of the question returns the best one or two topics, or says the guide does not cover it; only Iskios may call it); the tool is defined in `threadTools.ts`, wired in `threadToolHandlers.ts`, and `instructions.ts` tells Iskios to answer only from it and to say it does not know otherwise. Iskios's settings messages, the README's install steps and vocabulary row now say the Workshop instead of the Charter, and the README's claim that MCP servers can be configured in Iskios was replaced by what exists. The specification's tool table and the "explains how the app works" line were updated.
- Verified now by running them: `bun run typecheck` passes in all workspaces; `packages/service/test/work/appGuide.test.ts`, `guildmaster.test.ts`, and `threadTools.test.ts` pass (93 of 93, run with the Electron-as-Node vitest form); Biome is clean on `packages/service/src/work`, `packages/service/test/work`, `packages/service/src/harness`, and `README.md`. A full service run earlier in the session passed (779 tests) before a final typing fix to `guildmasterGuide.ts`; the whole suite was not rerun after it.
- The app guide's files were committed together with this handoff; confirm with `git log` that this file's commit holds them, and that it was pushed.
- Assumed, not seen: a real model choosing to call `read_app_guide` and answering from it; how well the topic matching handles questions phrased unusually; the guide's text was written from the README, glossary, specifications, and the app's screens and has not been reviewed by the owner. The guide says no MCP server management exists in Iskios, which was concluded from there being no contract, request, or screen for it, not from asking the owner.
- Observed during this session, not changed: `git branch` and `git worktree list` show unmerged branches `worktree/gild-theme` and `worktree/message-comments` (the latter's worktree is `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS-message-comments`).

## Decisions

- The guide is TypeScript data inside the service, not repository markdown: the packaged service cannot read files from the repository, and one module is bundled with the rest. It is read per topic like `read_journal`, so it adds nothing to a turn until asked. Recorded in CHG-0211 and the mission-coordination specification.
- Iskios's answers rest on the guide alone: it says it does not know when the guide has no topic, rather than guessing.
- The settings screen is named the Workshop everywhere user-facing, as the sidebar does (`apps/app/src/shell/sidebar.tsx`); the sidebar's Charter row is a placeholder page.
- The lore test keeps its meaning (rule and pinned entries never fade, a plain fact is archived) with 400 days, more than twice the 195 days a plain fact needs.
- The owner approved the first push of `4dcf4d8` to `main` with the guard bypassed. That approval does not extend to later pushes: ask again.

## Next

1. Check the hosted run for the commit containing this handoff (`gh run list`), and for `6572977`. Fix anything red before building installers.
2. Run the "Check and release desktop app" workflow manually (workflow dispatch) to build the four installers without publishing, and download them from the run's Artifacts.
3. Smoke-test the installers on real systems: macOS (arm64 or x64), Windows, Linux. The README says Windows and Linux builds have not been smoke-tested; macOS DMG launch is checked in CI.
4. With the owner's approval, push a version tag (the README suggests `v0.1.0-alpha.1`; a hyphen makes it a prerelease), then inspect the release job and the published assets.
5. Have the owner review the app guide's text, and drive Iskios on a real harness with a few questions about the app to see `read_app_guide` used.

## Open questions

- Which version tag does the owner want first? The packages say `0.1.0-Alpha`; the tag flow derives the packaged version from the tag.
- The glossary still lists Charter as the interface name of Settings while the sidebar shows the Workshop for the settings screen: the owner decides which names stand (an earlier handoff, `2026-11-11-2346-iskios-guild-hall-hub.md`, lists the glossary fix as separate work).
- Do the unmerged `worktree/gild-theme` and `worktree/message-comments` branches belong in the first alpha? The owner decides.
- Signing: macOS builds are ad hoc signed and Windows builds unsigned, documented in the README; whether to sign before the first release is the owner's call.

## Sources

- `documentation/changelog.md`, CHG-0210 and CHG-0211.
- Commit `4dcf4d8`; `.github/workflows/package.yml`; README sections "Install and start" and "Build and release".
- `packages/service/src/work/appGuideTopics.ts`, `guildmasterGuide.ts`, `threadTools.ts`, `threadToolHandlers.ts`; `packages/service/src/harness/instructions.ts`; tests `packages/service/test/work/appGuide.test.ts` and `guildmaster.test.ts` ("Iskios's app guide").
- `documentation/capabilities/mission-coordination/specifications.md`, the tool table and "Iskios explains how the app works".
- Failed hosted runs `43224198050`, `43223551915`, `43194372071`; green run `43293644636`.
- `.agents/handoffs/2026-11-10-2209-tagged-releases.md` for how the tag workflow was built and verified offline.
