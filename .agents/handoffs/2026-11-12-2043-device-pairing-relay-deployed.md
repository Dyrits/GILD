# Handoff: device pairing, relay deployed

Supersedes: `2026-11-12-0940-device-pairing.md`
Workspace: Iskios repository (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`; the closing-frame change, its documentation and this handoff are committed together.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants to control one Iskios from another instance, from any internet connection, with no account for users and no cost to them or the owner; a phone follows later. Done means: the folder picker and terminal on a host, the direct WebRTC path and a measurement of the relay's real use are built and checked (batches 3 to 5 of CHG-0203), and the owner has pairing working from the app and has reviewed the screens of batch 2.

## State

The superseded handoff records what batches 1 and 2 built and where it lives; it is committed on `main` (reviewed and pushed as `ef103f9`). This session added:
- **The relay is deployed** to the owner's Cloudflare account as `iskios-relay` on `workers.dev` (`https://iskios-relay.dyrits.workers.dev`), from `packages/relay` with `wrangler deploy` (the logged-in wrangler in the assistant's `relay-lab` workspace was used; the repository has no wrangler dependency). Verified: the address answers with the Worker's own 404 for a plain request; 8 devices in one room each received only their own frames; a ninth was closed "room full"; a host with another claim was closed "claim mismatch" and the first host stayed; a 1.1 MiB frame was closed 1009 and 900 KiB was accepted; 25 parallel rooms carried 500 of 500 messages, median 41 ms, 95th percentile 57 ms.
- **Closing frame (CHG-0209).** Node's built-in WebSocket reports a relay's close about ten seconds late, where the `ws` library reports it in 16 ms (checked live on the edge). The relay now sends `{"closing":{"code","reason"}}` as a text frame just before every close it decides, and the host and device clients in `packages/relay/src/client.ts` act on it at once (`closeWithReason`, `closingFrame`, `readClosingFrame` in `roomCore.ts`; used by the core, the Worker and the Node relay). Verified: 17 new tests, four deliberate breaks each turned tests red; against the redeployed Worker a device with no host is told in 0.37 s (10.4 s before).
- **Live end-to-end run:** the 14 tests of `packages/service/test/remote/devicePairing.test.ts` were run against the deployed relay from a scratch copy in `/tmp` (the `startNodeRelay` acquisition removed, `relayOrigin` set to the public address, `node_modules` rebuilt from symlinks to the root and `packages/service` ones); 13 pass, and the 14th ("does not accept a code that names a relay on this computer…") cannot apply to a public relay. The scratch copy was deleted.
- Verified on the tree to be committed (2026-11-12, machine load about 2 to 4): `bun run typecheck` exits 0 in all six workspaces; Biome is clean on `apps`, `packages` and `documentation` (486 files); `vitest run packages` gave 912 passed, 10 skipped, and one timeout (`packages/service/test/lore/loreOverTime.test.ts`, 20 s, under load) which passes alone (15 of 15). The app's own suite was not run: no app file changed in this step.

Not verified or open:
- **A real pairing between two apps through the deployed relay has not been seen.** The owner had the "Could not reach the relay" error because the relay was not deployed; it should now work, and the owner was asked to retry with a fresh code. The first outcome is unknown.
- The dialog's wording "Could not reach the relay. Check your internet connection." is misleading when the relay does not exist or is down; not changed.
- Free-plan use of a real session is not measured. Not seen: two physical computers, a phone, dark mode, the Gild theme, a narrow window, the Copy button.
- Rooms are not rate-limited; the host's secret key and the devices' tokens sit in plain text in the SQLite file; the relay's sockets have no backpressure handling.
- Direct WebRTC lab results (in the lab record): direct worked on 5G over IPv6 (twice) and across IPv4 NAT (once), failed on one other Wi-Fi and once from a private Firefox tab; too few runs for a rate.

## Decisions

- Pairing lasts: a paired device stays paired until the host disconnects it; the host's identity and the "Allow paired devices" switch persist, and a device resumes with its token at each launch (specifications; read in the code, not yet seen across a real app restart).
- The relay tells clients why it closes in a frame, not only in the close; the reason frame is plain and carries only the code and a short reason, and clients treat it as a hint, not proof (CHG-0209).
- Redeploying `iskios-relay` with a backwards-compatible change was done under the owner's earlier approval to deploy it; any other deployment or new Worker needs the owner's go-ahead.
- Earlier decisions stand (shared relay on the owner's free account, device token, room claim, batches in CHG-0203; see the superseded handoff).

## Next

1. Ask the owner whether pairing between two apps through the deployed relay now works; if not, read the Worker's logs and the dialog's error and find the cause.
2. Ask the owner to review the screens of batch 2 and to answer the draft's open points (terminal staging, the offline host, host menu details).
3. Fix the misleading relay error wording, and decide whether the host should send its own reason on a clean stop ("pairing switched off") through the relay's frame, with the screen text to match.
4. Batch 3: the folder picker that runs on the host and the terminal on a host (amend ADR 0012); until then a selected host refuses the system dialog and `!` stays text.
5. Batch 4: the direct WebRTC path through the relay's introductions (the lab's `host.mjs` and test page in the assistant's workspace, `relay-lab/webrtc`).
6. Measure active-object hours of the deployed relay over a real multi-hour session before any release.

## Open questions

- Whether the owner wants the "sync key" idea recorded in the backlog and the draft: one secret that lets every device holding it pair with the owner's hosts automatically (relay stays account-free; a leaked key would give full authority, so it needs rotation and per-device revoke; an optional sign-in account is the other route). It was proposed in chat and not written down.
- Whether to keep the shared relay once measured (alternatives in the lab record).
- Whether the owner is happy with the host menu, the Add a host dialog, the Charter card and the banner wording.

## Sources

- `documentation/changelog.md` (CHG-0201 to CHG-0209); `documentation/work-in-progress.md`
- `documentation/capabilities/device-pairing/specifications.md`, `draft.md`; `documentation/architecture-decision-record/0016-shared-relay-on-the-owners-free-cloudflare-account.md`
- `documentation/verification/2026-11-12-relay-and-direct-path-lab.md`, `…-device-pairing-proof.md`, `…-device-pairing-review.md`
- `packages/relay/src/` (`roomCore.ts`, `client.ts`, `worker.ts`, `nodeRelay.ts`), `packages/relay/test/` (`client.test.ts`, `roomCore.test.ts`, `nodeRelay.test.ts`), `packages/relay/wrangler.jsonc`
- `packages/service/test/remote/devicePairing.test.ts`
