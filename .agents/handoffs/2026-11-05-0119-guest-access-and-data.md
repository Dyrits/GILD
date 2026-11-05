# Handoff: guest access and mission data

Supersedes: `2026-11-05-0108-hosted-multiplayer-permissions.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Reconcile the documentation with the completed hosted multiplayer decisions, then finalize tool-and-skill-loading acceptance. Design the first slice before production implementation.

## State

- Verified by file reads and the session's edits: architecture and CHG-0019 through CHG-0021 record guest identity, invitations, history access, removal, permission downgrades, and data location.
- Verified by file reads: requirements now permits invited guests to receive shared conversations and results. Backlog records future guest local copies separately from the deferred hosted sync and pricing exploration.
- Verified by file read: tool-and-skill-loading/draft.md still awaits final scope, human acceptance, and review of its agent additions. It has not been reconciled with the multiplayer agreements.
- Verified by current architecture read: nothing is built. The first build remains single-user; these agreements concern future hosted multiplayer.
- Verified by git status and branch output: this work is on main; architecture, requirements, backlog, and changelog contain the session's changes. The earlier handoff is in commit 961c98b. The user requested a new handoff, commit, and push.
- Assumed: this handoff, its pointer, and the documentation changes are committed and pushed after writing. Check git status and the latest commit on resumption.

## Decisions

- CHG-0019: separate host-approved guest identities, no required central account, and single-use invitations to one mission. Discussion-only is the default; the host may grant permission to trigger agents.
- CHG-0020: guests see the whole mission history, all threads, and results. Removal blocks access, cancels their queued requests, and stops their running turns. A downgrade to discussion-only cancels queued requests but lets running turns finish. Completed results remain; actions already performed are not undone.
- CHG-0021: opening an invitation creates a pending request under the guest's chosen name. The host verifies the person through a trusted channel before approval. Unused invitations expire after 24 hours and can be cancelled or replaced.
- The user clarified data location: "first, everything is on the host", with probable local copies of mission documents and data in a future version. Future local copies are a direction, not an accepted synchronization or retention design. See architecture, requirements, and backlog.
- Preserve CHG-0014 through CHG-0018 in architecture: provisional host ownership, host execution and authority, host-funded guest work, explicit submission of guest discussions to agents, and the default-on resource-sharing toggle. Automatic discussion summaries and hosted sync/pricing remain deferred.
- Ask one numbered interview round with complete questions, recommendations, and reasons, then leave space for ordinary messages. A yes accepts the recommendation. Keep explanations short.
- The user authorized this handoff, commit, and push. This does not authorize production implementation or acceptance of remaining proposals.

## Next

1. Review architecture's requirements table, requirements, outline, glossary, backlog, and affected capability documents against CHG-0014 through CHG-0021. Remove stale open-question claims where agreements already answer them. Preserve the distinction between the single-user first build and future hosted multiplayer.
2. Identify any remaining behavior needed before technical design. In particular, invitation expiry after a pending request, reconnecting guest identity, and work delegated from a guest-triggered turn are not explicitly settled. Ask only if needed for the next design; do not silently extend the agreed rules.
3. Reconcile tool-and-skill-loading/draft.md and specifications.md with hosted resource access. Review its agent additions, finalize scope and human acceptance, and record the Agreement. The next free changelog number is CHG-0022 if nothing intervenes.
4. Design the first slice's modules, interfaces, data ownership, and test seams before implementation. Settle non-app tooling when its packages are defined.

## Open questions

- Tool-and-skill-loading final scope, human acceptance, and agent additions require the user's decision.
- Future guest local-copy scope, synchronization, offline behavior, and retention remain undesigned. No managed service or cloud history storage is accepted.
- Detailed guest authentication and session mechanisms remain technical design work. Ask the user about unresolved observable behavior when necessary.
- Runtime comparison, thread panel/context gauge, terminal, skill installation, and MCP import remain deferred in backlog.

## Sources

- `AGENTS.md`
- `documentation/architecture.md`, especially Future multiplayer and the requirements table
- `documentation/requirements.md`, `outline.md`, `glossary.md`, `backlog.md`
- `documentation/changelog.md`, CHG-0014 through CHG-0021
- `documentation/capabilities/tool-and-skill-loading/draft.md` and `specifications.md`
- `documentation/capabilities/*/specifications.md`
- `documentation/architecture-decision-record/`
- Repository: https://github.com/Dyrits/OPEN-MISSION
