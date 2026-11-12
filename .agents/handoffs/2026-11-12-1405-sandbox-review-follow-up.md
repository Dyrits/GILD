# Handoff: CHG-0208 review follow-up (sandbox and structural actions)

Supersedes: none
Workspace: Iskios repository (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`; the review refactors and the Seatbelt signal rule below are committed and pushed in one commit after `a6669de`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Close the findings of the two-reviewer review of commit `a6669de` (CHG-0208, sandbox-first autonomy and structural actions by provenance): the standards findings (S1 to S31) and the specification findings (P1 to P11). Done means every P finding is fixed or answered by the owner, and the refactors left open are applied or declined.

## State

Verified now (2026-11-12, run in this session): `packages/service/test/harness/openCodeSandbox.test.ts` passes, 28 of 28, including two new tests: the Seatbelt profile denies signals except to `same-sandbox`, and a real `sandbox-exec` run cannot kill a process started outside it but can kill its own child. The new tests failed before the rule was written.

Verified earlier in this session, before the Seatbelt change and not re-run after it: typecheck 6 of 6, Biome clean, 1,235 tests passed (14 skipped), on the working tree with the review refactors.

Done and committed:
- Review refactors, behavior-neutral: S1 (imports through `index.ts`), S2, S3, S13 in part, S16, S17, S18, S25 (shared `isExecutorCommand`), S27, S30, and the two slips N1 and N2 the patch itself introduced. N2 was not shown to the reviewer again.
- P1 in part: `seatbeltProfileOf` in `packages/service/src/harness/openCodeSandbox.ts` now has `(deny signal)(allow signal (target same-sandbox))`. Measured on macOS: `(deny signal (target others))` blocks nothing, and `(deny signal)(allow signal (target self))` also stops the sandbox's own children; only `same-sandbox` does both jobs right. Bubblewrap already hides outside processes with `--unshare-pid` (assumed, not run: no Linux host).

Not done, all unverified as fixed:
- P1, rest: launching applications from inside the Seatbelt sandbox (`open`, LaunchServices, `appleevent-send`). A first probe did not tell: `open` with an unknown bundle fails the same with or without a `mach-lookup` deny, and one `open -g -R` run may have opened a Finder window on a temporary folder. Test it with a target that cannot hurt the owner's apps.
- P2 (owner-phrase detector accepts questions without `?` and future tense), P3 (an "exact" saved command still acts as a `*` pattern; old pattern grants stay active), P4 (an ordinary approval can pass a sandbox-exit request), P5 (Codex marks every request as leaving the sandbox, even at "commands and edits"), P6 (OpenCode with no sandbox tool skips the linked-folder check), P7 (`node_modules` and `package.json` not removed from the config copy), P10, P11.
- P8 and P9 wait for owner decisions (see Open questions).
- Standards findings left open for risk or size: S4 to S12, S13 in part, S14, S15, S19 to S24, S26, S28, S29, S31. The heaviest are S6 (synchronous calls outside `Effect.sync`), S7 and S8 (`openCodeSeed.ts` and `processTree.ts` do I/O, throw and log outside Effect), S12 (the `if` chain in `guildmasterProvenance.ts`) and S15 (`rituals.tsx`, 748 lines).
- Not seen in the running app: the Ritual form, the question card without Always allow, the thread lines ("Allowed by message", linked folder, lost session). Not run: bubblewrap on Linux, a model-issued command through a sandboxed OpenCode.
- The changelog and `documentation/work-in-progress.md` do not mention the Seatbelt signal rule.

## Decisions

- Nothing of CHG-0208's design was reopened; the fixes keep its decisions (sandbox first, exact commands, structural actions by owner words).
- The signal rule names `same-sandbox`, for the reason measured above; do not replace it with `(target others)` or `(target self)`.
- OpenBot's open source repository (`nightly-labs/openbot`, read in a clone at `/tmp/openbot-src/repo`, which may be gone) was studied for ideas. Its macOS profile is `(allow default)` then `(deny file-write*)`, so it has the same signal and application-launch gap; it adds no fix for P1.

## Next

1. Close P1 fully: a Seatbelt test that a wrapped process cannot launch an application through LaunchServices, using a harmless target, then the rule.
2. P7 with OpenBot's idea: deny writes to protected paths inside writable folders (config, hooks, trust files) and deny removing or renaming their parent, as a three-pass profile (deny all, allow roots, deny protected again; the last matching rule wins).
3. P4 and P6: for Claude Code, a `PreToolUse` hook that asks for a write outside the writable roots even when a user rule allows it (OpenBot does this); make the linked-folder check run when no sandbox tool exists.
4. P2, P3, P5, P10, P11 in red/green, then the standards findings by weight, S7 and S8 first.
5. Run typecheck, the full test suite and Biome, then add the outcomes to the changelog.

## Open questions

- P8: the OpenCode sign-in copy at each start conflicts with the requirement that no credential is stored; OpenBot writes straight into the real data folder instead. Which risk does the owner accept (single-use refresh tokens, or a real data folder writable from inside)?
- P9: `create_ritual` is checked by title only; the owner decides what else identifies it.

## Sources

- `documentation/changelog.md` (CHG-0208); `documentation/capabilities/action-approval/specifications.md`
- `packages/service/src/harness/openCodeSandbox.ts`, `packages/service/test/harness/openCodeSandbox.test.ts`
- The review material, which may be gone: `/tmp/iskios-review-a6669de/` (`refactor.patch`, `scope.txt`, the reviewers' findings are in the session only and are listed in State)
- OpenBot: `src/backend/process-confinement.ts`, `src/backend/claude-workspace-sandbox.ts`, `src/backend/agent/workspace-sandbox.ts` in `nightly-labs/openbot`
