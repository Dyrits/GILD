# Handoff: Sidebar structure and quest lifecycle specification

Supersedes: none (forked from `2026-11-10-2334-free-realms-and-quest-moves.md`)
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch main

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Prepare the agreed left sidebar and simplified quest lifecycle for a later implementation batch.
The sidebar specification is settled; further usage-screen specification waits until work on Reserves begins.
This session authorized documentation and its commit, not application implementation or a data reset.

## State

- Verified by reading the specifications and documentation diff: CHG-0134 through CHG-0137 record the sidebar, nested quests, removal of Finished for quests and side-quests, Library's artifact purpose, Workshop's management role, and the Reserves direction.
- Verified by reading `documentation/capabilities/mission-tracking/specifications.md`: the canonical navigation order, nesting, lifecycle, and acceptance criteria are recorded; the navigation scope is specified without implementing it.
- Verified by reading `documentation/capabilities/budget-control/specifications.md` and the navigation draft: usage controls, totals, attribution, counts, and local date boundaries are recorded, with further screen specification explicitly deferred by the owner.
- Verified by `git status --short` and `git diff --cached --stat` before staging: this session's work is documentation only; unrelated account-budget edits remain in `packages/contracts/src/budgets.ts`, `packages/contracts/src/requests.ts`, `packages/service/src/core/spending.ts`, `packages/service/src/core/store.ts`, and untracked `packages/service/test/accountBudgets.test.ts`.
- Verified by `git branch --show-current`: this work is on local `main`.
- Verified by `git diff --check`: the specification changes have no whitespace errors.
- Verified by reading the pre-commit hook: documentation staging runs Biome, while workspace typechecking is conditional on staged code or configuration.
- Assumed pending the final commit command: this handoff, its AGENTS.md pointer, and the session's documentation will be committed together, excluding the account-budget work; inspect the resulting commit and working tree before resuming.
- No application tests, browser checks, runtime acceptance, implementation, or data reset were performed in this session.

## Decisions

- The canonical sidebar order and its contents live in `documentation/capabilities/mission-tracking/specifications.md#left-navigation-structure`; keep their agreed names and order.
- There is one navigation sidebar on the left and one details sidebar on the right, replacing the duplicate left quest-tree column; tree visibility is owned by `documentation/capabilities/thread-tree/specifications.md`.
- Quests and side-quests have no Finished or Done status; completed work stays idle until the quest is archived, and failures needing the owner become Summons.
  Waiting and stopped remain visible details, and stopped work requires explicit resume; lifecycle and aggregation are owned by mission-tracking and thread-tree.
- The owner requires no preservation or migration of existing development data because the product is unshipped; this removes a migration requirement without requesting an immediate reset.
- Library is for generated and uploaded artifacts, especially without a workspace; collection and lifecycle are deferred rather than inferred from the navigation entry.
- Workshop manages MCP servers, connectors, and skills, while Charter retains application settings, accounts, permissions, and defaults; existing resource-scoping rules remain authoritative in tool-and-skill-loading.
- Reserves' graph and detail level follow the owner's supplied OpenBot Usage text, with Gild terminology and reliable attribution; its agreed direction is in budget-control, and the owner explicitly deferred further screen specification.
- The owner supplied a quest-tree image in the conversation; its adopted nesting characteristics are written in mission-tracking, but no image artifact was saved to the repository.

## Next

1. Read `documentation/work-in-progress.md` and the canonical navigation and lifecycle specifications, then confirm the next authorized implementation or design focus with the owner.
2. Inspect the current sidebar, conversation layout, quest states, result reporting, archive controls, and Guildmaster actions against the new specifications; the earlier blueprints, historical verification records, and current application behavior can still describe the superseded Done lifecycle and separate tree column.
3. Read the architecture, first-slice design, relevant blueprints, conventions, and app-specific instructions before proposing a bounded implementation batch; account for the Free Realm and placement dependencies from the earlier handoff.
4. Preserve unrelated account-budget work and obtain implementation authorization before changing application code; run the acceptance checks for the authorized batch and keep visual acceptance distinct from automated verification.
5. Refine Reserves, Library, connector operations, and Craft behavior when those capabilities become the selected work, using the deferred pointers rather than reopening their full scope during sidebar preparation.

## Open questions

- No unresolved question blocks the agreed sidebar specification.
- Library collection, supported artifacts, access, and retention require their own specification before that capability is built.
- Connector operations, additional Workshop categories, and Craft execution remain separate future capability work.
- The behavior of destinations before their underlying capability is available needs agreement when scoping implementation.
- The full Reserves screen's remaining interactions, empty states, and final acceptance need refinement when the owner selects that screen for work; do not treat this as a reason to continue interviewing about it now.

## Sources

- `documentation/capabilities/mission-tracking/specifications.md`: canonical sidebar, placement, lifecycle, and acceptance.
- `documentation/capabilities/mission-tracking/draft.md`: deferred capability work, not open sidebar requirements.
- `documentation/capabilities/thread-tree/specifications.md`: single left tree, thread details, result behavior, and stopped work.
- `documentation/capabilities/thread-panel/specifications.md`: removal of Mark as done from both panels.
- `documentation/capabilities/mission-journal/specifications.md` and `documentation/capabilities/mission-coordination/specifications.md`: archive journaling and Guildmaster's revised quest actions.
- `documentation/capabilities/tool-and-skill-loading/specifications.md`: Workshop management location and unchanged loading rules.
- `documentation/capabilities/budget-control/specifications.md#reserves-usage-page`: agreed usage direction and explicit deferral.
- `documentation/glossary.md`, `documentation/changelog.md` (CHG-0134 through CHG-0137), `documentation/backlog.md`, and `documentation/work-in-progress.md`: vocabulary, agreements, deferrals, and current status.
- `.agents/handoffs/2026-11-10-2334-free-realms-and-quest-moves.md`: earlier Free Realm, quest-placement, and Guild Hall agreements and pending implementation design.
- `.githooks/pre-commit`: staged-file checks.
