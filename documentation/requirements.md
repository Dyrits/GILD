# Requirements

## Licensing

- **Fully open source**: all OpenMission code is published under an OSI-approved open-source license.
  Source: the user. Reason: product decision.
- **Respect upstream licenses**: OpenMission takes ideas from OpenBot, MausBot, Rerun, and Delta, and complies with each one's license and terms. No OpenBot code is included, because its PolyForm Noncommercial 1.0.0 license cannot be relicensed as open source; Delta is closed, so only its ideas are used; MausBot code, if used, keeps its Apache 2.0 license and notices, and nothing comes from its `enterprise/` folder, which is under a separate source-available license.
  Source: the user, and the upstream licenses. Reason: legal compliance.

## Budget

- **Nearly free to run**: running OpenMission costs the project and each user nearly nothing beyond their own provider use; the project pays for no other user's infrastructure.
  Source: the user. Reason: an open-source project with no revenue cannot carry others' costs.
  Check: a single user's phone traffic fits within a free tier of the services it relies on.

## Privacy and data

- **Local data**: missions, threads, intel, and workspace contents stay on the user's computer; nothing leaves it except what a harness, provider, or connected service needs for the work, and the encrypted traffic to a paired device.
  Source: the user. Reason: product decision.
- **Bring your own provider**: users connect their own provider subscriptions or API keys; OpenMission resells no model use.
  Source: the user. Reason: product decision.
- **Comply with provider terms**: OpenMission never offers a provider's sign-in as its own, nor collects, stores, or relays provider credentials or session tokens; each harness signs in through its own unmodified tool and the provider's own flow, and the documentation states each provider's terms plainly.
  Source: the providers' terms (for example Anthropic's Claude Code legal and compliance page). Reason: a provider can limit or close accounts that break them.
- **End-to-end encrypted phone traffic**: any service relaying traffic between the computer and a paired device cannot read it.
  Source: the user. Reason: product decision.

## Safety

- **Approval per action**: a risky action runs only after the user's approval or under a standing permission the user granted. A single approval never carries over to another action or another thread, including the threads beneath it.
  Source: the user. Reason: product decision; standing permissions let threads run autonomously on what the user already trusts them with.
  Relaxed by the user on 2026-11-04 (CHG-0010): it read "a risky action runs only after the user's approval, and an approval never carries over to another action or another thread, including the threads beneath it". Reason: an assistant must be able to run without asking each time.

## Access

- **Single user**: one installation serves one user; sharing missions between people is out of scope for now.
  Source: the user. Reason: product scope.
- **Pair by QR code from anywhere**: a phone pairs by scanning one pairing code, and then reaches OpenMission from any network.
  Source: the user. Reason: product decision.
