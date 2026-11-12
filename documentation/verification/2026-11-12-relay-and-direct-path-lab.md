# Relay and direct-path lab, 2026-11-12

Claim: a Cloudflare Worker with one Durable Object per room can relay a host's and a paired device's frames from any internet connection ([0016](../architecture-decision-record/0016-shared-relay-on-the-owners-free-cloudflare-account.md)); a direct WebRTC channel negotiated through it can carry the stream instead, with the relay as fallback; Cloudflare quick tunnels cannot be the default path (CHG-0201, CHG-0203).
Not checked: the Durable Object usage that the lab produced (Cloudflare's analytics were not yet published when the Workers were deleted); any network other than the four listed under Direct path; many network pairs, so no success rate; Safari and Chrome on a phone (Firefox on Android only); the shared relay under concurrent users.

The lab was a throwaway project outside the repository (`relay-lab` in the assistant's workspace: a Worker, a Node host, a test page, probes). Nothing in Iskios was changed by it. Its Workers (`relay-lab`, `relay-lab-p2p`) were deployed to the owner's Cloudflare account on `workers.dev` for the tests and deleted afterwards; the account's other Workers were untouched and no Durable Object namespace remained.

## Relay (option 1)

- A Worker routes `/r/<room>?role=host|client` to a SQLite-backed Durable Object that accepts hibernating WebSockets and forwards each frame to the other role, reading and queuing nothing; a frame with no peer connected is dropped.
- Run locally with `wrangler dev` (workerd on this Mac) and deployed: host and client connected in about 0.4 s; a 200-byte round trip through the deployed relay took about 35 ms from this Mac; a 256 KiB frame about 98 ms; a connection survived 150 idle seconds; a frame with no host connected was dropped (room status afterwards: no host, no client).
- Cloudflare's free-plan limits (Durable Objects pricing page, read 2026-11-12): 100,000 requests and 13,000 GB-s of duration a day; an incoming WebSocket message counts as 1/20 of a request, an outgoing one is free; duration is billed at 128 MB while an object is active and cannot hibernate (it hibernates after 10 idle seconds). About 2 million incoming messages a day or about 28 active room-hours a day across all users; the duration limit binds first under steady streaming. The paid plan ($5 a month) includes about the same monthly (1 million requests, 400,000 GB-s) and then bills $0.15 per million requests and $12.50 per million GB-s (about $0.006 per active room-hour). Not measured with real use.
- The owner's account holds two other Workers; the free limits are the account's, so they are shared with them. The account's plan could not be read through the API (403).

## Quick tunnels (option 5)

- `cloudflared tunnel --url` needs no account and no domain; WebSockets work (about 29 ms round trip, a connection survived 90 idle seconds).
- The address is new at every start; after a restart the old one answered 530. Cloudflare documents quick tunnels as "for testing and development", with no uptime guarantee and at most 200 requests in flight ([Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)). A pairing made with such an address would break at every restart of the host, so it is not a default path.

## Direct path (WebRTC, public STUN, no TURN)

Method: the host (Node, MIT `werift` 0.27) and a browser page connect through the relay (offer and answer exchanged as relay frames), try a direct data channel with `stun.cloudflare.com` and `stun.l.google.com`, then measure: 20 pings on the direct channel and on the relay, and a stream of 400 frames of 200 bytes at 20 a second, counting the frames the relay carried meanwhile.

| Network pair | Result |
|---|---|
| Node peer and Node peer, one Mac | direct in 0.2 to 0.4 s; 400 of 400 frames; 0 through the relay (no NAT crossed) |
| Phone on 5G (Firefox, Android), IPv6 on both ends, run twice | direct in 0.8 s; 400 of 400; 0 through the relay; direct median 60 to 72 ms, through the relay 95 to 110 ms; one stall of about 1 s each time |
| Phone on 5G, host limited to IPv4 (the path crossed the carrier's NAT and the home router's NAT) | direct in 0.95 s; 400 of 400; 0 through the relay; direct median 75 ms against 105 ms; one stall of about 1 s |
| Phone on another Wi-Fi, host limited to IPv4 | failed: ICE stayed in "checking" for 25 s and then "failed"; the phone saw two different public IPv4 addresses for its two STUN servers, a mapping that usually blocks direct paths |
| Phone on 5G, first attempt, private Firefox tab | failed after 25 s, cause not found |

- This Mac's own network maps one public port for three STUN servers (an endpoint-independent mapping, which hole punching needs from at least one side).
- Three direct successes and two failures over three network setups: enough to show the idea works and that the relay must stay the fallback, far too few for a rate. The largest published measurement found, 4.4 million attempts across 85,000 networks on the IPFS network, reports about 70 percent hole-punching success ([arXiv 2510.27500](https://arxiv.org/html/2510.27500v1)).
- The test page's NAT verdict line was wrong (its pattern matched `udp` in lowercase, Firefox writes `UDP`); the candidate counts it printed were right. Direct paths carry the traffic of a session, and the relay then carries only the introductions.

## Two teammates' reviews (2026-11-12, not run by them)

- Kikan: a small VPS relay costs about €4 to 6 a month and one node would hold thousands of users, but means running it (patching, certificates, monitoring, abuse); on cost it wins over Cloudflare's paid plan only after about 1,000 active room-hours a month. Prices were not checked.
- Jiyū: keep the Durable Object relay and add a direct path without TURN so that the relay carries only the introductions and the unlucky minority; before release measure active-object hours over a real multi-hour session. iroh, libp2p and Cloudflare's TURN service were not taken (iroh's public relays are for development and hobby use; libp2p has no public relays; TURN alone is paid per gigabyte, unchecked).
