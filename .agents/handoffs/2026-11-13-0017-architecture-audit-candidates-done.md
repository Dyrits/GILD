# Handoff: architecture audit 2026-11-12, all five candidates built in part

Supersedes: `2026-11-12-2357-architecture-audit-containment.md`
Workspace: Iskios repository, branch `main`, starting commit `fbf830b`; the work below is committed with this handoff and pushed to `origin/main` when `git log origin/main` shows the commit named last in State (check it).

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Implement the relevant candidates of the [2026-11-12 architecture audit](../../documentation/architecture-audit/architecture-audit-2026-11-12-2245.html) without changing agreed behaviour beyond the bugs the audit names. Each candidate is built in part and recorded; done means the remaining parts are built or the owner declines them.

## State

- Built, committed, recorded in the [changelog](../../documentation/changelog.md): CHG-0216 candidate 1 (one Containment decision, `policy/containment.ts`; Claude Code, Codex, and OpenCode disagreements fixed), CHG-0217 candidate 2 in part (`work/realmChecks.ts`; a realm action the tool would refuse is no longer asked; `withProvenance` dies when a tool succeeds without spending its receipt), CHG-0218 candidates 5 and 4 in part (`work/admission.ts`; `remote/hostControl.ts` and `remote/index.ts`; `hostActions.ts` deleted), CHG-0219 candidate 3 (`harness/openCodeLaunch.ts`; `opencode.ts` 703 to 619 lines). Commits `22ac07b`, `9c75c08`, `099f9ac`, and the one with this handoff (`a674a7e` plus the handoff commit).
- Verified now, this session: `bun run typecheck` 6 of 6, `npx biome check .` clean, full suite with `--maxWorkers=4`: 1325 passed, 14 skipped. At the default worker count on a loaded computer (load 15 to 22) two full runs had 5 and 8 timeouts in `tracking`, lore, and Codex harness tests that pass alone. Records: [containment proof](../../documentation/verification/2026-11-13-containment.md) and [candidates 2 to 5 proof](../../documentation/verification/2026-11-13-architecture-audit-candidates-2-to-5.md), each with the mutations that made its tests fail.
- Pushed: `22ac07b` was pushed to `origin/main` earlier in the session with `--no-verify` at the owner's request; the later commits are pushed with this handoff (check `git log origin/main`).
- Not verified: the receipt guard in `withProvenance` has no test of its own; no running app, real Codex, Claude Code, relay, or phone was driven; the question card's new wording was not seen.
- The owner's original repository has an untracked `documentation/architecture-audit/architecture-audit-2026-11-12-2245.html` that collides with the committed copy: pull there fails until the owner deletes or moves it.

## Decisions

- Containment lives in `policy/` (it needs the capability names); adapters report facts, one function decides. Recorded in CHG-0216.
- At "Also commands and edits" Claude Code is unprotected, so a standing permission saved at the default level for an ordinary command no longer covers it there. Not asked of the owner; recorded in CHG-0216.
- The owner approved pushing to `main` with `--no-verify` for this work (the pre-push hook refuses `main` otherwise).
- Candidates were built in part, with the rest named in each changelog entry, so each stays reviewable.

## Next

1. Candidate 2, the rest: one definition per structural action (`act_on_mission`, `change_setting`, `create_ritual` still derive and check separately); add a test for the receipt guard.
2. Candidate 5, the rest: derive the message's runner once per request (the refusal's runner and the domain operation's are separate today); `insertUserMessage` pass-through.
3. Candidate 3, the rest: move the pure-helper tests of `openCodeSandbox.ts` next to the launch module, if wanted.
4. Ask the owner about the permission-coverage change and the open decisions of the 2026-11-11 audit (P1, P2, P4 to P7 of that review, S3), and drive the composer and the Dock icon in a window.
5. Investigate the `InterruptThread` failure seen once in a full run if it recurs, and the load-dependent timeouts.

## Open questions

- Owner: is the permission-coverage change at the stricter level acceptable; should the remaining parts of candidates 2, 3, and 5 be built.
- Owner, from the 2026-11-11 audit: P1 (lists capped at 12), P2 (files 8 to 5), P4 (deleted sender), P5 (reply rule), P6 (raw `@quest:` title), P7 (closed chip wording), S3 (failed mention read ignored).
- The sandbox review follow-up in `2026-11-12-1405-sandbox-review-follow-up.md` still has P1 (rest), P2, P3, P7, P10, P11, P8 and P9 open; P5 and P6 there are fixed by CHG-0216.

## Sources

- [architecture audit 2026-11-12](../../documentation/architecture-audit/architecture-audit-2026-11-12-2245.html), [audit 2026-11-11](../../documentation/architecture-audit/architecture-audit-2026-11-11-2256.html)
- [changelog](../../documentation/changelog.md), CHG-0216 to CHG-0219
- [containment proof](../../documentation/verification/2026-11-13-containment.md), [candidates 2 to 5 proof](../../documentation/verification/2026-11-13-architecture-audit-candidates-2-to-5.md)
- `packages/service/src/policy/containment.ts`, `work/{realmChecks,admission,guildmasterProvenance}.ts`, `remote/{hostControl,index}.ts`, `harness/openCodeLaunch.ts`
- [sandbox review follow-up handoff](2026-11-12-1405-sandbox-review-follow-up.md), [superseded handoff](2026-11-12-2357-architecture-audit-containment.md)
