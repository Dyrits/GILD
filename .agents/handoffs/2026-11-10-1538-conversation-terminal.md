# Handoff: conversation terminal

Supersedes: none
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep the owner's default shell available as an interactive conversation message bubble, with its visible output supplied to the Companion when the owner sends.
The owner confirmed successful live use and requested a handoff, commit, and push.

## State

- Verified by Git history: `b2aa0fd` implements the terminal and progress-display fix; `2b9c53f` makes the live terminal and saved snapshots blue throughout, both on local main.
- Verified by reading recorded output: the full suite passed 617 tests with 10 skipped; the final typecheck, lint, desktop build, and web export passed.
- Verified by the isolated Electron drive: home and realm roots, no agent response on opening, input, hide/show, sent and steered context, reopening, and shell restart pass on the owner's Fish shell with a fake harness.
- Verified in the owner's messages: realm-root snapshots reached the Companion's context, and the owner confirmed the feature works.
- The owner has not explicitly accepted the latest all-blue appearance.
- Verified by Git status: unrelated edits remain in `AGENTS.md`, `apps/app/src/parchment.tsx`, and `apps/app/src/questPanel.tsx`, plus an untracked sidebar handoff and `.tmp.md`; preserve them separately.
- Remote publication is authorized and follows this handoff commit; the next session must inspect Git to confirm it completed.
- The feature worktree is `/private/tmp/gild-bang-terminal` on `bang-terminal`; the original display side-quest fix is in `/private/tmp/gild-progress-display` on `progress-display` and has already been integrated into main.

## Decisions

- `!` on an empty composer line opens the live shell as a conversation bubble without triggering the Companion.
- Use the default login shell, starting in the home folder without a realm and the realm root with one.
- Sending freezes output into the normal owner message and harness input; another `!` brings back the same continuing shell.
- Keep the owner's soft blue throughout live and frozen terminal blocks.
- The work label no longer displays a completed approval as current activity; live tool-by-tool progress remains outside this fix.
- Session lifetime, transcript bounds, and deferred Delta features are specified in the sources.

## Next

1. Inspect local and remote Git history to confirm whether the authorized final push completed.
2. If the owner reports a visual issue, reproduce it against the current terminal specification and interface.
3. Use an isolated checkout for desktop or service edits while the development app runs: each active launcher watches those files and restarts Electron, interrupting quests.

## Open questions

- Whether the owner accepts the latest all-blue appearance.

## Sources

- `documentation/capabilities/conversation-terminal/specifications.md`
- `documentation/architecture-decision-record/0012-desktop-conversation-terminals.md`
- `documentation/verification/2026-11-10-bang-terminal.md` and its adjacent drive script and screenshots
- `documentation/changelog.md`, CHG-0119 and CHG-0120
- `apps/desktop/src/terminals.ts`, `apps/desktop/src/main.ts`, `apps/desktop/src/preload.ts`
- `apps/app/src/useTerminal.tsx`, `apps/app/src/terminalPanel.web.tsx`, `apps/app/src/terminalMessage.tsx`, `apps/app/src/terminalSnapshot.ts`
- `apps/app/src/entries.ts`, `apps/app/test/entries.test.ts`, `apps/app/test/terminalSnapshot.test.ts`, `apps/desktop/test/terminals.test.ts`
- https://delta.dev/docs/agents/terminals
