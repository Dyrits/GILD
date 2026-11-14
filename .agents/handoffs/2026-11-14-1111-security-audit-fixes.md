# Handoff: Security audit run 2, fixes landed

Supersedes: none
Workspace: ISKIOS repository, branch `main` (checked out at `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Act on the source-only security audit of 2026-11-14 02:33: fix the candidates the owner approved, and leave the rest recorded. Done means the approved fixes are on `main`, verified, and the open candidates and decisions are listed for a later session.

## State

- **Landed (verified now):** commit `eec9779` "Fix the security audit candidates the owner approved (SA-01 to SA-10)" is on `main` and on `origin/main` (`git log`, and the push printed `67ebbc0..eec9779`). It is recorded as CHG-0274 in `documentation/changelog/0.1.3-Prototype.md`.
- **Fixed in it:** SA-01, SA-05 (`create_ritual` always asks), SA-02 to SA-04 (owner-named check), SA-06 (mention `@` dropped from thread-written suggestions), SA-07 (dangling links), SA-08 (paired devices and folder roots), SA-09 (OpenCode multi-file edit), SA-10 (Always allow is literal), SA-12 (`iskios:endpoint` main frame only, links open in the browser), SA-14 (`answer_prompt` refused when unused).
- **Checks (verified, from the pre-commit hook's output):** Biome clean; typecheck passes for the 6 packages; the hook's related tests: 65 files passed, 1 skipped, 846 tests passed, 10 skipped. Earlier, run outside the agent's sandbox, the 9 files that fail inside it (`git init` cannot copy templates, `sandbox-exec` cannot nest) passed: 253 tests passed, 5 skipped, including SA-09's OpenCode test and SA-08's tests.
- **Not done:** SA-11 and SA-13 (depend on the sandbox's process visibility; to check in a real sandbox), SA-15, SA-16, the hardening list in section 7 of the audit, and the audit's own open steps (coverage critic, adversarial verification, `findings.json`; section 9). No window drive of the fixes; the owner has not looked.
- **After the push (this handoff's own commit):** the backlog got two entries and the changelog CHG-0275; they were written with this handoff and committed with it.
- **Environment lesson:** the system disk filled during the pre-commit tests (`ENOSPC` in `/tmp/claude-501`). The commit ran outside the sandbox with `TMPDIR=/Volumes/APFS-G-DRIVE/.tmp-claude`, which works; the folder is not in the repository. Local and not in git: untracked `.expo/`.
- **Skills:** the thread had no Skill tool, so it could not run `/verify`; it read a skill's `SKILL.md` by path and followed it. Recorded in the backlog as an issue to investigate (CHG-0275). Not investigated yet.

## Decisions

- Push to `main` needed the owner's approval and `git push --no-verify` (the pre-push hook refuses `main`); the owner allowed that exact command for this push only.
- Exact migration: only a clue in the backlog. As of 2026-11-14, expo/exact's README says pre-1.0, "changes daily", no API stability, no JSX or React tier, MIT; so it is a separate runtime, not a way to run the current Expo app. Revisit when the product is more advanced and stable (backlog, CHG-0275).

## Next

1. Ask the owner which of the open audit items to take: SA-11 and SA-13 in a real sandbox, SA-15 and SA-16, and the Decision items of section 7 of the audit (outbound data from sandboxed commands, `~/.ssh` and `~/.aws` reads, environment allowlist, settings decode fallback, account folder modes, skill shadowing).
2. Investigate why an Iskios thread has no Skill tool although the Skills list names 65 skills (backlog entry).
3. Have the owner try the fixes in a window (a Ritual request, a paired device's folder reach, an OpenCode multi-file edit) and record the result in a verification file.

## Open questions

- Which section 7 decisions does the owner want to settle, and in what order? Only the owner can answer.
- Is a Skill tool meant to be available to threads, or is reading `SKILL.md` by path the intended way? Check the harness and Iskios's tool list.

## Sources

- `documentation/security-audit/security-audit-2026-11-14-0233.md`
- `documentation/changelog/0.1.3-Prototype.md` (CHG-0274, CHG-0275); `documentation/backlog.md` (the last two entries)
- Commit `eec9779`; `packages/service/src/work/reachedFolders.ts`, `policy/ownerRequests.ts`, `work/threadTools.ts`, `harness/opencode.ts`, `apps/desktop/src/main.ts`
- https://github.com/expo/exact
