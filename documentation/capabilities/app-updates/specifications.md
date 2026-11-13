# App updates

Status: **agreed (CHG-0266); being built. Look and the unverified platforms await the owner** (2026-11-13).

## Problem and outcome

The installed Iskios never learns that a newer release exists; the owner downloads each installer by hand. The installed app detects a new release, downloads it, and replaces itself when the owner says so.

## Agreed behavior

- **Only the installed app updates.** A development run (`bun run dev`) never checks; the Workshop's card says so.
- **Checks**: once at start and every 6 hours while the app stays open, and on **Check now**. A check asks the repository's GitHub releases for the newest release of the app's channel and compares versions.
- **Channel**: a build whose version has a prerelease part (`0.1.1-Prototype`) follows prereleases and stable releases; a stable build follows stable releases only. Versions compare as semantic versions.
- **Download in the background**, then the app shows that an update is ready. **Nothing installs unasked**: no install on quit, no automatic restart. A restart stops running turns and a release may break saved data ([requirements](../../requirements.md#releases)), so the owner presses **Restart and update**, after a confirmation that says turns still running stop. **Later** leaves the notice in the Workshop's Updates card.
- **What the owner sees**: an **Updates** section of the Workshop (the installed version, the version found, when it last checked, **Check now**, the switch below, and the release notes of a ready update) and a quiet notice in the app when an update is ready, with the notes' breaking changes shown as written.
- **Switch**: checking is on by default and the owner can turn it off in the Updates section. Off, the app makes no request to GitHub; the setting belongs to this computer and is kept beside the app's data, not in the shared settings.
- **Privacy**: the check is one HTTPS request to GitHub's public release list, carrying the app's name and version in its user agent and nothing about quests, workspaces, accounts, or the owner ([requirements](../../requirements.md#privacy-and-data)).
- **Trust**: an update is trusted when it comes over HTTPS from the repository's own release and its SHA-512 matches `SHA512SUMS.txt`, published in the same release by the release workflow. There is no code-signing key (no Developer ID); an account takeover on GitHub would defeat this, as for any unsigned release. Signing that file with the project's own key is a later hardening ([backlog](../../backlog.md)).
- **macOS** (our own updater, because Squirrel.Mac, which `electron-updater` uses on macOS, refuses an app without a Developer ID): downloads the release's DMG for this Mac's architecture, checks it, copies the new app beside the installed one, and after the app quits swaps the two by renaming, strips the download mark, and opens the new app. The swap keeps the old app aside and puts it back when the rename fails. It needs write access to the folder holding the app; without it, the card says so and offers the release page.
- **Windows and Linux**: `electron-updater` downloads and installs the NSIS installer or replaces the AppImage; a Linux install that is not an AppImage reports that updating needs the AppImage and offers the release page. These paths cannot be run on the build computer and are reported as unverified until smoke-tested on those systems.
- **Failure** is shown in the Updates section with its reason and never stops the app; the next check tries again. A failed install leaves the installed version running.

## Edge cases

- A release with no installer for this platform and architecture, or without `SHA512SUMS.txt`, is skipped as no update, with the reason in the Updates section.
- A downloaded file whose hash differs is deleted and reported.
- A newer version already downloaded and unfinished at the last quit is downloaded again rather than trusted.
- The running version is never offered to itself; an older release is never offered.

## Acceptance

Checks an agent can perform:

- Version comparison, channel choice, and release choice behave as above for prerelease and stable builds ([tests](../../../apps/desktop/test/updates/)).
- With the switch off, no request is made; on, the request carries only the user agent and the standard headers.
- A fake release server offering a newer DMG: the packaged app on macOS finds it, downloads it, rejects a wrong hash, and, after Restart and update, relaunches as the new version with the old app removed; a swap that fails rolls back.
- The Updates section and the notice render the states: unsupported, checking, up to date, downloading, ready, failed, and turned off.

Human acceptance: the owner reviews the look of the Updates section and the notice, and updates a real installed copy from one release to the next once two releases exist. Windows and Linux updating is accepted only after a run on those systems.

## Requirements covered

- Updating reads a public release list and sends nothing about the owner ([requirements](../../requirements.md#privacy-and-data)).
- Nearly free to run: GitHub's public release list and release downloads cost the project nothing.
- Breaking changes are listed in the release notes; the notice shows them before anything installs ([requirements](../../requirements.md#releases)).

## Not in this capability

Developer ID signing and notarization; a data backup before an update; a signed manifest; rollback to an earlier release; beta and stable channel choice by the owner.
