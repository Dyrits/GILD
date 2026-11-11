# Handoff: Charter harness installation and version labels

Supersedes: none
Workspace: `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`, branch `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Let the owner install missing harnesses from Charter and show clean harness/version titles. Finish any requested real-install or appearance acceptance, and retain the explanation for the macOS Dock tooltip saying Electron.

## State

- Verified by current file reads: InstallHarness is wired through contracts, the service, HarnessTools, and the Charter card. The installer runs the official npm package globally with a five-minute timeout; it rechecks the configured executable and reports failures. See the provider-accounts specification and installation verification record for behavior and limits.
- Verified by current file read: HarnessTitle extracts the version while preserving a leading `v`, producing the owner's requested `Claude Code · 2.1.302`, `Codex · 0.160.1`, and `OpenCode · v2.2.0`. This shared title also appears under Accounts.
- Verified now: repository Biome and workspace typecheck pass; the targeted harness test command passes 47 tests. Recorded earlier in this session, not rerun for the handoff: full suite 739 passed, 10 skipped; Expo web export; browser check with fake installations. Evidence and screenshots are in the verification record.
- Verified by file reads during this session: the development launcher runs the stock Electron.app executable; its Info.plist names it Electron, while desktop packaging sets productName to Iskios. The installed Electron type documentation explicitly says app.setName changes Electron's internal name, not the OS name. A process-list probe confirmed the running development app used Electron.app with dist/main.js. No Dock naming fix was made and no packaged Dock tooltip was verified.
- Verified by Git status: substantial rebrand/sidebar work predated this session and remains separate, including staged asset deletions and renames. This session's commit isolates harness changes and documentation; its source uses the namespace and button names at the committed base (Gild), while the working tree retains the separate Iskios rename. Preserve that remaining work and its staged state.
- The owner's current instruction is to write this handoff and commit, without a push. Find the resulting commit with `git log --oneline -- .agents/handoffs/2026-11-11-1200-harness-installation.md`.

## Decisions

- Install is explicit, uses each harness's official npm package, and requires the computer's Node.js/npm with a writable global prefix on PATH. Installation does not sign the owner in. Existing Update behavior stays.
- Version titles contain only the harness name and version, following the owner's exact examples. Raw CLI version output remains available to the service.
- Keep the other session's rebrand/sidebar changes out of this commit. Changelog entries for this session are CHG-0147 and CHG-0148, avoiding the other session's CHG-0145.
- The Dock question was answered as a diagnosis. Creating a separately branded development bundle was not requested or implemented.

## Next

1. Check current Git state and the session commit, preserving the uncommitted rebrand/sidebar work.
2. If requested, have the owner review the Charter titles and Install action in the desktop app; the browser screenshots use fake installations.
3. If the owner requests a real install, verify npm/PATH/global-prefix permissions and test one missing harness, including sign-in afterward through its own flow. Real installations and Windows/Linux execution remain unverified.
4. If the owner wants the development Dock tooltip changed, implement a separately branded development bundle while preserving the distinct development profile. The packaged application's Dock name also still needs direct verification.

## Open questions

- Does the owner want a separately named development app bundle, or only to use the packaged Iskios app? The owner has not requested that change.
- Real-install and desktop appearance acceptance remain pending; the owner determines when to exercise them.

## Sources

- `documentation/capabilities/provider-accounts/specifications.md`.
- `documentation/verification/2026-11-11-harness-install.md` and its screenshot directory.
- `documentation/changelog.md`, CHG-0147 and CHG-0148; `documentation/work-in-progress.md`.
- `apps/app/src/settings/accounts.tsx`.
- `packages/contracts/src/requests.ts`.
- `packages/service/src/harness/harnessInstallation.ts`, `harnessTools.ts`; `packages/service/src/work/accounts.ts`; `packages/service/src/service.ts`.
- `packages/service/test/harness/harnessInstallation.test.ts` and `harnesses.test.ts`.
- `apps/desktop/scripts/dev.ts`, `apps/desktop/src/main.ts`, `apps/desktop/src/instance.ts`, `apps/desktop/electron-builder.yml`.
- `node_modules/electron/electron.d.ts`, app.setName; `node_modules/electron/dist/Electron.app/Contents/Info.plist`.
