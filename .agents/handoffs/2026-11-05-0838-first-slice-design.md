# Handoff: first slice design

Supersedes: `2026-11-05-0119-guest-access-and-data.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Design the first single-user slice: missions, the thread tree, and thread messaging on one harness. Define modules, interfaces, data ownership, and test seams before production implementation.

## State

- Verified by file reads: tool-and-skill-loading scope, automated checks, human acceptance, and agent additions are accepted in CHG-0022. Its specifications are authoritative and its draft is resolved. Acceptance checks have not been run against an implementation.
- Verified by diff review: architecture, requirements, outline, backlog, and the action-approval, budget-control, scoped-intel, and tool-and-skill-loading specifications now distinguish the single-user first build from future hosted access. Stale claims that accepted hosted decisions remain open were removed.
- Verified by command output: `git diff --check` passes. The branch is `main`; origin is the OPEN-MISSION repository listed below. The previous commit is `8d08952`.
- Verified by file reads and repository listing this session: the repository remains documentation only; no production implementation was added.
- Assumed: this handoff, its pointer, and the documentation changes are committed and pushed after writing, as the user requested. Check the latest commit and working tree on resumption.

## Decisions

- The user accepted the single-user tool-and-skill-loading scope and all proposed validation and agent additions in this session. See CHG-0022 and the capability specifications for the full agreement.
- The first build remains single-user. Preserve CHG-0014 and CHG-0016 through CHG-0021 when designing it; architecture holds the hosted agreements. Cross-installation execution, synchronization, and guest local copies remain undesigned.
- The remaining hosted invitation, reconnect, and delegated-work questions were retained in the backlog. They were not needed for this documentation step and have not been answered.
- The next work is technical design before production implementation. Tooling for non-app packages remains open until those packages are defined. No new toolchain choice was made.
- The user requested this handoff, commit, and push. This authorizes saving the current documentation, not production implementation or later commits.
- Continue any needed interview in one numbered round with complete questions, recommendations, and reasons; a yes accepts the recommendation. Keep explanations short and leave space for ordinary messages.

## Next

1. Read the outline, requirements, glossary, architecture, relevant decision records, and mission-tracking, thread-tree, thread-messaging, and tool-and-skill-loading specifications. Confirm the first slice's boundary and identify only behavior decisions that block its design.
2. Design the modules, interfaces, data ownership, and test seams for missions, the thread tree, and thread messaging on one harness. Select the harness with the user if existing agreements do not determine it. Preserve a path to the hosted agreements without adding multiplayer to this slice.
3. Resolve tooling for the packages the design actually needs. Expo CLI/Metro and Bun are selected; other test, lint, and formatting tools remain open.
4. Present the technical design and its acceptance coverage for review before production implementation. Record new agreements in the changelog, using CHG-0023 next if nothing intervenes.

## Open questions

- Which harness the first slice uses, and its concrete module and interface design, remain to be settled.
- Hosted invitation expiry after a pending request, reconnecting guest identity, and removal's effect on work delegated from a guest-triggered turn remain unresolved. Ask the user when needed for hosted design.
- Guest local-copy scope, synchronization, offline behavior, and retention, plus execution across installations, remain future design work.
- Runtime comparison, thread panel/context gauge, terminal, app-based skill installation, and MCP import remain deferred in the backlog.

## Sources

- `AGENTS.md`
- `documentation/outline.md`, `documentation/requirements.md`, `documentation/glossary.md`, `documentation/architecture.md`
- `documentation/architecture-decision-record/`
- `documentation/capabilities/mission-tracking/specifications.md`
- `documentation/capabilities/thread-tree/specifications.md`
- `documentation/capabilities/thread-messaging/specifications.md`
- `documentation/capabilities/tool-and-skill-loading/specifications.md` and `draft.md`
- `documentation/capabilities/action-approval/specifications.md`, `documentation/capabilities/budget-control/specifications.md`, `documentation/capabilities/scoped-intel/specifications.md`
- `documentation/backlog.md`, `documentation/changelog.md`, especially CHG-0014 through CHG-0022
- Repository: https://github.com/Dyrits/OPEN-MISSION
