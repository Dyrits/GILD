# Downloaded DMG launch investigation, 2026-11-10

Symptom: the owner reports Gild's Dock icon keeps bouncing without opening a window.
No application runtime code changed; a packaged-app check and a macOS release gate were added.

## Observed

- `codesign --verify --deep --strict /Volumes/Gild/Gild.app` passes for the mounted `0.1.0-Alpha` arm64 app.
- The first check of `/Applications/Gild.app` reported an invalid Electron framework resource signature; a later check passed before replacement, so this earlier failure is not established as the persistent cause.
- Both installed and mounted test launches stalled before Electron initialized; a sample showed the main thread at `_dyld_start` and no temporary data directory was created.
- macOS Gatekeeper assessment rejected both apps; the security log reported ad hoc or unknown-chain signing and a security prompt waiting for a response for `app.gild.desktop`.
- `ditto --noqtn /Volumes/Gild/Gild.app /private/tmp/gild-launch-probe.1adScK/Gild.app` produced a copy that passes signature verification and launches on isolated data.
- Its local debugging endpoint reported a window titled `Gild` at `gild-app://app/`, with Electron helper processes present; the rendered interface contents were not inspected before stopping that test.
- The installed bundle was backed up to `/private/tmp/gild-launch-probe.1adScK/Gild-before-repair.app` and replaced with the intact mounted copy using `ditto --noqtn`.
- The replacement passes signature verification but still stalled at the installed path; its debug endpoint never became available.
- All launch probes used temporary `GILD_DATA_DIR` values, and the specific hung original launch and test processes were stopped by their observed process IDs; no user database was opened by the test launches.

## Earlier unsuccessful probes

The owner confirmed that Open Anyway does not clear the bouncing-icon stall.
A new process sample after approval still showed `_dyld_start` before Electron initialized.
Removing the installed app's provenance attribute did not resolve startup; the attribute remained present on inspection.
A temporary copy was re-signed ad hoc with entitlements, requirements, and flags preserved, placed at `/Applications/Gild-resigned-test.app`, and launched on isolated data.
That test exposed its debug port and created the isolated service database, then exited with status zero before the interface was inspected; this establishes progress beyond the loader, not a reliably running window.
The same local re-signing was applied to `/Applications/Gild.app`, whose signature verifies; an automated isolated launch check still timed out after 40 seconds without its bundled window.
The timed-out probe was stopped by its own process handle.
These probes did not fix the installation; a fresh file-identity test followed.
Trusted Developer ID signing and notarization remain the distribution solution, separate from this local investigation.
The local app backup is temporary and must not be treated as durable storage.

## Verified resolution

`bun apps/desktop/scripts/check-package.ts /Applications/Gild.app` failed on the blocked installation after 30 seconds.
A fresh copy created with `cp -RX /Applications/Gild.app /private/tmp/gild-fresh-install.b4gsVD/Gild.app` passed the same check: rendered Guildmaster screen, service bridge, and native terminal.
The blocked bundle was moved to `/private/tmp/gild-fresh-install.b4gsVD/blocked-Gild.app`, and the passing bundle was moved to `/Applications/Gild.app` without overwriting its files.
The check passed again at its installed location.
The working and blocked main executables have identical SHA-256 `7a6241f47c3de1945ecd3ba029ad0c5d78eb7b526764140feabe7e28c00e551a`, but distinct file IDs (`68663521` working, `68661303` blocked).
This is consistent with an OS launch-block cache attached to file identity; the hash comparison proves no main-executable code change was needed to clear the local failure.
The copy also drops extended attributes, so the experiment does not separately prove the identity and metadata mechanisms.
An [upstream Electron-app report](https://github.com/tldraw/tldraw-office/issues/79) describes the same loader stall and fresh-copy recovery, including on notarized builds.

The repaired app also opened through `open -n` on isolated data; the debugger confirmed title `Gild`, URL `gild-app://app/`, and rendered Guildmaster text.
Normal launching initially selected a temporary test bundle instead, which claimed the normal profile lock.
The temporary bundles were unregistered with the app-specific `lsregister -u` operation, the installed bundle was registered with `lsregister -f`, and `open -n -a /Applications/Gild.app` launched the correct bundle.
Observed main process `64689` runs from `/Applications/Gild.app`, has its service/renderer helpers, and owns the normal `Gild/SingletonLock`; no debugging port is enabled on that normal launch.
The owner's final look and use remain pending.

## Release regression check

`apps/desktop/scripts/check-package.ts` starts the supplied packaged app on temporary fake-harness data, waits for its rendered interface and bridge, opens/closes its native terminal, then stops only its own process and removes the temporary profile.
Run `bun apps/desktop/scripts/check-package.ts /Applications/Gild.app` to reproduce the check.
The macOS workflow gate verifies and mounts the actual DMG read-only, creates a fresh installed copy, verifies its signature, and runs this check before uploading the installer.
Its cleanup unmounts the image and unregisters/removes the temporary bundle.
The exact gate was executed locally against `~/Downloads/Gild-0.1.0-Alpha-mac-arm64.dmg` and passed without modifying or re-signing that downloaded app.
An initial gate attempt returned a generic renderer-check error, while the direct fresh-copy check and rerun passed; renderer failure details were added to the checker, and that earlier transient has not been reproduced or explained.
Actionlint, desktop typecheck, Biome, and the seven existing offline release-workflow scenarios pass.
The new gate has not yet run on GitHub's macOS runners; it does not prove Windows/Linux runtime behavior or Apple trust acceptance on another Mac.

## Recovery procedure

Quit the affected app first, and use Activity Monitor to stop its specific stalled process if needed.
Copy the trusted installed bundle with `cp -RX` into a new temporary folder and verify its signature with `codesign --verify --deep --strict`.
Move the blocked installed bundle aside as a backup, then move the fresh copy into Applications rather than copying over the blocked files.
Register `/Applications/Gild.app` with the app-specific LaunchServices registration tool if multiple investigation copies share its bundle identifier.
Keep application support data in place; the repair concerns the app bundle, not the user's database.
