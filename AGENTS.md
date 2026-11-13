# Iskios

## Start here

Read [README.md](README.md) for the product overview, setup, commands, and repository layout.
When resuming work, read [work in progress](documentation/work-in-progress.md) first, then the relevant [handoff](#handoffs).
Work proceeds in batches with the iterate skill.

## Documents

Read the documents that apply to the task before making changes:

- Product or design work: [outline](documentation/outline.md) for purpose, actors, and capabilities.
- Design or technical choices: [requirements](documentation/requirements.md) for system-wide obligations.
- Naming: [glossary](documentation/glossary.md) for domain terms and their interface names; use its terms.
- Technical or structural changes: [architecture](documentation/architecture.md) for boundaries, flows, and how requirements are met.
- Reversing an architectural decision: read its [decision record](documentation/architecture-decision-record/); add a record for each new hard-to-reverse choice.
- Capability changes: read `documentation/capabilities/<capability>/specifications.md` for agreed behavior and acceptance.
- First-slice implementation or review: read [first-slice design](documentation/first-slice-design.md) and the relevant `documentation/capabilities/<capability>/blueprint.md`; settle the listed review decisions before production code.
- Choosing the next work: [backlog](documentation/backlog.md) for candidates and deferrals.
- Designing a capability covered by an inspiration: [inspirations](documentation/inspirations.md) for ideas adopted and follow-up checks; date new findings.
- Recording agreements or verified deliveries: append each to the [changelog](documentation/changelog.md).
- Re-verifying a batch or relying on its claims: read its [verification evidence](documentation/verification/) and distinguish recorded results from checks run now.
- Proposing structural refactors: read previous [architecture audits](documentation/architecture-audit/).
- Writing or reviewing code: read [conventions](documentation/conventions.md).
- Changing `apps/app`: read [apps/app/AGENTS.md](apps/app/AGENTS.md) for Expo-specific rules.
- Writing Effect code: read `packages/service/node_modules/effect/AGENTS.md` completely for the installed version; search Effect's `src/` for APIs it does not cover.

## Tooling and Git

Read [.agents/ai-tooling.md](.agents/ai-tooling.md) before reinstalling or measuring AI tools, or recovering a session.
Use the root `package.json` for current commands and the README for setup.

The [pre-commit hook](.githooks/pre-commit) runs Biome on staged files and runs the workspace typecheck when code or configuration is staged.
Fix reported issues and stage the corrected files again.

The [Git guard](.agents/hooks/guard-git.py) asks before, or blocks, pushes to `main` and commands that lose local work.
The [pre-push hook](.githooks/pre-push) refuses protected-branch pushes and remote-ref deletion.
A person can approve a push to `main` with `git push --no-verify`; an agent must obtain the user's approval before bypassing the hook.

## Handoffs

Find session-specific context in [.agents/handoffs/](.agents/handoffs/), ordered by the timestamp in each filename.
Read the newest handoff for the task being resumed and check its claims against its sources and the current working tree.
Handoffs are shared and committed; preserve existing files and write a new handoff for later state.
When adding a handoff, keep only the three newest current handoffs linked below; older and superseded handoffs remain available in the folder.

Latest handoffs:

- To resume the reliability work on the hosted check (CHG-0256: the interrupt during harness startup, racy tests, the pre-commit hook; committed, to push to `main` with `--no-verify`; the hosted run has not been seen; the audit of the other fixed waits in tests is open), read the [current handoff](.agents/handoffs/2026-11-13-1127-ci-reliability.md). Handoffs are shared and committed.

- To resume the review fixes of 2026-11-13 (client reconnection, query ordering, composer clearing, `ChangeSettings`, `ReadThreadTree`, bounded image cache, navigation, test stability, CHG-0255; the Companion dock extraction, service consolidations, component tests and deterministic timing tests wait), read the [current handoff](.agents/handoffs/2026-11-13-1106-react-native-review-fixes.md). Handoffs are shared and committed.

- To resume device pairing's folder picker (batch 3a built and checked, CHG-0253 and CHG-0254, uncommitted: commit and push it to `main`, sync the original checkout; the picker was not driven in a window; the terminal on a host, 3b, and the direct-path prototype wait), read the [current handoff](.agents/handoffs/2026-11-13-0852-folder-picker-on-a-host.md). Handoffs are shared and committed.

