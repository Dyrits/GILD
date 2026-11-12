---
status: accepted
---

# A shared relay on the owner's free Cloudflare account carries paired-device traffic

Paired devices (the phone web app and other Iskios instances) reach a host through the relay Worker of [0003](0003-per-user-relay-carrying-all-traffic.md), but one Worker, deployed by the owner to the owner's own free Cloudflare account on `workers.dev`, serves every installation. A user needs no Cloudflare account, no sign-up, and nothing to deploy; adding a device is only a pairing code. This replaces 0003's "each user deploys it to their own free Cloudflare account" and its rejection of a shared relay (CHG-0201).

The cost to the project and to users stays nil by construction: on Cloudflare's Workers Free plan an operation over a free limit fails instead of being billed, and Durable Objects with SQLite storage are available on that plan. Traffic stays end-to-end encrypted as in 0003, so the shared relay holds only each pairing's connection state and cannot read a message.

Consequences:

- All installations share the free plan's daily limits (Workers Free: 100,000 requests a day, 10 ms of CPU per invocation, resetting at 00:00 UTC; Durable Objects on the free plan: 100,000 requests and 13,000 GB-s of duration a day, an incoming WebSocket message counting as 1/20 of a request and an outgoing one nothing, so about 2 million messages or about 28 active room-hours a day, the duration limit binding first; real use is not yet measured and must be before the first release, see the [lab](../verification/2026-11-12-relay-and-direct-path-lab.md)). When a limit is reached, paired-device access fails for everyone until the reset; a host's own use is not affected.
- The owner's account is a single point of failure and the owner answers for what it relays; creating a room needs a one-time pairing secret and a rate limit, so the relay cannot be used as free storage or a free proxy.
- The relay's URL is part of every pairing code, so a later change of address or account needs a new pairing, unless an installation can be told the new address.
- The channel between a host and a paired device is built independent of its carrier (Noise NK over any message carrier), so a direct WebRTC data channel negotiated through the relay can carry it later and leave the relay with the introductions and the fallback; the lab of 2026-11-12 found this works over IPv6 and across a carrier's NAT, and fails on some networks ([verification](../verification/2026-11-12-relay-and-direct-path-lab.md), CHG-0203).
- A user may deploy the same Worker to their own Cloudflare account with one API token, for their own capacity, and use it in place of the shared relay (CHG-0212, amended 2026-11-12); it is optional and the shared relay stays the default. The token is used once and never kept.

## Considered Options

- **Void's hosting (`void deploy`)**: rejected. Its documentation says a direct deploy signs in to a Cloudflare account, and a hosted platform that needs none is not documented (read 2026-11-12); its WebSocket routes carry JSON messages only, and the relay is a plain Worker with a Durable Object either way.
- **A relay in each user's own account, deployed with the temporary-account claim**: replaced on 2026-11-12 by the optional deployment with an API token above, because the claim needs a sign-up within 60 minutes and gives the app no way to update the relay afterwards, where a token the user makes lets the app deploy and later update it at once.
- **iroh's public relays and hole punching**: rejected for now; n0 describes its public relays as for development and hobby use, with unpublished rate limits, and the library is native code.
- **A direct connection, Tailscale, or WebRTC with a TURN server**: as in 0003.
