---
status: accepted
---

# A browser uses a host through the web app the relay serves

Agreed with the owner on 2026-11-14 (CHG-0282, CHG-0283); not built. Any browser, on a phone or a computer, uses a host through the **web app**: the Expo app's web build ([0009](0009-one-expo-app-everywhere.md)), served by the relay Worker ([0016](0016-shared-relay-on-the-owners-free-cloudflare-account.md)). The browser pairs with a pairing code as a phone was to, and runs the end-to-end encrypted channel itself (`packages/channel` uses no Node-only module); the host keeps listening only on its own computer. This meets [Use from a browser with nothing installed](../requirements.md#access) and [Nothing else to install](../requirements.md#access): no Tailscale, VPN, tunnel, or certificate to set up.

- **Versions**: the relay keeps each release's web app at its own address. The host reports its release when a client connects, the web app loads the build of its host's release, and an app of another release is refused with a message saying why. Before the first stable release there is no compatibility promise ([requirements](../requirements.md#releases)), so an exact match is simplest; Paseo keeps its protocol tolerant with capability flags instead ([research](../research/paseo-daemon.md)).
- **Capacity**: the shared relay stays the default and its free limits are measured before the first release. A browser following a busy thread keeps its room active, and all installations share about 28 active room-hours a day. Heavy users can deploy their own relay. Moving the shared relay to the paid plan would need [Nearly free to run](../requirements.md#budget) relaxed, since the project would then pay for others' traffic.
- **Open**: the browser runs the code the relay serves, so the relay cannot read the traffic only while it serves the published release; how a browser can trust what it loads is not settled.

## Considered Options

- **The host serves the web app over HTTPS on the local network or a tailnet**: rejected; it needs certificates or Tailscale, which the requirements rule out, and a plain-HTTP page on a network is unsafe.
- **The host serves the web app itself, matched to its version (Paseo's option)**: rejected as the main path, because a browser away from home cannot reach a host that listens only on its own computer.
