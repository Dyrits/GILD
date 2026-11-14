# Handoff: Security audit run 2, sandbox token isolation (SA-11, SA-13)

Supersedes: `2026-11-14-1111-security-audit-fixes.md`
Workspace: ISKIOS repository, branch `main`. This session worked in the Delta clone at `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS/.delta/worktrees/v0thjkz6yjfy/ISKIOS`; the owner's main checkout is `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Settle the audit's SA-11 (owner token in the service's environment) and SA-13 (thread tool server addresses in harness arguments or environment): check whether a sandboxed command can read them, and fix what it can read without breaking how threads share context. Done means each harness's sandbox is checked by a run and any leak is closed.

## State

- **Fixed for OpenCode on macOS (verified by tests and the probe).** OpenCode's Seatbelt profile (`seatbeltProfileOf` in `packages/service/src/harness/openCodeSandbox.ts`) now has `(deny process-info*)`, `(allow process-info* (target same-sandbox))` and `(deny sysctl-read (sysctl-name-prefix "kern.procargs"))`. Before, a sandboxed command could list processes, map a port to its process, and read any process's arguments and environment. Recorded as CHG-0277.
- **Checks (verified in this session):** the two new tests in `packages/service/test/harness/openCodeSandbox.test.ts` failed before the fix and pass after; `bun run typecheck` passes; `bun run check` is clean; `bun run test` passed, 1539 passed, 14 skipped (run just before a formatting-only Biome fix to the test file, whose 30 tests pass again). `harnesses.test.ts` (83 tests, real sandboxed processes) passed. `sh documentation/verification/2026-11-14-token-isolation/scripts/probe-opencode.sh` shows the read succeeding under the old profile and failing under the new one.
- **Claude Code and Codex (assumed, read only):** their macOS profiles deny by default and allow `process-info*` only within their own sandbox; Claude Code's `sysctl-read` list lacks `kern.procargs`. Not run: the session's auto-mode permission classifier declined, twice, to run `@anthropic-ai/sandbox-runtime` from npm, even after the owner approved it. This was not worked around.
- **Not checked:** Linux (bubblewrap), a live OpenCode turn under the new profile, the owner socket and tool server accepting a recovered dummy token at run time (source-proven only), and same-user processes outside any sandbox, which can still read the owner token.
- **Commit and push:** this handoff is committed with the batch on `main`, rebased onto `5be1da9`, and pushed at the owner's request (2026-11-14). Check `git log origin/main` for the result.
- **CHG-0276 (verified by `git log`):** "A working thread's tool calls show as steps" landed on `origin/main` as `eedfa29`, with its own handoff `2026-11-14-1221-working-thread-steps.md` (`5be1da9`), while this batch was being committed. This batch was rebased onto it. The only conflict was the changelog, where both records were kept in order (CHG-0276, then CHG-0277); `AGENTS.md` and the action-approval specification merged cleanly.
- **Disk:** the system volume had 35 GiB free when this was written; the earlier `ENOSPC` lesson in the superseded handoff still applies to large test runs in `/tmp`.

## Decisions

- Threads learn about each other through the thread tools, never the process table. Hiding outside processes from the sandbox removes nothing they use. The owner raised this concern and accepted it (2026-11-14). Recorded in the action-approval specification's sandbox bullet and CHG-0277.
- The sandbox's own children stay readable, so OpenCode can still look at what it started. A local port still shows as listening; without a token it grants nothing.
- Pushing to `main` was the owner's explicit request in this session.

## Next

1. Run the token probe under Claude Code's and Codex's sandboxes. Either the owner adds a permission rule that lets the agent run `@anthropic-ai/sandbox-runtime` (its `srt` command, with a settings file allowing writes to a temp folder), or a Claude Code thread inside Iskios runs `documentation/verification/2026-11-14-token-isolation/scripts/procargs.py` against a stand-in. Record the result in the verification file's successor.
2. Ask the owner about the backlog candidate "Threads see what the other threads are doing": which threads a thread may see, how much of each step, and whether it is a tool or something given at the start of each turn.
3. The rest of the superseded handoff's Next: SA-15, SA-16, section 7 decisions of the audit, the missing Skill tool, and the owner's window check of the earlier fixes.

## Open questions

- Will the owner allow running the sandbox-runtime package for the Claude Code check, or prefer a real thread? Only the owner can answer.
- Does Linux's bubblewrap setup hide outside processes as expected? A run on Linux would settle it.
- For the "threads see each other" candidate: the scope and the format of what a thread sees. Only the owner can answer.

## Sources

- `documentation/verification/2026-11-14-token-isolation.md` and its `scripts/` folder
- `documentation/changelog/0.1.3-Prototype.md` (CHG-0277)
- `documentation/security-audit/security-audit-2026-11-14-0233.md` (SA-11 and SA-13 dispositions)
- `documentation/capabilities/action-approval/specifications.md` (Sandbox-first autonomy bullet)
- `documentation/work-in-progress.md` (Sandbox token isolation entry); `documentation/backlog.md` (token isolation and "Threads see what the other threads are doing")
- `packages/service/src/harness/openCodeSandbox.ts`; `packages/service/test/harness/openCodeSandbox.test.ts`
