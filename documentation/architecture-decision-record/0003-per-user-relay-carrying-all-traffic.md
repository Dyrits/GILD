# A per-user relay Worker carries all phone traffic

Phones reach the local service through a Cloudflare Worker with one Durable Object per pairing, which forwards end-to-end encrypted messages without reading them. Each user deploys it to their own free Cloudflare account, because the nearly-free requirement forbids the project paying for others' traffic. The design follows Paseo's relay (Apache 2.0, `packages/relay`), using only its Noise NK handshake and none of its older fallback encryption, and adds a one-time pairing secret and a remembered identity for each paired device, since Paseo accepts anyone holding a leaked link.

## Considered Options

- **Connection set-up only, then WebRTC peer-to-peer (OpenBot's approach)**: rejected, because direct paths often fail on mobile networks and need a TURN server carrying the traffic anyway: two services instead of one.
- **A shared relay run by the project (Paseo's approach)**: rejected by the nearly-free requirement.
- **A Cloudflare Tunnel per installation (MausBot's approach)**: rejected, because it needs the maintainers' accounts and domains, and traffic is not end-to-end encrypted.
- **Tailscale**: left as an alternative for users who prefer it, not the default, since it needs the app on both devices.
