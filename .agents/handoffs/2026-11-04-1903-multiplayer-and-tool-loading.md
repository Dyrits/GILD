# Handoff: multiplayer architecture and tool loading

Supersedes: `2026-11-04-1645-specify-next-capability.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`, remote `origin` = git@github.com:Dyrits/OPEN-MISSION.git (private)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Resolve the architectural assumptions that could block future multiplayer, then finish tool-and-skill-loading. Before writing production code, design the first slice: missions, the thread tree, and thread messaging on one harness.

## State

- Verified by reading the repository: it contains documentation only; nine earlier capabilities are specified. The new `documentation/capabilities/tool-and-skill-loading/specifications.md` records the interview's behavior decisions, but its final scope and human acceptance remain unconfirmed. Its `draft.md` lists remaining work and agent additions awaiting review.
- Verified by file reads: the skill-loading correction is applied to the specification, architecture, outline, and draft. Skills expose names and descriptions first; full instructions load when used. Do not restore the earlier full-body-at-start interpretation of Q3.
- Verified by file reads: CHG-0013 records future multiplayer, including both people joining one host's missions and people collaborating across their own installations. Requirements and outline record the goal; architecture lists unresolved consequences; backlog lists the architecture review.
- Verified by `git status -sb` before this handoff: branch `main` tracked `origin/main`, with only this session's documentation changes outstanding. The user explicitly requested this handoff, commit, and push. Assumed: these are committed and pushed after writing this file; check `git log` and `git status -sb` on resumption.

## Decisions

- The first build may remain single-user, but multiplayer is a future requirement, not a permanent exclusion. Both hosted participation and collaboration across independent installations must remain possible. The architecture's new section owns the review questions; it is not an agreed multiplayer design.
- Tool-and-skill-loading decisions are in its specification. Final acceptance remains open; saving this work does not settle it. The next Agreement number is CHG-0014 if no other entry intervenes.
- The user corrected Q3 after repeated structured questions prevented their waiting messages from arriving. Ask one interview round, then end the turn so ordinary messages can arrive. Do not run consecutive question rounds without giving them space.
- Continue the established interview style when questions are needed: numbered Qn, a complete question, and a recommended answer with its reason. A yes accepts that recommendation. Keep answers short and use plain terms.
- Bun remains the package manager. No implementation or architecture replacement was authorized in this session. Commit only when requested; this session's commit and push were explicitly requested.
- The previously agreed first-build order remains: finish the prerequisites, design the first slice, then build missions, thread tree, and thread messaging on one harness; add journal, intel, approvals, and budgets later. The desktop runtime prototype can wait until before release.

## Next

1. Read the architecture's future-multiplayer section and requirements. Explain the remaining blocking choices briefly, then settle shared-state ownership, execution ownership, participant authority, and private versus shared context with the user. Do not assume that every installation writes every mission independently or that all participants share provider and MCP credentials.
2. Review the consequences for the local-data requirement, device pairing, approvals and standing permissions, budgets, workspace identity, and global skill/MCP/intel scope. SQLite and the local service were not rejected; distinguish actual blockers from changes that can wait. Update decisions only when authorized.
3. Return to tool-and-skill-loading's `draft.md`. Resolve multiplayer implications, confirm the completed scope and acceptance, and record its Agreement under the next free changelog number. Review all documentation for consistency.
4. Design the first build slice's modules, interfaces, data ownership, and test seams before production code. Ask for a commit only when the user has not already requested one for that later work.

## Open questions

- Multiplayer data ownership and synchronization: one authority per shared mission, replicas, offline writes, and conflict behavior remain undecided.
- Multiplayer authorization: who can join, see private context, steer or stop a thread, approve actions, grant standing permissions, and spend whose budget or provider account? The user must settle these.
- Execution and workspace ownership across installations remain undecided; current paths identify folders on one computer.
- Tool-and-skill-loading's final scope and proposed acceptance are unconfirmed. Its agent-added checks and behavior are listed in `draft.md`.
- Other prior deferrals remain in the backlog, including runtime comparison, thread panel/context gauge, terminal, and DeltaDB. Skill installation through the app and importing harness MCP configuration are deferred too.

## Sources

- `AGENTS.md`: document index and current handoff pointer.
- `documentation/requirements.md`, `outline.md`, `glossary.md`, `architecture.md`, `backlog.md`, `changelog.md`.
- `documentation/capabilities/tool-and-skill-loading/specifications.md` and `draft.md`.
- `documentation/capabilities/*/specifications.md`: existing capability agreements.
- `documentation/architecture-decision-record/0002-one-local-service-owns-all-data.md`, `0003-per-user-relay-carrying-all-traffic.md`, `0005-thread-tools-over-mcp.md`, and `0008-drive-harness-tools-directly.md`.
- Repository: https://github.com/Dyrits/OPEN-MISSION
