# Handoff: Free Realms, quest moves, and Guild Hall

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch main

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Prepare implementation of Free Realms, direct quest creation, confirmed whole-quest moves, and Guildmaster's expanded role in the Guild Hall.
The functional agreements are recorded; the next session should design and scope implementation batches before writing production code.

## State

- Verified by reading the specifications and documentation diff: CHG-0130 through CHG-0133 record the agreements in the glossary, outline, capability specifications, architecture, and amendments to ADRs 0005 and 0012.
- Verified by reading the specifications: Free Realms, moves, direct realm creation, the Guild Hall rename, and Guildmaster's expanded search and management role are marked agreed, with implementation and runtime verification pending.
- Verified by `git diff --check`: the documentation changes have no whitespace errors before this handoff amendment.
- Verified by `git branch --show-current`: the current branch is main.
- Verified by `git status --short`: unrelated uncommitted budget work exists in `packages/contracts/src/budgets.ts`, `packages/contracts/src/requests.ts`, `packages/service/src/core/spending.ts`, `packages/service/src/core/store.ts`, and the untracked `packages/service/test/accountBudgets.test.ts`; preserve it and exclude it from this session's commit.
- No application checks, test suite, or implementation validation were run for this documentation agreement.
- The owner explicitly requested amending this handoff in place and amending the session's last documentation commit; that instruction overrides the usual new-file rule for this amendment only.

## Decisions

- Quest placement, direct creation, drag-and-drop, confirmation, and artifact preservation are authoritative in `documentation/capabilities/mission-tracking/specifications.md`.
  The owner wants whole-tree moves to correct wrong-workspace starts, with no running descendants and confirmation because realm lore may be specific to the former context.
- A quest is independent of its artifacts; the move changes future working context without relocating files, edits, branches, or old own copies.
  This replaces the earlier rule that a started thread's workspace cannot change.
- `documentation/capabilities/scoped-intel/specifications.md` owns lore visibility and precedence.
  Ordinary threads inherit broader lore; ancestors and sibling branches do not receive narrower lore automatically, and realm membership determines realm lore even for a side-quest working elsewhere.
- Guild Hall is the place; Guildmaster is the entity the owner talks with there.
  Its expanded role and access to all app-managed information and resources are in `documentation/capabilities/mission-coordination/specifications.md`, with a lore access exception in scoped-intel and service-enforced authority in ADR 0005.
- Direct quest creation bypasses Guildmaster; requests addressed to Guildmaster retain quest matching.
  This replaces the earlier rule that every quest starts through Guildmaster.
- The owner's terminal uses the home folder for a Free Realm or realmless quest, as defined in conversation-terminal and referenced by ADR 0012.
  Agents without a workspace still use the quest's scratch folder.
- The owner requested clearer agent documentation and plain prose; move rules now live in mission-tracking, lore visibility in scoped-intel, and other documents link to those rules.
- No production implementation or push was authorized or performed in this session.

## Next

1. Confirm the next implementation-design focus with the owner, then read the source specifications, architecture, first-slice design, relevant blueprints, conventions, and work-in-progress status.
2. Inspect realm/workspace identity, quest creation, lore lookup, harness continuation, permissions, own-copy lifecycle, and Guildmaster's tools; distinguish current code from the new agreements.
3. Propose bounded batches covering Free Realms and lore, direct creation and confirmed sidebar moves, and Guild Hall with Guildmaster's app-wide search and management.
4. Resolve the technical questions below and attach the specification's acceptance checks to each batch.
5. After authorization, implement and verify the chosen batch; for moves, cover all placements, Cancel, whole-tree preservation, and a descendant starting a turn while confirmation is open.

## Open questions

- The sidebar `+` button is the owner's proposed creation control; its exact placement and appearance still need design and visual review.
- Free Realm identity, migration of existing workspace lore, and continuation of harness sessions in a changed working folder need technical design.
- Moves must refresh instructions, tools, skills, and permissions and guard against turns starting between drag, confirmation, and the actual move.
  Consider pending approvals, queued messages, and scheduled turns; the owner required no running threads, not that all threads be Idle.
- Retained worktrees need their original merge destination and accessible locations after a move.
  Review existing archive and deletion cleanup separately; no new artifact-deletion policy was agreed.
- Ritual configuration and its quest's placement must remain consistent, and the thread panel must distinguish a realm from a working folder.
  These dependencies were identified in the capability review but have not been fully specified.
- Guildmaster needs search and management tool contracts covering app-managed resources, with its authority enforced separately from ordinary thread access.
  The existing tool table is not the complete future contract.
- Inspect the code and propose technical details before implementation; new observable policy choices belong to the owner.

## Sources

- `documentation/glossary.md`: Realm, Free Realm, Realmless Quest, Guild Hall, Guildmaster, Workspace, and Lore scope.
- `documentation/outline.md`: capability map updated for the agreement.
- `documentation/capabilities/mission-tracking/specifications.md`: direct creation, authoritative placement and move behavior, and acceptance checks.
- `documentation/capabilities/mission-coordination/specifications.md`: Guild Hall, Guildmaster's expanded role, existing tools, and the direct-creation exception.
- `documentation/capabilities/workspace-attachment/specifications.md#changing-a-threads-workspace`: link to whole-quest moves, separate from folder relocation.
- `documentation/capabilities/scoped-intel/specifications.md#scopes`: lore visibility, lookup, and Guildmaster's access exception.
- `documentation/capabilities/conversation-terminal/specifications.md`: terminal starting folders, distinct from agent scratch folders.
- `documentation/capabilities/thread-tree/specifications.md#threads-and-missions`: reference to whole-tree moves.
- `documentation/changelog.md`: CHG-0130 through CHG-0133, functional agreements only.
- `documentation/architecture-decision-record/0005-thread-tools-over-mcp.md` and `0012-desktop-conversation-terminals.md`: authority amendment and terminal clarification.
- `documentation/architecture.md`, `documentation/first-slice-design.md`, and relevant capability blueprints: existing technical decisions to inspect before design.
- `documentation/work-in-progress.md`: other ongoing batches and recorded validation, not proof of this feature.
