# Handoff: Desktop packaging on pushes to main

Supersedes: none
Workspace: `/Users/dgerrits/Codelab/Dyrits/CANOPY`, branch `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Package Gild automatically when `main` is pushed, producing downloadable macOS DMGs, a Windows installer executable, and a Linux package.
The configuration is committed; completion needs a successful GitHub run with all target artifacts and installer smoke checks.

## State

- Verified by `git log` and file reads: commit `dfefad3` on local `main` contains the workflow, Electron Builder configuration, cross-platform packaging command adjustments, README instructions, CHG-0127, and verification notes.
- Verified by reading `.github/workflows/package.yml`: it defines native Apple Silicon and Intel macOS builds, Windows x64 NSIS, and Linux x64 AppImage, gated by lint and typechecking.
- Verified by reading `documentation/verification/2026-11-10-desktop-packaging.md`: the session recorded successful lint, workspace typechecking, actionlint, Apple Silicon packaging, signature verification, and DMG checksum verification; these checks were not rerun for this handoff.
- Verified by `git log origin/main..HEAD`: the packaging commit is ahead of the locally recorded remote branch; no push was performed in this session, and remote state has not been fetched again.
- Verified from the conversation: approval to push `main` was requested but not given; the owner requested this handoff instead.
- Verified by `git status --short`: unrelated uncommitted edits remain in the app and desktop package manifests, budget-related specifications, backlog, glossary, requirements, changelog, and work-in-progress document; preserve them.
- Verified by file read: the packaging batch's resumption state is at the top of `documentation/work-in-progress.md`; its budget-control changes belong to other work.
- Assumed until checked on GitHub: clean-runner installation, all four native builds, push/manual triggers, and artifact uploads work.
- Assumed until target-system smoke checks: Windows and Linux runtime compatibility; this batch establishes packaging configuration rather than product portability.

## Decisions

The owner authorized implementation with the existing Electron packaging approach.
The Linux format selected within the request's "Linux whatever" scope is AppImage, and Windows uses NSIS; see CHG-0127 and the README.
Installers are Actions artifacts retained for 14 days, with no GitHub Release publication or automatic updates.
Trusted signing and notarization remain outside the batch; Windows is unsigned and macOS uses the existing ad hoc signature.
The packaging command disables implicit publication and enables native rebuilding because node-pty has no Linux prebuild.
Repository rules require the owner's approval before pushing `main`; the handoff request supplies no such approval.

## Next

1. Confirm whether the owner wants publication and GitHub verification, and obtain approval for the push to `main` if it remains absent.
2. Inspect local and remote revisions and the shared working tree before publishing; preserve unrelated edits, particularly the concurrently changed package versions and their lockfile consistency.
3. After authorization, push the committed workflow and inspect the packaging run at `https://github.com/Dyrits/GILD/actions/workflows/package.yml`.
4. Check the lint/typecheck gate and all four native build jobs, download each installer artifact, and investigate any build failure within the agreed scope.
5. Smoke-test installation, startup, service access, and terminal native-module loading on each available target system using throwaway data; report unavailable systems explicitly.
6. Update the verification proof and working state with GitHub run evidence and remaining gaps.

## Open questions

- Will the owner authorize pushing `main` and running the hosted builds?
- Which Windows and Linux systems are available for runtime checks?
- Trusted signing, notarization, public releases, and automatic updates need separate authorization if desired later.

## Sources

- Commit `dfefad3` and starting revision `51d4ceb44a8fad62fbea27acb233856d6cb1c777`.
- `.github/workflows/package.yml`.
- `apps/desktop/electron-builder.yml` and `apps/desktop/scripts/package.ts`.
- `README.md`, Desktop installers.
- `documentation/verification/2026-11-10-desktop-packaging.md`.
- `documentation/work-in-progress.md`, Desktop packaging automation.
- `documentation/changelog.md`, CHG-0127.
- `documentation/architecture-decision-record/0013-installed-app-apart-from-development.md`.
- `AGENTS.md`, Git push guard and shared handoff rules.
