# Proof: device pairing (control one Iskios from another through a shared relay)

- **Verdict:** not proven overall: every behavior claim of the service, channel and relay is proven (C1 to C9, C11 to C13); the screens' behavior is observed but not shown able to fail and not reproduced (C10a), their look awaits the owner (C10b), and the guard on desktop-only functions has no check (C14).
- **Work:** working tree on `4987773` (uncommitted until the commit that adds this file), batches 1 and 2 of CHG-0203.
- **Agreement:** [device-pairing specifications](../capabilities/device-pairing/specifications.md), [0016](../architecture-decision-record/0016-shared-relay-on-the-owners-free-cloudflare-account.md), CHG-0201 to CHG-0203, [requirements](../requirements.md); earlier evidence in the [relay and direct-path lab](2026-11-12-relay-and-direct-path-lab.md), [batch 1](2026-11-12-device-pairing-batch-1.md) and [batch 2](2026-11-12-device-pairing-batch-2.md).
- **Environment:** macOS (Darwin 25.6.0, arm64); Node 26.12.1; Bun 1.4.3; Electron 45.2.3; vitest 5.1.0; the Worker on local workerd 1.20261110.1 through wrangler 4.160.1; no network service other than loopback.
- **Date:** 2026-11-12

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | A pairing code works once. | specifications, Behavior (2nd bullet) | proven |
| C2 | A pairing code expires ten minutes after it is shown. | same | proven |
| C3 | A mistyped or truncated code is refused with a clear reason. | specifications; glossary (pairing code) | proven |
| C4 | The relay never sees anything readable: no quest title, name, request or answer tag, pairing secret or device token. | requirements, End-to-end encrypted traffic; specifications, Behavior (2nd bullet) | proven |
| C5 | A paired device steers the host as the owner does and sees its changes. | specifications, Behavior (full authority) | proven |
| C6 | A paired device is refused what only the host may do (codes, the switch, disconnecting, listing hosts). | specifications, Behavior (full authority) | proven |
| C7 | Disconnect ends the device's connection at once and forgets it; the host then refuses it for good. | specifications, Behavior (list and Disconnect) | proven |
| C8 | Switching "Allow paired devices" off ends every connection, keeps the pairings, and switching on resumes without a new code. | specifications, Behavior (3rd bullet) | proven |
| C9 | The host has a name, defaulting to the computer's first name part, which can be changed from the host or a paired device. | specifications, Behavior (host name); glossary | proven |
| C10a | The app's host menu switches the window to the paired host's data; Add a host pairs; Charter's card shows the switch, status, code and devices; a banner shows a dead link. | specifications, Behavior (menu, Charter) | unproven (observed live once on this Mac, not shown able to fail, not reproduced) |
| C10b | The look and wording of the host menu, the dialog, the card and the banner. | CHG-0205 (awaiting the owner) | awaiting human judgment |
| C11 | The relay keeps one host and its clients apart per room: the first host's claim keeps the room, a client without a host is turned away, frames are isolated per client. | ADR 0016; CHG-0203 (room claim) | proven |
| C12 | A tampered, replayed or reordered record closes the secure channel. | requirements, End-to-end encrypted traffic | proven |
| C13 | An unreachable host is retried with growing delays; a host that refuses this installation ends the retries. | specifications, Behavior (unreachable host) | proven (unit level) |
| C14 | While a host is shown, `!` stays ordinary text and the system folder dialog is refused, never aimed at the controlling computer. | specifications, Behavior (desktop-only functions) | unproven (no check observes it) |

## Evidence

### C1 to C3, C5 to C9: two whole services and a real local relay

- **Check:** `node_modules/.bin/vitest run packages/service/test/remote packages/channel/test/pairingCode.test.ts`. The scenarios in `packages/service/test/remote/devicePairing.test.ts` use two services on separate databases, a Node relay and real sockets: a code is accepted once and a second use fails with "already used"; a code whose expiry is moved into the past fails with "expired"; a code with its last characters changed fails with "not valid"; the controller starts a quest on the host and receives `Changed`; `RenameHost` shows on the host; Disconnect closes the bridge with code 4001, empties the host's list, and a new link is closed with 4002 and "no longer knows"; switching off closes the bridge, shows Off, keeps the device, and switching on resumes through the same pairing.
- **Shown able to fail:** mutations in a separate worktree (`documentation/verification/2026-11-12-device-pairing-proof/mutations.py`): C1 `used_at` never set and the used check removed, C2 expiry check removed, C3 the checksum comparison removed, C6 the host-only check disabled, C7a the delete replaced by a select, C7b the close of the device's connection removed, C8a both closes of the connections removed, C8b a delete of all devices added to switching off, C9a the rename's update removed, C9b the name's suffix cut removed: each turned the named test red and only it (or its pair in the channel's tests).
- **Result:** end state 6 tests (of the 8 in the folder, 2 more in `computerName.test.ts`) green; each mutation RED as listed in the table below.
- **Reproduced:** see Reproduction.

### C4: nothing readable reaches the relay

- **Check:** the scenario "sends the relay nothing readable" in the same file replaces the global `WebSocket` with a recording subclass, pairs, starts a quest named "A very private quest title", renames the host "Private Host Name", names the device "Secret Laptop Name", and asserts that none of those strings, `StartMission`, `Success`, the device token read from the controller's database or the pairing secret appears in any of at least 8 recorded binary frames.
- **Shown able to fail:** mutation: the encryption and decryption of the Noise transport (`cipherState.ts`) turned into identity functions (both ends still agree, so everything else keeps working): the scenario went red.
- **Result:** green on the end state.

### C11: the relay's rules, and the Worker on workerd

- **Check:** `node_modules/.bin/vitest run packages/relay/test` (74 tests: the room core with a test double, and `startNodeRelay` with real `ws` clients) and `worker-check.mjs` against the real Worker under `wrangler dev --local` (see Reproduce): the Noise handshake through the Durable Object, a round trip, a 300 KiB message intact.
- **Shown able to fail:** mutation: the claim comparison of the room core returns "no mismatch" always: 6 relay tests red.
- **Result:** green; the worker script printed `client handshake: ok`, `round trip: echo:hello through the Durable Object`, `300 KiB echo length: 307205 (expected 307205)`. The two close-code lines of that script (an intruder host, a client in an empty room) print `null` under local wrangler because Node's WebSocket client does not see a server-initiated close there; the relay agent's raw-socket check of the same Worker saw 1008 and 1013 (not reproduced here).

### C12: the secure channel

- **Check:** `node_modules/.bin/vitest run packages/channel/test` (80 tests: Noise test vectors, round trip, tampered, replayed and reordered records, fragmentation to 32 MiB, timeouts).
- **Shown able to fail:** mutation: the AEAD decryption replaced by a truncation: 25 channel tests red.
- **Result:** green on the end state.

### C13: the link's retries

- **Check:** `node_modules/.bin/vitest run apps/app/test/foundation/hosts.test.ts`.
- **Shown able to fail:** two mutations: `isFinalLinkClose` always false, and `retryDelayOf` always one second: each turned its test red.
- **Result:** green on the end state.

### C10a: the screens (observed, not proven)

- **Check:** two Electron windows from `apps/desktop` on the fake harness, each with its own `ISKIOS_DATA_DIR`, a local relay through `ISKIOS_RELAY_ORIGIN`, driven over CDP with Playwright; screenshots in [2026-11-12-device-pairing-batch-2/](2026-11-12-device-pairing-batch-2/). The controller showed "No quest yet" before pairing and the host's quest after it; the host listed "Test Laptop, Desktop · connected now"; Disconnect produced the banner "The host no longer knows this computer. Pair with it again."
- **Shown able to fail:** only by contrast inside the run (the controller's own data was empty before the switch); no mutation of the app was run, and the scripts were not kept.
- **Result:** observed once; not reproduced by a second party.

### C14: desktop-only functions while a host is shown

- **Check:** none. `chooseFolder(true)` rejects and `useTerminal` returns no `onBang` while a host is shown, by reading the code.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Typecheck | `bun run typecheck` | pass (4 workspaces) | pass (6 workspaces) |
| Lint and format | `node_modules/.bin/biome check .` | pass (426 files) | pass (482 files, in a clean worktree) |
| Tests | `node_modules/.bin/vitest run` | 86 files passed, 1 skipped; 970 tests passed, 14 skipped | 98 files passed, 1 skipped; 1,140 tests passed, 14 skipped |
| Build | `bun run build` in `apps/desktop` | not run | pass (the desktop bundle built and ran in the two windows) |

The +170 tests are the channel's 80, the relay's 74, the service's 8 and the app's 8. A whole-checkout `biome check .` also reports `.agents/skills/security-audit/report-schema.json`, an untracked folder of another agent that is not part of this work.

## Not proven

- **C10a:** the screens' behavior was observed once and the scripts were not kept; to prove it, keep the Playwright scripts, mutate the app in a worktree (for example `hostEndpointOf` returning the local path) and see the controller's window fail to show the host's quest, then reproduce from a clean checkout.
- **C10b:** the owner has not seen the screens yet; dark mode, the Gild theme and a narrow window were not looked at.
- **C14:** to prove it, a check that renders `RealmChooser` under a host (a live check, or a test of `chooseFolder` and `useTerminal` once they can be imported without the whole component tree).
- Also outside every claim: the Worker on Cloudflare's network, free-plan use of a real session, two physical computers or a phone.

## Reproduce

```sh
git worktree add --detach /tmp/dp-end HEAD && cd /tmp/dp-end   # then apply the working tree's changes (or use a checkout of the commit that adds this file)
bun install
bun run typecheck
node_modules/.bin/biome check .
node_modules/.bin/vitest run                                      # 98 files, 1,140 tests, 14 skipped
node_modules/.bin/vitest run packages/channel packages/relay packages/service/test/remote apps/app/test/foundation apps/app/test/settings   # 265 tests, 4 skipped
git worktree add --detach /tmp/dp-mut HEAD                        # a second copy of the end state, then bun install there
python3 documentation/verification/2026-11-12-device-pairing-proof/mutations.py /tmp/dp-mut   # every line must start with RED
# the Worker: from the repository root, in the background:
#   bunx wrangler@4.160.1 dev --config packages/relay/wrangler.jsonc --port 8792 --ip 127.0.0.1 --local
# then: bunx esbuild documentation/verification/2026-11-12-device-pairing-proof/worker-check.mjs --bundle --platform=node --format=esm --outfile=/tmp/worker-check.bundle.mjs
#       node /tmp/worker-check.bundle.mjs http://127.0.0.1:8792     # stop wrangler afterwards (pkill -f "wrangler dev")
```

## New files

`documentation/verification/2026-11-12-device-pairing-proof.md`, `documentation/verification/2026-11-12-device-pairing-proof/mutations.py` and `worker-check.mjs`; the tests of batches 1 and 2 are part of the work itself.
