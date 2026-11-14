# Handoff: Independent host, browser access, and future Outlore rename

Supersedes: none
Workspace: ISKIOS, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Prepare the agreed architecture for an Electron-independent host, browser access, and optional background operation for implementation. Keep desktop, web, and future mobile apps on the shared Expo base, without losing features to Electron dependencies. Record the future Outlore rename separately; do not apply it as part of this documentation batch.

## State

- **Verified by file reads and Git diff:** the design is recorded in ADRs 0017–0020, amendments to earlier ADRs, architecture, access/update requirements, glossary, backlog, and Paseo research. Every changed path relative to `origin/main` is documentation. No feature has been implemented.
- **Verified by Git:** design commit `451c6e5` is on `main`, rebased without conflicts onto `6bd9bc824fe596d9d2bf36a1fea8dacf2578251a` (`origin/main`, tag `0.1.3-Prototype` at the time of fetch). `git range-diff` reports the original design patch unchanged; target ancestry and `git diff --check origin/main..HEAD` pass.
- **Verified by file reads:** the remote release used CHG-0280 and CHG-0281 while this thread was working. This batch's entries and references were renumbered CHG-0282–0284 and moved to `documentation/changelog/0.1.4-Prototype.md`. The published 0.1.3 changelog is untouched by this batch.
- **Verified now:** `bun run check` passed (652 files). No current typecheck, tests, browser drive, package build, or runtime validation was run for this documentation-only landing.
- **Recorded, not re-run now:** the earlier Bun 1.4.3 macOS probe and Paseo research are in the backlog and research note. Do not treat them as cross-platform proof or current-runtime compatibility checks.
- **Verified by backlog read:** the app will be called Outlore; Iskios stays a theme with its icon. This is a future item only. Application identifiers, data paths, product branding, and icons remain unchanged.
- **Publication pending at handoff creation:** the owner authorized this documentation batch and handoff to be committed and pushed to `main`, with rebase/conflict resolution if needed. This handoff will be committed after `451c6e5`. Check the live remote ref and final thread receipt before claiming publication or CI success; neither was known when this immutable file was written.

## Decisions

- Respect ADRs 0017–0020 and the requirements rather than reconstructing the interview. Node with TypeScript/Effect is the initial host runtime; Bun remains a future measured comparison. Electron stays as the desktop shell for now, not as a requirement of shared UI or host code.
- The host owns execution and data; desktop-only features move to it or gain web equivalents. Background operation, local discovery/authentication, persistent pairings, remote terminal confinement, release-matched web delivery, and host-side updates are recorded in the ADRs.
- The owner asked for optional sleep prevention. The on-by-default setting and failed-update rollback were agent recommendations, not separately confirmed product defaults; the changelog distinguishes them.
- These are architecture agreements, not verification of an implementation. Capability behavior and acceptance must be reconciled before production changes.
- Outlore is a future app rename, not a rename of the Iskios theme. Whether the assistant also changes its name has not been decided.

## Next

1. Confirm the user's next focus and check Git status, the remote `main` ref, and any newer handoff. The last requested operation was documentation publication, not feature implementation.
2. Resolve the web-code delivery trust boundary recorded in ADR 0019 before relying on browser end-to-end encryption against the serving operator.
3. Update the affected capability behavior and acceptance: device pairing/web access, conversation terminals, host updates, and Workshop lifecycle/sleep/terminal controls. Identify remaining defaults and failure behavior explicitly.
4. Design implementation boundaries and verifiable batches. Preserve stored pairing keys across token rotation and updates, installed/development isolation, and host authority for future multiplayer.
5. Implement only the authorized batch and verify it through the actual clients and host lifecycle. Keep the future Outlore rename separate unless the owner selects it.

## Open questions

- How can a browser trust the web app delivered by the relay? ADR 0019 records the open trust decision; the owner must approve its boundary.
- Confirm sleep-prevention defaults and rollback/data compatibility semantics before implementing unattended updates. Restoring an executable alone may not restore compatibility with a migrated database.
- Cross-platform supervision, native PTY packaging, sandbox policy, update recovery, and browser icon limitations need implementation evidence; the architecture does not prove them.
- The exact terminal system-read allowance and its relationship to future folder/realm/quest sharing remain capability-design work.
- Outlore rename scope and migration details, including the assistant's name, are not specified.

## Sources

- `documentation/architecture.md`
- `documentation/architecture-decision-record/0017-typescript-and-effect-no-rust.md`
- `documentation/architecture-decision-record/0018-host-service-runs-on-its-own.md`
- `documentation/architecture-decision-record/0019-browsers-use-the-relay-served-web-app.md`
- `documentation/architecture-decision-record/0020-terminals-run-in-the-host.md`
- `documentation/requirements.md`, `documentation/glossary.md`, `documentation/backlog.md`
- `documentation/changelog/0.1.4-Prototype.md` (CHG-0282–0284)
- `documentation/research/paseo-daemon.md` (primary-source paths at Paseo commit `42c7b7f886ff1395d4d292838daaca9ca929cbda`)
- `documentation/capabilities/device-pairing/specifications.md`
- `documentation/capabilities/conversation-terminal/specifications.md`
- `documentation/capabilities/app-updates/specifications.md`
- Design commit `451c6e5`; rebase backup `refs/rebase-backup/host-architecture-main` points to original `4e38473`.
