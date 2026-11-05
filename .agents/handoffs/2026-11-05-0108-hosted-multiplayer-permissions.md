# Handoff: hosted multiplayer permissions

Supersedes: `2026-11-04-2334-multiplayer-and-toolchain.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Finish the multiplayer decisions that affect the first build, then finalize tool-and-skill-loading acceptance. Design missions, the thread tree, and thread messaging on one harness before production implementation.

## State

- Verified by current file reads: architecture records this session's hosted execution, guest discussion, authority, spending, and resource-sharing agreements. CHG-0016 through CHG-0018 record their acceptance.
- Verified by current file reads: identity, invitations, revocation, and the local-data requirement's sharing exception remain open. The architecture's requirements table still lists some now-settled multiplayer questions; reconcile it during the consistency review.
- Verified by current file read: tool-and-skill-loading/draft.md still awaits final scope, human acceptance, and review of its agent additions. It has not yet been reconciled with this session's multiplayer agreements.
- Verified by git status: before this handoff, architecture and changelog contained this session's edits; backlog had a pre-existing uncommitted hosted-sync/pricing deferral. Preserve that deferral. The user requested a handoff, commit, and push of the current work.
- Verified by architecture read: nothing is built yet. This session changed documentation only.
- Assumed: this handoff, its pointer, and the documentation changes are committed and pushed after writing. Check git status and the latest commit on resumption.

## Decisions

- CHG-0016: all agents run on the mission host in the first hosted version. Guests may trigger agents or only discuss. Discussion-only guests write beneath messages; only messages explicitly submitted by the host enter agent context. The host may instead write their own conclusion.
- CHG-0017: only the host approves risky actions, grants standing permissions, and changes budgets. Guest-triggered work uses the host's provider account within the mission and global budgets.
- CHG-0018: a toggle when sharing retains the host's selected MCP connections, skills, and intel for agents, on by default, regardless of who triggers a turn. Off restricts every turn in that shared mission to host-selected resources. Guests see shared conversations and results, but not resource settings, credentials, or unshared intel. Replies may reveal information from enabled resources. See architecture for the authoritative wording.
- Mission-state ownership remains provisionally on one host, subject to evolution (CHG-0014). Joining from another installation does not mean execution there. Cross-installation execution and synchronization are future design work.
- Automatic discussion summaries and hosted sync/pricing remain deferred. No managed service, price, or cloud history storage was accepted. Vite+ remains excluded; Bun and Expo CLI/Metro remain selected. Other tooling is open.
- Skills expose names and descriptions at turn start; full instructions load when used. Preserve the earlier correction.
- Ask one numbered interview round with complete questions, recommendations, and reasons, then leave space for ordinary messages. A yes accepts the recommendation. Keep explanations short.
- The current request authorizes this handoff, commit, and push. It does not authorize production implementation or acceptance of remaining proposals.

## Next

1. Continue the interview with guest identity and invitations, revocation, and permission changes. Settle what happens to queued or running guest-triggered work when access is removed; do not infer an answer from host-only approvals.
2. Agree the local-data requirement's exception for invited participants and review access to past conversations, threads, and results. Clarify any remaining sharing-toggle details needed for an implementable agreement without reopening accepted defaults.
3. Record new agreements using CHG-0019 next if nothing intervenes. Reconcile architecture's requirements table, requirements, outline, glossary, backlog, and affected capability documents with the completed multiplayer choices. Keep first-build single-user scope distinct from future hosted behavior.
4. Return to tool-and-skill-loading/draft.md. Review agent additions, finalize scope and human acceptance, record its Agreement, and check consistency. Do not treat a commit as product acceptance.
5. Design the first slice's modules, interfaces, data ownership, and test seams before implementation. Settle non-app tooling when its packages are defined.

## Open questions

- How are guests identified and invited, and which mission history and threads may they see? The user decides.
- What happens on access revocation or a change from trigger permission to discussion-only, including pending and running work? The user decides.
- What wording permits invited sharing under the local-data requirement, and what may clients retain? The user decides.
- Tool-and-skill-loading final scope, acceptance, and agent additions remain unconfirmed in its draft.
- Cross-installation execution and synchronization remain undesigned. Runtime comparison, thread panel/context gauge, terminal, skill installation, and MCP import remain deferred in the backlog.

## Sources

- `AGENTS.md`
- `documentation/architecture.md`, especially Future multiplayer
- `documentation/changelog.md`, CHG-0014 through CHG-0018
- `documentation/requirements.md`, `outline.md`, `glossary.md`, `backlog.md`
- `documentation/capabilities/tool-and-skill-loading/specifications.md` and `draft.md`
- `documentation/capabilities/*/specifications.md`
- `documentation/architecture-decision-record/`
- Repository: https://github.com/Dyrits/OPEN-MISSION
