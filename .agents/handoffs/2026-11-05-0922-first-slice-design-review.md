# Handoff: first slice design review

Supersedes: `2026-11-05-0838-first-slice-design.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Review and settle the proposed technical design for the first single-user slice on Claude Code before production implementation. Finish with agreed module interfaces, dependency gates, and concrete tooling backed by harness protocol evidence.

## State

- Verified by file reads: `documentation/first-slice-design.md` proposes package homes, module interfaces, SQLite records, delivery ordering and recovery, harness seams, live-launch gates, transport, and tooling. It explicitly labels technical choices as proposed.
- Verified by file reads: mission-tracking, thread-tree, and thread-messaging each have a new `blueprint.md` mapping specification acceptance to included or staged work. Their specifications link to them; README and AGENTS.md point to the design.
- Verified by diff review: CHG-0023 records the user's accepted scope and first harness. The messaging tool contract now accepts and retains messages for Stopped threads instead of contradicting its delivery rules.
- Verified by command output: `git diff --check` passed before this handoff. The current branch is `main`, with origin `git@github.com:Dyrits/OPEN-MISSION.git`. This session added documentation only; no implementation or harness conformance checks ran.
- Assumed: the documentation, this handoff, and its pointer are committed and pushed after this file is written, as requested. Check the latest commit and remote state on resumption.

## Decisions

- The user chose Claude Code first, with a fake harness for automated checks, and accepted staging dependencies and remaining acceptance criteria. CHG-0023 records the exact answers.
- After asking why a message would not restart a thread, the user explicitly chose "Keep stopped until resumed". Waiting, Idle, and Done still wake on messages.
- Technical interfaces, recovery behavior, package homes, and tooling remain proposals, not approved implementation instructions. Saving, committing, and pushing this draft does not accept those proposals.
- Existing architecture and hosted agreements remain authoritative. The proposed slice does not add hosted access, phone pairing, a second harness, or change the selected runtime.
- The user requested this handoff, commit, and push. That authorizes these documentation changes and their publication, not production implementation or later commits.
- Continue design questions in a numbered round with complete questions, recommendations, and brief reasons. A yes accepts the recommendation.

## Next

1. Read the shared design, three blueprints, and authoritative documents below. Present the pending review decisions to the user, starting with module interfaces and the package homes they imply.
2. Resolve scope wording before treating the proposal as agreed: "reopening" currently covers continuing threads, while Done/Archived mission reopening is staged. The thread-tree blueprint's blanket immutable execution configuration must be narrowed to workspace attachment and reconciled with future handover of harness, agent, model, and effort.
3. Review dependency gates and uncovered behavior. In particular, the journal/context path, live action approval, native-subagent handling, failure recovery, chatter reset rules, and the proposed fallback mission state need review; acceptance tables are plans, not test evidence.
4. Verify Claude Code's actual protocol against the installed tool and current official documentation before selecting concrete adapter behavior. Record supported delivery, cancellation, MCP/skill loading, permissions, native-subagent handling, and usage events. No protocol flags have been validated yet.
5. Choose remaining libraries and tooling after their consumers and runtime constraints are known. Update the proposed documents with accepted decisions, and use CHG-0024 next if nothing intervenes. Present the resulting design and coverage before production implementation.

## Open questions

- Will the user accept the proposed module interfaces and package homes? The shared design recommends keeping adapters and persistence inside one service package.
- Are the proposed crash recovery, uncertain delivery handling, chatter reset semantics, and live-launch gates acceptable? They have not been confirmed.
- Which protocol features does the selected Claude Code version actually support? Research and a later conformance check must answer this.
- Which SQLite driver, migration mechanism, transport, validation, test, lint, and formatting libraries should be used? Node's test runner, ESLint, and Prettier are recommendations only; Bun and Expo CLI/Metro were already selected.
- Hosted questions remain deferred in the backlog. No new multiplayer decision was made.

## Sources

- `AGENTS.md`, `README.md`
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
- `documentation/backlog.md`, `documentation/changelog.md`, especially CHG-0023
- Repository: https://github.com/Dyrits/OPEN-MISSION
