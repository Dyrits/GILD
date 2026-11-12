# Handoff: device pairing, optional own relay

Supersedes: `2026-11-12-2043-device-pairing-relay-deployed.md`
Workspace: Iskios repository (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`; the own-relay work is committed as `a5ce7b3` (CHG-0212), and this handoff is committed and pushed after it.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner wants to control one Iskios from another instance, from any internet connection, with no account for users and no cost to them or the owner; a phone follows later. A user who does not want the shared relay may use their own Cloudflare account instead, with one input. Done means: the folder picker and terminal on a host, the direct WebRTC path and a measurement of the relay's real use are built and checked (batches 3 to 5 of CHG-0203), and the owner has pairing working from the app and has reviewed the screens of batch 2 and the Relay section.

## State

The two earlier handoffs record batches 1 and 2, the deployed shared relay (`https://iskios-relay.dyrits.workers.dev`) and the closing frame (CHG-0209). This session added the optional own relay (CHG-0212, commit `a5ce7b3`):
- **Service:** `packages/service/src/remote/ownRelay.ts` deploys the relay Worker through Cloudflare's API with one token (list accounts, workers.dev subdomain, upload as a SQLite-backed Durable Object, enable the address, wait until it answers); requests `UseOwnRelay { token }` and `UseSharedRelay` (host-only, in `packages/contracts/src/remote.ts` and `requests.ts`); `RemoteAccessView` gains `isOwnRelay`; the host record's existing `relay_origin` column holds the owner's address; the host runtime closes its connection when the address changes (`hostRuntime.ts`); `service.ts` `switchRelay` announces a change only when the address differs.
- **Bundle:** the Worker shipped in the app is `packages/relay/src/workerBundle.generated.ts`, built by `bun run bundle` in `packages/relay` from the Worker's sources and `wrangler.jsonc`; a test fails when its recorded source hash no longer matches.
- **App:** `apps/app/src/settings/remoteAccessCard.tsx` has a Relay section (`RelayChoice`: relay in use, the form with a link to Cloudflare's token page, one masked token field, a notice, Deploy and use, Cancel, Use the shared relay, Update my relay); words in `remoteAccess.ts`.
- **Check-only setting:** `ISKIOS_OWN_RELAY_NAME` (service environment) renames the Worker so a check does not meet one already on the account.

Verified now (run on 2026-11-12 on the files committed in `a5ce7b3`, machine load about 2 to 4): `bun run typecheck` exits 0 in all six workspaces (also run by the commit hook, with Biome); `vitest run packages` gave 967 passed, 10 skipped; the app suite gave 311 passed, 4 skipped; deliberate breaks (five on the deploy client, five on the service, three on the bundle and relay) each turned tests red. Live on the owner's Cloudflare account, in a scratch run outside the repository with a real token: the owner's own untagged `iskios-relay` was refused and untouched; a fresh deployment took 6.2 s; the host connected through it in 1.6 s; a second service paired through it in 0.6 s and steered the host; an in-place update and the return to the shared relay worked; the token was not in the host's database. The test Worker `iskios-relay-own-test` was deleted; the account's Workers are `iskios-relay`, `receipt-ledger` and `thread-unit-of-work`. The form was seen in a running window with the fake harness, light theme only, including Cloudflare's real refusal of a bogus token.

Not verified or open:
- **A real pairing between two apps through the shared relay has not been seen**; the owner's first attempt failed only because the relay did not exist yet.
- A token that reaches several accounts is refused with a message (the owner's reaches two); the choice of account in the app is not built, and the live run narrowed the list to the personal account by a test shim, so that path was not run against real Cloudflare end to end.
- Not seen: dark mode, the Gild theme, a narrow window, the Copy button, a phone, two physical computers, and a free account that never used Workers.
- The relay's free-plan use is not measured; an estimate of 30 to 100 daily users on the shared relay is derived from Cloudflare's limits (13,000 GB-s a day; about 450 GB-s per active hour of a room) and one day of measured analytics (7.5 s active for all the tests).
- The misleading dialog wording "Could not reach the relay. Check your internet connection." is not changed.
- A released build points every install at the owner's shared relay address (compiled in; overridable only with `ISKIOS_RELAY_ORIGIN`), which also shows the owner's workers.dev account name.
- The owner's saved test token is still in the assistant's own key store and in Cloudflare; the owner was told to revoke it. The working tree also holds other agents' uncommitted work (README, the app guide and guildmaster files, changelog CHG-0211), which was left alone.

## Decisions

- Own relay is optional and never required; the shared relay stays the default (CHG-0212, amends ADR 0016, which replaces the temporary-account claim idea).
- The API token is used for one deployment and is never stored, logged or put in a message; it is sent only to `api.cloudflare.com` with redirects refused. The user creates it from Cloudflare's "Edit Cloudflare Workers" template, limited to one account.
- A Worker is Iskios's own only if it carries the tag `iskios-relay`; any other Worker of the same name is refused and left alone. The first upload carries the Durable Object migration and later ones must not (Cloudflare refuses the same migration again, checked live).
- Switching relays disconnects the devices (they paired through the other relay) and keeps their pairings; the same address changes nothing for connected devices.
- The relay closes connections with a closing frame, not only a close code (CHG-0209).
- A guard blocks pushing to `main`; the owner approves a push on purpose with `--no-verify`.
- Earlier decisions stand (see the superseded handoffs): the batches in CHG-0203, device token, room claim, the local service as the bridge.

## Next

1. Ask the owner whether pairing between two apps through the shared relay now works from the app; if not, read the error and the Worker's logs and find the cause.
2. Ask the owner to review the screens of batch 2 and the Relay section, and to answer the draft's open points (terminal staging, the offline host, host menu details).
3. Decide with the owner which follow-ups in the backlog come first: choosing among a token's accounts in the app; telling devices paired through the old relay where the host moved so they need not pair again; telling the owner when a newer relay ships; the sync-key idea; fixing the "Check your internet connection" wording.
4. Batch 3: the folder picker that runs on the host and the terminal on a host (amend ADR 0012); until then a selected host refuses the system dialog and `!` stays text.
5. Batch 4: the direct WebRTC path through the relay's introductions (the lab results are in the lab record).
6. Add rate limits per room and per source, define what the host and app say when the daily limit is reached, and measure active-object hours of the shared relay over a real multi-hour session before any release.

## Open questions

- Whether to keep the shared relay as the default in the first alpha release, given that it shares the owner's free limits and shows the owner's workers.dev name (alternatives: put it behind a project domain so it can move without an update, or lean on the own relay).
- Whether the owner wants the sync-key idea recorded: one secret that lets every device holding it pair with the owner's hosts automatically; it was proposed in chat and not written down.
- Whether the owner is happy with the look of the host menu, the Add a host dialog, the Charter card and the Relay form.

## Sources

- `documentation/changelog.md` (CHG-0201 to CHG-0209 and CHG-0212); `documentation/work-in-progress.md`; `documentation/backlog.md` (own relay follow-ups)
- `documentation/capabilities/device-pairing/specifications.md`, `draft.md`; `documentation/architecture-decision-record/0016-shared-relay-on-the-owners-free-cloudflare-account.md`
- `documentation/verification/2026-11-12-relay-and-direct-path-lab.md`, `…-device-pairing-proof.md`, `…-device-pairing-review.md`
- `packages/service/src/remote/ownRelay.ts`, `hostActions.ts`, `hostRuntime.ts`, `hostAccess.ts`; `packages/service/src/service.ts` (`switchRelay`); `packages/relay/scripts/`, `packages/relay/src/workerBundle.generated.ts`; `apps/app/src/settings/remoteAccessCard.tsx`
- `packages/service/test/remote/ownRelay.test.ts`, `ownRelayChoice.test.ts`, `fakeCloudflare.ts`; `packages/relay/test/workerBundle.test.ts`; `apps/app/test/settings/remoteAccess.test.ts`
