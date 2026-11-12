# Handoff: device pairing (control one Iskios from another)

Supersedes: none
Workspace: Iskios repository (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`; nothing in this work is committed.

To resume: read this whole file first, then `documentation/work-in-progress.md` (Device pairing) and the capability's [specifications](../../documentation/capabilities/device-pairing/specifications.md) and [draft](../../documentation/capabilities/device-pairing/draft.md). Treat every claim in State not marked verified as unverified and check it against the Sources.

## Goal

The owner wants to control one Iskios from another instance, from any internet connection, with no account for users and no cost to them or the owner; a phone follows later. Done means: batches 3 to 5 of CHG-0203 built and checked (folder picker and terminal on a host, the direct WebRTC path, the relay deployed to the owner's account and its real use measured), and the owner has reviewed the screens of batch 2.

## State

Verified now (run on 2026-11-12): `bun run typecheck` exits 0 in all six workspaces; Biome is clean on `apps` and `packages`; the full suite passed 98 files and 1,140 tests (14 skipped); channel 80 tests, relay 74, service remote 8, app 303 (4 skipped). Two real Electron windows on the fake harness and a local relay were driven through pairing, switching hosts, the host's quest shown on the controller, Disconnect and the refusal banner ([evidence 2](../../documentation/verification/2026-11-12-device-pairing-batch-2.md)).

Built (CHG-0201 to CHG-0205):
- `packages/channel` (`@iskios/channel`): Noise NK ported from Paseo (Apache 2.0, `NOTICE`), fragmentation, pairing code (`iskios1-…`, checksum), hello protocol, tokens; isomorphic.
- `packages/relay` (`@iskios/relay`): `RoomCore`, a Node relay for tests, the Cloudflare Worker with a SQLite-backed Durable Object and hibernating WebSockets (`wrangler.jsonc`), and `src/client.ts` (host and client connections), written by the assistant outside the subagent's brief.
- Contracts `packages/contracts/src/remote.ts` and nine requests; migration `0043_device_pairing`; in the service `core/sessions.ts`, `serviceTag.ts`, `remote/` (access, config, controller, frames, hostRuntime, state), the loopback bridge `/host/<id>` in `server.ts`, `ISKIOS_RELAY_ORIGIN` in `main.ts`.
- App: `foundation/hosts.ts`, `hostContext.tsx`, `client.ts` (second connection, backoff, failure), `shell/hostMenu.tsx`, `addHostModal.tsx`, `settings/remoteAccessCard.tsx`, `remoteAccess.ts`, `App.tsx`.
- The lab evidence for the design decisions: [relay and direct-path lab](../../documentation/verification/2026-11-12-relay-and-direct-path-lab.md); decision record `0016`.

Not done, unverified or open:
- The relay is not deployed. The default address `https://iskios-relay.dyrits.workers.dev` names a Worker that does not exist; until batch 5 Charter shows Unreachable, or a relay is run locally and `ISKIOS_RELAY_ORIGIN` points at it. The Worker has run only on local workerd (one script of the relay agent's 26 checks, and the assistant's handshake check); relay-initiated close codes were not seen by Node clients under local `wrangler dev` (a local quirk).
- Free-plan use of a real session is not measured (Cloudflare's Durable Object analytics were not published when the lab Workers were deleted). Limits read from Cloudflare's pages: 100,000 requests and 13,000 GB-s a day; an incoming WebSocket message is 1/20 of a request.
- Rooms are not rate-limited; the relay's sockets have no backpressure handling; the host's secret key and the controller's device tokens sit in plain text in the SQLite file.
- Not seen: two physical computers, a phone, dark mode, the Gild theme, a narrow window, the Copy button.
- A subagent wrote the channel and the relay; both were re-run and reviewed by the assistant, but only the channel's Noise core is a port of Paseo code.
- The owner's other Cloudflare Workers share the free limits; the account's plan could not be read (API 403).

## Decisions

- One shared relay on the owner's free Cloudflare account on `workers.dev`, no account for users (0016, CHG-0201); Void's hosting rejected (its documentation needs a Cloudflare sign-in).
- Batches (CHG-0203): 1 channel, relay, service; 2 screens; 3 folder picker and terminal on a host; 4 direct path; 5 deployment and measurement. Direct path as a later batch because the lab found it works over IPv6 and across one carrier NAT and failed on another Wi-Fi.
- A paired device proves itself with a device token (kept as a hash on the host); the first host to claim a room keeps it; the controller's own service bridges the app to a host (the app holds no keys).
- A host that no longer knows an installation refuses it for good (close code 4002); an unreachable one is retried with backoff to 30 s.

## Next

1. Ask the owner to review the screens of batch 2 and to answer the draft's open points (terminal staging, the offline host, host menu details).
2. Batch 3: the folder picker that runs on the host (search field with ranked typed paths, suggestions from folders quests used, step-in browsing with `ListWorkspaceEntries`, New folder; Paseo's type-to-search is the reference) and the terminal on a host (amend ADR 0012); until then a selected host refuses the system dialog and `!` stays text.
3. Batch 4: the direct WebRTC path through the relay's introductions (the lab's `host.mjs` and test page in the assistant's workspace, `relay-lab/webrtc`, show a working shape; `werift` is MIT).
4. Batch 5: with the owner's go-ahead deploy `packages/relay` to their account (`wrangler deploy`), then measure active-object hours over a real multi-hour session before any release.
5. Append outcomes to the changelog and write a new handoff.

## Open questions

- Whether the owner is happy with the look of the host menu, the Add a host dialog, the Charter card and the banner wording.
- Whether to keep the shared relay once measured (alternatives written up in the lab record: the paid plan, a small VPS, the direct path).

## Sources

- `documentation/capabilities/device-pairing/specifications.md`, `draft.md`; `documentation/architecture-decision-record/0016-shared-relay-on-the-owners-free-cloudflare-account.md`
- `documentation/changelog.md` (CHG-0201 to CHG-0205); `documentation/work-in-progress.md`
- `documentation/verification/2026-11-12-relay-and-direct-path-lab.md`, `…-device-pairing-batch-1.md`, `…-device-pairing-batch-2.md`
- `packages/service/test/remote/devicePairing.test.ts`; `packages/channel/test/`; `packages/relay/test/`; `apps/app/test/foundation/hosts.test.ts`
