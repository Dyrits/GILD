# Device pairing: completed review and verification

2026-11-12. Baseline `49877734dc18ed326ec7c558c470122f168441ab`; batches 1 and 2 of CHG-0203. This record follows the [initial proof](2026-11-12-device-pairing-proof.md), preserving its limitations. It records checks run after the interrupted review resumed. The implementation is committed with this record; subsequent OpenCode limits changes on origin/main are integrated separately.

## Standards

| Finding | Disposition | Evidence |
| --- | --- | --- |
| S1: pairing errors collapse into relay unreachable | Resolved | Controller returns a typed outcome from its promise; offline-host regression checks the public AddHost result. |
| S2: active relay socket survives shutdown | Resolved | Finalizer closes current connection; a connection finishing after shutdown is closed before serving. |
| S3: background promise rejection loses supervision | Resolved for runtime behavior; logging exception retained | Promise chains have handlers; reconnect iterations close resources and retry after unexpected failures. Background diagnostics remain at the remote runtime boundary rather than being moved to main. Recovery after an injected database failure was not independently exercised. |
| S4: unchecked storage assertions | Resolved | Missing identity handled explicitly; storage results construct branded IDs and typed records. |
| S5: status switch violates conventions | Resolved | Exhaustive Record lookup replaces switch. |
| S6: mixed module responsibilities | Resolved | Host storage, saved hosts, session authentication, carrier and actions are split; useHostConnection owns app connection lifecycle. |

Both reviewers inspected the frozen initial snapshot in `/private/tmp/dp-wt`, then the final implementation. Standards retained one explicit exception: background diagnostic logging below main. No runtime finding remains open.

## Specifications

| Finding | Disposition | Evidence |
| --- | --- | --- |
| P1: authentication racing disable/disconnect | Addressed; complete race proof remains limited | Redemption checks enabled inside its transaction. Registration checks device validity and then current enabled state and channel closure. Concurrent hello messages close the channel. New service regression refuses a previously received secret after access goes off. Deterministic interleaving of every authentication boundary has not been exercised. |
| P2: paired device cannot rename host in UI | Addressed by inspection | HostNameEditor uses shared ReadHostName/RenameHost requests on local and paired-host cards. Service rename scenario passes; final editor has not been driven in a running UI. |

The Specifications reviewer found no remaining actionable gaps within batches 1 and 2. Folder selection, remote terminal, direct WebRTC and deployed-relay measurements remain later batches.

## Checks run on the final working tree

- `node_modules/.bin/vitest run`: 101 files passed, 1 skipped; 1,155 tests passed, 14 skipped (16 seconds). Machine load sampled nearby: 3.35, 2.26, 1.87.
- `bun run typecheck`: all six workspaces pass after repairing dependency links disturbed by the reproduction setup and correcting the new test's SQL dependency provisioning.
- `node_modules/.bin/biome check apps packages`: 452 files pass.
- `bun run build` in `apps/desktop`: main, preload and service bundles built successfully.

## Reproduction and claim verdicts

A fresh-context reviewer reproduced the final snapshot independently: full suite 1,155 passed and 14 skipped across 101 passing files; all six typechecks, Biome (510 files in its clean snapshot) and desktop build passed. Fifteen original mutation scenarios plus the new disabled-secret guard produced targeted test failures (16 deliberate breaks). Two initial invalid mutation attempts were corrected and rerun; their import errors/skips were not counted. C5 steering was observed and reproduced, but the rename mutation only breaks another assertion in that scenario; the steering assertion has no isolated able-to-fail evidence. The local Worker again completed its Noise handshake, echo and 300 KiB echo. Worker-initiated close codes remained null in Node under local Wrangler, so edge close behavior is still unproven.

Claim counts: 11 proven at the service/package boundary (C1–C4, C6–C9, C11–C13), 3 unproven (C5, C10a, C14), 1 awaiting human judgment (C10b). Overall verdict: **not proven in full** because of the UI and desktop-guard gaps. The final race hardening and reconnect exception recovery are reviewed and partly regression-tested, with the interleaving/injected-failure limits above. The claim definitions and original mutation evidence remain in the initial proof. Reproduction commands for a clean checkout of the feature commit:

```sh
bun install --frozen-lockfile
bun run typecheck
node_modules/.bin/biome check apps packages
node_modules/.bin/vitest run
(cd apps/desktop && bun run build)
```

Run mutation checks only in a separate disposable copy with its own dependencies:

```sh
python3 documentation/verification/2026-11-12-device-pairing-proof/mutations.py /absolute/path/to/disposable-copy
```

C10a (screen interactions) and C14 (desktop-only guards) remain unproven; C10b (appearance) awaits human judgment. Existing screenshots record the original live check, not a fresh check of this refactor. Desktop control is unavailable in this side thread. No deployment or physical-device test was performed in this review. The relay default still points at a Worker awaiting deployment.

## Cleanup and scope

Production scope excludes `skills-lock.json` and `.agents/skills/security-audit`, which are unrelated work. Temporary logs, review snapshots and scripts reside under `/private/tmp`; desktop build wrote ignored `apps/desktop/dist` output. Dependency repair ran frozen install and the normal prepare hook. No external relay was created by this review.
