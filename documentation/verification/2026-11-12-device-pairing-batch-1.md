# Device pairing, batch 1: channel, relay, service (2026-11-12)

Claim: one installation (the host) accepts paired devices through a relay while "Allow paired devices" is on; another installation (the controller) pairs with it by a text code, keeps it, and steers it through its own loopback socket at `/host/<id>`; everything between them is end-to-end encrypted; a paired device cannot do what only the host may; Disconnect and switching off end connections at once (CHG-0201, CHG-0203).
Not checked: the Worker on Cloudflare's own network (only locally on workerd); a relay-initiated close seen by Node's `WebSocket`/`ws` clients under local `wrangler dev` (they never fire `close`, a local quirk also seen with the lab Worker; the relay's own raw-TCP check saw the codes); two real desktop instances (no app screens yet, batch 2); the free-plan usage of a real session; rate limits on rooms.

## Reproduce

1. `node_modules/.bin/vitest run packages/channel packages/relay packages/service/test/remote packages/service/test/server.test.ts` (80 + 74 + 6 + 3 tests).
2. `bun run typecheck` (all six workspaces) and `node_modules/.bin/biome check .`.
3. The Worker on workerd: from the repository root, `wrangler dev --config packages/relay/wrangler.jsonc --port 8792 --ip 127.0.0.1 --local`, then a script that connects a host and a client with the packages' own client and channel (bundled with esbuild, kept outside the repository).

## Observed

- Channel: Noise NK (ported from Paseo, Apache 2.0, attribution kept in `packages/channel/NOTICE`) with its published test vectors; records sealed with counters, so a replayed, reordered, dropped or tampered record closes the channel; messages up to 32 MiB are fragmented and reassembled; pairing code with checksum; six deliberate breaks of the channel code each turned a test red.
- Relay: one transport-agnostic room core (host claim by first connection and hash, replacement, client ids, caps, size limit, keepalive) run by a Node relay and by a Worker with a SQLite-backed Durable Object and hibernating WebSockets; 74 tests including real `ws` clients; the Worker's own 26 checks under local workerd (hibernation after 15 idle seconds, claim mismatch 1008, replacement 1012 and 1001 to clients, room full, 300 KiB frame, offline host 1013) passed.
- My own run of the Worker under local workerd with the repository's client and channel: handshake succeeded, round trip `echo:hello through the Durable Object`, a 300 KiB message came back intact (307,205 bytes); the close codes of an intruding host and of a client in an empty room were not seen by Node's client (the quirk above).
- Service, two whole services on separate databases and a real local relay (`packages/service/test/remote/devicePairing.test.ts`): pairing with a code, then steering the host (a quest started from the controller exists on the host, `Changed` frames reach the controller, `RenameHost` shows on the host, the device shows as connected with a last-active time); a code works once, an expired and a garbled code are refused; `ReadRemoteAccess`, `CreatePairingCode`, `SetRemoteAccess`, `DisconnectDevice` and `ListHosts` from a paired device answer AccessRefused; Disconnect closes the bridge with 4001, forgets the device, and a new link is refused with "no longer knows this computer"; switching Allow paired devices off closes the bridge, shows Off at once, keeps the pairing, and switching it on again resumes without a new code; every frame the services sent to the relay was recorded and none contained a quest title, a device or host name, a request or answer tag, the stored device token or the pairing secret.
- Three breaks of the service code (host-only refusal removed, code expiry removed, device not closed on disconnect) each turned one test red; the files were restored and the six tests pass.
- Full suite: 95 files passed, 1 skipped; 1,130 tests passed, 14 skipped. `bun run typecheck`: all six workspaces exit 0. Biome: no findings on 491 files.

## Known limits (open)

- The host's secret key and claim secret are in the SQLite file in plain text; the file is the owner's own data folder. The controller keeps each host's device token the same way.
- A room can be created by anyone who can reach the relay, and rooms are not rate-limited; the relay's sockets have no backpressure handling.
- The default relay address (`https://iskios-relay.dyrits.workers.dev`) names a Worker that is not deployed yet (batch 5), so Charter will show Unreachable until it is, or until `ISKIOS_RELAY_ORIGIN` points at a relay run locally.
- Pairing opens a short channel that closes at once; the device then connects again by its token whenever the app opens a link to the host.
