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

- To resume the CHG-0208 review follow-up (sandbox and structural actions: refactors and the Seatbelt signal rule done, P1 application launch and P2 to P11 open, P8 and P9 waiting for owner decisions), read the [current handoff](.agents/handoffs/2026-11-12-1405-sandbox-review-follow-up.md). Handoffs are shared and committed.

- To resume device pairing (shared relay deployed and the optional own relay on the user's Cloudflare account built and checked live, CHG-0209 and CHG-0212; a real pairing between two apps through the shared relay not yet seen; folder picker and terminal on a host, the direct path, relay limits and the usage measurement remain), read the [current handoff](.agents/handoffs/2026-11-12-2142-device-pairing-own-relay.md). Handoffs are shared and committed.

- To resume release readiness for 0.1.0-Alpha and Iskios's app guide (the two failing hosted tests fixed and the Apache 2.0 license added and pushed, CHG-0210; the app guide and its `read_app_guide` tool built and checked, CHG-0211; manual installer builds, their smoke tests on real systems, and the version tag remain, and the guide's text awaits the owner's review), read the [current handoff](.agents/handoffs/2026-11-12-2143-release-readiness-and-app-guide.md). Handoffs are shared and committed.

