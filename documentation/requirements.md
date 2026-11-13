# Requirements

## Licensing

- **Fully open source**: all Iskios code is published under an OSI-approved open-source license.
  Source: the user. Reason: product decision.
- **Respect upstream licenses**: Iskios takes ideas from OpenBot, MausBot, Rerun, and Delta, and complies with each one's license and terms. No OpenBot code is included, because its PolyForm Noncommercial 1.0.0 license cannot be relicensed as open source; Delta is closed, so only its ideas are used; MausBot code, if used, keeps its Apache 2.0 license and notices, and nothing comes from its `enterprise/` folder, which is under a separate source-available license.
  Source: the user, and the upstream licenses. Reason: legal compliance.

## Budget

- **Nearly free to run**: running Iskios costs the project and each user nearly nothing beyond their own provider use; the project pays for no other user's infrastructure.
  Source: the user. Reason: an open-source project with no revenue cannot carry others' costs.
  Check: a single user's phone traffic fits within a free tier of the services it relies on.

## Privacy and data

- **Local data**: missions, threads, intel, and workspace contents stay on the user's computer; nothing leaves it except what a harness, provider, or connected service needs for the work, and the encrypted traffic to a paired device.
  Source: the user. Reason: product decision.
  Hosted multiplayer exception (CHG-0021): invited guests may receive shared mission conversations and results. The first hosted version keeps mission documents and data on the host. Future guest local copies require a separate design for their scope, synchronization, and retention. Removing access cannot erase information a guest has already saved or copied.
- **Price table read carries no owner data**: the local service's read of the model price table sends nothing about missions, workspaces, accounts, or the owner, and the owner can switch it off, leaving the price table shipped with Iskios.
  Source: the user, 2026-11-10 (CHG-0126). Reason: Local data allows only what a harness, provider, or connected service needs for the work; a price lookup is not needed for the work.
  Check: a test on the request the service sends for the price table, and the Charter switch.
- **Bring your own provider**: users connect their own provider subscriptions or API keys; Iskios resells no model use.
  Source: the user. Reason: product decision.
- **Comply with provider terms**: Iskios never offers a provider's sign-in as its own, nor collects, stores, or relays provider credentials or session tokens; each harness signs in through its own unmodified tool and the provider's own flow, and the documentation states each provider's terms plainly.
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
- **Future multiplayer**: Iskios must eventually support both invited people joining one host's missions and people collaborating from their own installations. The first build may be single-user, but architecture and technical design must identify assumptions that would block either form before committing to them. The [hosted agreements](architecture.md#future-multiplayer-open-architecture-questions) define guest access, host execution and authority, spending, resource sharing, and data location (CHG-0014 and CHG-0016 through CHG-0021). Execution across installations and synchronization remain undesigned.
  Source: the user, 2026-11-04. Reason: multiplayer is a product goal, not a permanent exclusion.
- **Pair by QR code from anywhere**: a phone pairs by scanning one pairing code, and then reaches Iskios from any network.
  Source: the user. Reason: product decision.

## Releases

- **No compatibility promise before the stable release**: until the first stable release, saved data and settings are not guaranteed to carry over from one release to the next, and the README and each release's notes say so.
  Source: the user, 2026-11-13. Reason: the releases so far are prototypes, and users must not expect an upgrade to keep what they saved; compatibility is still kept where it can be (see the Stored data conventions).
- **Breaking changes are listed in the release notes**: every release's notes name its breaking changes, including any change that makes data or settings saved by an earlier release unreadable or different.
  Source: the user, 2026-11-13. Reason: a user upgrading must be able to see what will not carry over.
