# Handoff: OpenCode edits and Always allow kinds (CHG-0064)

Supersedes: `2026-11-07-2310-approval-fixes.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked again to continue with the next step from the handoffs, building step by step and verifying, without questions. The next steps that needed no owner decision were the two remaining Medium Specifications findings: OpenCode edits outside the workspace, and Always allow patterns crossing kinds of action. Both are done, test-first, in the working tree as CHG-0064; not committed (this session ran as a side thread, which commits only when the owner asks).

## State

- **Done (CHG-0064, uncommitted):**
  - OpenCode edits: `edit` is `ask` at every level (`opencode.ts`, `permissions`); `isUnaskedEdit` lets a default-level edit run when every named file is inside the thread's folder (`isInsideFolder` in `folders.ts`, resolving `..` and links); otherwise Approvals asks.
  - Always allow kinds: `kindOfPermission` (`patterns.ts`); `findCoveringPermission(threadId, target, kind)` (`permissions.ts`); a thread's question stores `savedPatternOf(...)` (`approvals.ts`).
- **Verified by command output on 2026-11-08:** `bun run test` 388 passed, 8 skipped, twice; typecheck, `bun run check`, `git diff --check` passed; 4 of 4 mutations caught. See `documentation/verification/2026-11-08-edits-and-pattern-kinds.md`.
- **Not verified:** a real OpenCode edit request's paths; any live harness; the app driven in the window.
- **Git:** CHG-0063 is committed locally at `b58a390` (plus `1f00947`), not pushed; CHG-0064 is uncommitted. `.zcode/` stays untracked.

## Decisions

- The edit decision sits in the OpenCode adapter, not in Approvals: only OpenCode lacks a sandbox, and Claude Code and Codex already prompt only outside their folder. An edit inside the folder leaves no line, as with them.
- A permission's kind is read from its sentence: the sensitive list already names saved permissions after its kinds. Errors fall on the side of asking.

## Next

1. Owner: accept or reverse CHG-0062's behavior changes, CHG-0063, and CHG-0064; commit CHG-0064 and push.
2. Probe one live Codex escalation and one live OpenCode edit, at the owner's cost in tokens, to record their formats.
3. Remaining Medium findings need the owner or a probe first: Codex "Permissions" widenings, owner MCP servers in Codex/OpenCode, widened sandbox hosts.
4. Low findings in `work-in-progress.md` that need no owner decision, test-first: the opener-message cap count, the running limit counting Attention, a reopened mission on a removed account, the OpenCode edit summary at the stricter level.
5. Drive the app in the window.

## Open questions

Unchanged: CHG-0062 acceptance, every intel deletion declining awaiting changes, the glossary term for "runner", and the widened sandbox hosts.

## Sources

- `documentation/changelog.md` (CHG-0064)
- `documentation/verification/2026-11-08-edits-and-pattern-kinds.md`
- `documentation/work-in-progress.md`, section "Review, refactor, and architecture pass"
- `packages/service/src/opencode.ts`, `folders.ts`, `permissions.ts`, `patterns.ts`, `approvals.ts`
