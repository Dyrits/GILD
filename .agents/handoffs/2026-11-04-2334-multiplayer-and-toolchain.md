# Handoff: multiplayer architecture and toolchain

Supersedes: `2026-11-04-1903-multiplayer-and-tool-loading.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Settle the multiplayer assumptions that affect the first build, then finish tool-and-skill-loading acceptance. Design missions, the thread tree, and thread messaging on one harness before writing production code.

## State

- Verified by current file reads: architecture records provisional mission-state ownership and the guest discussion proposals. Execution ownership and permissions remain open. CHG-0014 records the provisional ownership agreement.
- Verified by current file reads: automatic discussion summarization is deferred in the backlog. The user set it aside after discussing extra token use.
- Verified by this session's edit: architecture excludes Vite+ and keeps Expo CLI with Metro for the app. CHG-0015 records the user's instruction. No replacement test, lint, or formatting toolchain was approved.
- Verified by reading tool-and-skill-loading/draft.md: final scope and acceptance remain open. Skills expose names and descriptions first; full instructions load when used. Preserve that correction.
- Verified by git status before writing: branch main tracks origin/main; architecture, backlog, and changelog contained this session's edits. Assumed: this handoff and those edits are committed and pushed after writing, as explicitly requested. Check git status and the latest commit on resumption.
- Nothing has been implemented. This remains documentation and design work.

## Decisions

- One host installation owns each shared mission's authoritative state for now, explicitly subject to evolution. See architecture and CHG-0014. This does not settle execution ownership.
- The user questioned triggering another person's agents. We compared OpenBot's shared agents on one host with Delta's sender-owned execution and synchronized conversation/files. Delta's official documentation confirms server storage and DeltaDB synchronization; its model is materially more work than hosted participation.
- The current proposal is host-only execution with guest permissions to either trigger agents or only discuss. The user proposed mini discussions beneath guest messages, submitted to an agent only when the host chooses, or conveyed through the host's own conclusion. Do not treat this as a completed behavior agreement.
- Automatic summarization is deferred. Do not reintroduce it as a prerequisite.
- Vite+ is removed. Bun remains the package manager. Suggestions of Vitest or separate linting/formatting were recommendations, not accepted replacements.
- Ask one interview round, then leave space for ordinary messages. Use numbered complete questions, a recommendation, and its reason; a yes accepts the recommendation. Keep explanations short and concrete.
- The user requested this handoff, commit, and push. This authorizes saving the work, not implementation or acceptance of remaining product proposals. Later commits require their own request.

## Next

1. Resume the hosted multiplayer discussion. Confirm execution on the mission host and the two guest permissions, then settle when a guest message triggers a turn and which discussion messages enter agent context. Do not assume all guest messages enter context with the host's next request.
2. Settle approval authority, standing permissions, billing and budgets, private versus shared MCP/skills/intel, and access revocation. Reconcile the local-data requirement with invited participants. Keep cross-installation collaboration as a future goal unless the user explicitly changes it.
3. Record agreements and review affected documentation for consistency. The next free changelog number is CHG-0016 if no other work intervenes.
4. Finish tool-and-skill-loading's draft: resolve multiplayer scope, review agent additions, confirm acceptance, and record its Agreement.
5. Design the first slice before implementation. Tooling for non-app packages can be settled when those packages are defined; Vite+ is not selected.

## Open questions

- Are the host-only execution model and the two guest permissions accepted? They were discussed but not confirmed as a complete model.
- Can discussion-only guests talk in the main conversation, in mini discussions, or both? Can the host submit selected messages? Does any unsubmitted discussion enter agent context? These are unresolved.
- Who may approve actions, grant standing permissions, spend the host's budget, and access private context? The user must decide.
- How will collaboration across independent installations work later? No synchronization design is agreed.
- Tool-and-skill-loading final scope, human acceptance, and agent additions remain unconfirmed. See its draft.
- Desktop runtime comparison, thread panel/context gauge, terminal, DeltaDB, skill installation, and MCP import remain deferred in the backlog.

## Sources

- `AGENTS.md`
- `documentation/architecture.md`, `requirements.md`, `outline.md`, `glossary.md`, `backlog.md`, `changelog.md`
- `documentation/capabilities/tool-and-skill-loading/specifications.md` and `draft.md`
- `documentation/capabilities/*/specifications.md`
- `documentation/architecture-decision-record/`
- OpenBot hosted participation: https://openbot.run/guides/openbot-101
- Delta sender-owned execution: https://delta.dev/docs/collaboration/collaborate-thread
- Delta server storage: https://delta.dev/docs/privacy-and-security/data-storage
- Expo Metro: https://docs.expo.dev/guides/why-metro/
- Repository: https://github.com/Dyrits/OPEN-MISSION
