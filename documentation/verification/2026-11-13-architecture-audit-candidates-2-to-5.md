# Proof: architecture audit 2026-11-12, candidates 2 to 5 (CHG-0217 to CHG-0219)

- **Verdict:** not fully proven: C2 is unproven, C1 and C3 to C6 are proven; no running app was driven (see Not proven)
- **Work:** `22ac07b..` the working tree on top of `099f9ac`, committed as CHG-0219 (candidates 2 and 4 to 5 are `9c75c08` and `099f9ac`)
- **Agreement:** the [2026-11-12 architecture audit](../architecture-audit/architecture-audit-2026-11-12-2245.html); behaviour kept except the realm-question bug of candidate 2
- **Environment:** macOS (Darwin 25.6.0), the project's `test` script (`ELECTRON_RUN_AS_NODE=1`, Electron 45), stand-in harnesses, real `sandbox-exec` for the OpenCode tests
- **Date:** 2026-11-13

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | A realm action `create_realm` or `rename_realm` would refuse is never put to the owner as a question, and the tool says why (candidate 2) | audit candidate 2 | proven |
| C2 | A structural tool that succeeds without spending its receipt is a defect, not a silent change | audit candidate 2 | unproven |
| C3 | Admitting an owner's text (non-blank, image refusal for the named runner) behaves as before, now in `work/admission.ts` (candidate 5) | audit candidate 5 | proven |
| C4 | Host access (switch, relay change, device disconnect, pairing code) behaves as before behind `makeHostControl`, and "off" answers Off at once (candidate 4) | audit candidate 4 | proven |
| C5 | The sandboxed OpenCode launch behaves as before behind `makeOpenCodeLauncher` (candidate 3) | audit candidate 3 | proven |
| C6 | Nothing else regressed | existing suite | proven |

## Evidence

### C1

- **Check:** `guildmaster.test.ts` "asks the owner nothing about a realm action the tool would refuse, and says why" (taken name, taken folder, taken new name, unknown realm).
- **Shown able to fail:** before and after: with `guildmasterProvenance.ts` and `guildmasterRealms.ts` stashed, it failed (`create_realm: expected [ { …(14) } ] to deeply equal []`, a question was asked); passes with them.
- **Result:** 67 passed in `guildmaster.test.ts`.
- **Reproduced:** by the author only, rerun at the end of the session.

### C2

- **Check:** none: no test simulates a tool that forgets `consumeReceipt`. The guard is in `withProvenance`.
- **Shown able to fail:** not shown.
- **Result:** every existing structural tool test still passes, so every tool does spend its receipt on success.

### C3

- **Check:** `attachments.test.ts` (16 tests, including refusal on send, handover, and start or open).
- **Shown able to fail:** mutation in the working tree, restored after: making the refusal in `admission.ts` a no-op failed 3 tests.
- **Result:** 16 passed.
- **Reproduced:** by the author only.

### C4

- **Check:** `packages/service/test/remote` (45 tests); `devicePairing.test.ts` now also asserts the `SetRemoteAccess` answer already shows Off.
- **Shown able to fail:** inverting the relay-address check in `hostControl.ts` failed 3 tests; keeping connections open when access goes off survived the old tests, so the Off assertion was added, and the same mutation then failed `ends every connection when Allow paired devices goes off…`.
- **Result:** 45 passed.
- **Reproduced:** by the author only.

### C5

- **Check:** `harnesses.test.ts` (77 tests, with the macOS Seatbelt ones running).
- **Shown able to fail:** skipping the folder-escape question failed 5 tests; reporting the wrong sandbox state failed 2.
- **Result:** 75 passed, 2 failed only under the mutation; unmutated 77 of 77 (the 10 skips are other files).
- **Reproduced:** by the author only.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Typecheck | `bun run typecheck` | not run | pass (6 of 6) |
| Lint | `npx biome check .` | not run | pass |
| Tests | `ELECTRON_RUN_AS_NODE=1 npx electron node_modules/vitest/vitest.mjs run --maxWorkers=4` | not run | pass, 1325 passed, 14 skipped |

At the default worker count on a computer at load 15 to 22, two full runs had 5 and 8 timeouts in `tracking`, lore, and Codex harness tests that pass alone and with four workers; none imports the changed code. Nothing failed at four workers, so nothing needed comparing with the starting commit.

## Not proven

- C2: the receipt guard has no test of its own. A test would call `withProvenance` with a run that returns success without `authorize`.
- Candidates 2, 4, and 5 are not complete as the audit describes them: one definition per structural action, the runner derived once per request, and the OpenCode helper tests moving into the launch module are not done (see CHG-0217 to CHG-0219).
- No running app, real Codex, Claude Code, relay, or phone was driven; the app's screens were not looked at.

## Reproduce

```sh
bun install --frozen-lockfile
bun run typecheck
npx biome check .
ELECTRON_RUN_AS_NODE=1 npx electron node_modules/vitest/vitest.mjs run --maxWorkers=4
```

## New files

`packages/service/src/work/{realmChecks,admission}.ts`, `packages/service/src/remote/{hostControl,index}.ts`, `packages/service/src/harness/openCodeLaunch.ts`, committed with the work. No new test file; tests added to `guildmaster.test.ts` and `devicePairing.test.ts`.
