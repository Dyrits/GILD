# Handoff: OpenCode carries on after a refusal (CHG-0065)

Supersedes: `2026-11-08-0945-live-probes.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked to continue with the next step from the handoffs, building and verifying step by step, without questions. The next step needing no owner decision was the Medium found live: a Deny on OpenCode cancelled its whole prompt, so the thread stopped and a Deny message never reached it. Done test-first as CHG-0065; uncommitted (side thread, commits only when the owner asks).

## State

- **Done (CHG-0065, uncommitted):** `opencode.ts` `runPrompts` keeps each refusal given during a prompt; when OpenCode answers `cancelled` after one and no interrupt is under way, it sends "Canopy refused the command `…` / the change to `…`. <answer text>" as a new prompt in the same turn and adds the usage of every prompt. The stand-in now cancels on a rejection as OpenCode does live.
- **Probe (2026-11-08, binary source of OpenCode 2.2.0):** `experimental.continue_loop_on_deny` is a dropped legacy key; ACP sends `reject` without a message; a rejection rejects every pending request of the session.
- **Verified by command output on 2026-11-08:** `bun run test` 392 passed, 10 skipped, twice; typecheck, `bun run check`, `git diff --check` passed; live `CANOPY_LIVE_HARNESSES=1 CANOPY_LIVE_OPENCODE_MODEL=opencode/deepseek-v4.1-flash-free` 5 of 5 passed; the mutation dropping the follow-up failed 3 stand-in checks and the live one. See `documentation/verification/2026-11-08-opencode-refusals.md`.
- **Not verified:** the app driven in the window; several refusals in one prompt.
- **Git:** CHG-0064 is committed at `aa6f07c` (the previous handoff said uncommitted; it was committed afterwards), not pushed. CHG-0065 uncommitted. `.zcode/` stays untracked.

## Decisions

- The follow-up prompt is sent within the same Canopy turn, not as the next turn's note: the thread carries on at once, as Claude Code and Codex do after a Deny, and no extra turn or message line appears.
- The refusal names the action as the owner saw it (command or absolute path) and reuses Approvals' answer text, so wording stays in one place.

## Next

1. Owner: accept or reverse CHG-0062, CHG-0063, CHG-0064, CHG-0065; commit CHG-0065 and push.
2. Remaining Medium findings needing the owner or a probe: Codex "Permissions" widenings, owner MCP servers in Codex/OpenCode, widened sandbox hosts.
3. Low findings in `work-in-progress.md` that need no owner decision, test-first: the opener-message cap count, the running limit counting Attention, a reopened mission on a removed account, the OpenCode edit summary at the stricter level, interrupted OpenCode turns counting no usage.
4. Drive the app in the window.

## Open questions

Unchanged: CHG-0062 acceptance, every intel deletion declining awaiting changes, the glossary term for "runner", the widened sandbox hosts.

## Sources

- `documentation/changelog.md` (CHG-0065)
- `documentation/verification/2026-11-08-opencode-refusals.md`
- `documentation/work-in-progress.md`, section "Review, refactor, and architecture pass"
- `packages/service/src/opencode.ts`; `packages/service/test/harnesses.test.ts`, `liveHarnesses.test.ts`, `fixtures/stand-in-opencode.mjs`
