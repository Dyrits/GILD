# Handoff: first slice boundaries

Supersedes: `2026-11-05-0922-first-slice-design-review.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish the first slice's technical design review before production implementation. Next settle dependency gates, recovery, and chatter-guard resets, then verify the Claude Code protocol and choose concrete tooling.

## State

- Verified by file and diff reads: CHG-0024 records the user's acceptance of package and module boundaries, thread continuation scope, and the workspace-attachment correction. The shared design and mission-tracking and thread-tree blueprints reflect those decisions.
- Verified by diff review: detailed interfaces, storage behavior, dependency gates, and tooling remain proposed. No production code or implementation acceptance evidence was added in this session.
- Verified by command output: the working branch is `main`; origin is `git@github.com:Dyrits/OPEN-MISSION.git`. The reviewed changes are the four documentation files named below. The previous handoff was committed in `54df4b2`.
- Verified by command output before writing this handoff: `git diff --check` passed.
- Assumed: this handoff, its AGENTS.md pointer, and the reviewed documentation are committed and pushed after writing, as requested. Check the latest commit and remote state on resumption.

## Decisions

- CHG-0024 accepts `apps/app`, `apps/desktop`, `packages/service`, and `packages/contracts`. Keep adapters and persistence inside the service. The service owns missions, threads, messaging, execution, context, and SQLite; contracts contains shared transport records and validation. Detailed method contracts remain under review.
- Continuing Done threads and explicitly resuming Stopped threads are included. Reopening Done or Archived missions waits for mission-ending behavior. This resolves the earlier ambiguous word "reopening" without adding mission lifecycle work.
- Only workspace attachment is immutable after first start. Changes to harness, agent, model, and effort remain part of the later handover capability; the blanket immutable execution-configuration wording was corrected.
- Preserve CHG-0023: Claude Code first, with a fake harness for automated checks; Stopped threads retain messages until explicit resume. Preserve the staged acceptance in all three blueprints and the authoritative architecture, including future hosted agreements.
- The user requested this handoff, commit, and push. This authorizes publication of the current documentation, not production implementation or acceptance of remaining proposals.
- Continue design questions in a numbered round with complete questions, recommendations, and brief reasons. A yes accepts the recommendation. The user accepted all three recommendations in this session; do not ask those questions again.

## Next

1. Read the shared design and blueprints against the authoritative documents. Present the next review round on dependency gates, crash recovery, and chatter-guard reset semantics. No questions on these topics were presented or answered in this session.
2. Review the proposed context/journal staging, approval and required-tool launch gates, native-subagent handling, and fallback mission state. Acceptance tables describe planned coverage, not passing tests.
3. Verify the installed Claude Code version and current official protocol documentation before choosing concrete adapter behavior. Record evidence for message delivery, cancellation, permissions, MCP and skill loading, native subagents, and usage events. No protocol flags have been validated.
4. Settle detailed command contracts and remaining libraries using the verified runtime constraints. Update the design and affected blueprints with accepted decisions. Use CHG-0025 next if nothing intervenes.
5. Present the complete design and staged acceptance coverage before production implementation.

## Open questions

- Does the user accept the proposed dependency gates and fake-adapter-first verification sequence?
- How should recovery handle interrupted execution and delivery whose adapter acceptance is uncertain? The current proposal avoids automatic replay and asks for an explicit continuation decision.
- What precisely resets the chatter count? The messaging blueprint proposes a user message to either participant or a result in their exchange; this interpretation is unconfirmed.
- Is Idle the right mission projection when no thread has a more urgent state, including when all threads are Done or Stopped?
- Which Claude Code protocol features are supported by the selected version, and which libraries should implement SQLite, migrations, transport, validation, tests, linting, and formatting? Existing runtime and Expo choices remain agreed.

## Sources

- `AGENTS.md`, `README.md`
- `documentation/changelog.md`, especially CHG-0023 and CHG-0024
- `documentation/first-slice-design.md`
- `documentation/capabilities/mission-tracking/blueprint.md` and `specifications.md`
- `documentation/capabilities/thread-tree/blueprint.md` and `specifications.md`
- `documentation/capabilities/thread-messaging/blueprint.md` and `specifications.md`
- `documentation/outline.md`, `documentation/requirements.md`, `documentation/glossary.md`, `documentation/architecture.md`
- `documentation/architecture-decision-record/`, especially 0002 and 0005 through 0010
- `documentation/capabilities/mission-journal/specifications.md`
- `documentation/capabilities/tool-and-skill-loading/specifications.md`
- `documentation/capabilities/action-approval/specifications.md`
- `documentation/capabilities/budget-control/specifications.md`
- `documentation/capabilities/workspace-attachment/specifications.md`
- `documentation/capabilities/scoped-intel/specifications.md`
- `documentation/backlog.md`
- Repository: https://github.com/Dyrits/OPEN-MISSION
