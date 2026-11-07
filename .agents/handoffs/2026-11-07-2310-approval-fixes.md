# Handoff: approval fixes (CHG-0063)

Supersedes: `2026-11-07-1911-architecture-pass.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked to continue with the next step from the handoffs, building step by step and verifying, without questions. The next steps that needed no owner decision were the High Specifications findings, test-first. Both High findings and the first Medium one are done and committed locally as CHG-0063; not pushed.

## State

- **Done (CHG-0063):**
  - quote check: `packages/service/src/quotes.ts` (`isNamingQuote`), used by `approvals.ts`; `Sensitivity.verbs` in `patterns.ts`;
  - wrapped commands: `commandStart` in `patterns.ts`;
  - one-time allowances end with the turn: `Approvals.endTurn`, called from `threads.ts` `run`.
- **Verified by command output on 2026-11-07:** `bun run test` 380 passed, 8 skipped, twice; typecheck, `bun run check` (no diagnostics), `git diff --check` passed; 4 of 4 mutations caught. See `documentation/verification/2026-11-07-approval-fixes.md`.
- **Not verified:** any live harness; the app driven in the window; the exact command string of a Codex escalation.
- **Push:** not pushed. `origin/main` is at `62face4`; the pre-push hook refuses `main`, so the owner pushes (`git push --no-verify`) or asks an agent to.
- `.zcode/` stays untracked.

## Decisions

- Errors fall on the side of asking: "No problem, push it" or "Stop waiting and push it" now ask, since a negation word comes first in the sentence. Accepted as the cheap direction.
- Negation and naming are deterministic word lists (English and French), not a model call: cheap, testable, and the thread can always ask.
- The thread instructions were left as is; they already ask for "the owner's exact words naming it".

## Next

1. Owner: accept or reverse CHG-0062's behavior changes and CHG-0063.
2. Probe one live Codex escalation (a `git push` to a scratch remote at the stricter level) to record the command format, then close the High finding fully.
3. Remaining Medium findings in `work-in-progress.md` that need no owner decision: OpenCode edits outside the workspace (`opencode.ts`), and the Always allow pattern that can cover other kinds of action. Codex "Permissions" widenings, owner MCP servers in Codex/OpenCode, and widened sandbox hosts need the owner or a probe first.
4. Drive the app in the window (from the superseded handoff, Next 3).

## Open questions

Unchanged from the superseded handoff: CHG-0062 acceptance, every intel deletion declining awaiting changes, the glossary term for "runner", and the widened sandbox hosts.

## Sources

- `documentation/changelog.md` (CHG-0063)
- `documentation/verification/2026-11-07-approval-fixes.md`
- `documentation/work-in-progress.md`, section "Review, refactor, and architecture pass"
- `packages/service/src/quotes.ts`, `patterns.ts`, `approvals.ts`, `threads.ts`; `packages/service/test/approvals.test.ts`
