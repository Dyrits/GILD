# Handoff: README and agent guide

Supersedes: none
Workspace: `/Users/dgerrits/Codelab/Dyrits/CANOPY`, branch `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Give new users a usable README and agents a concise guide to the repository's authoritative documents.
The owner requested this shared handoff, a commit, and a push.

## State

- Verified by file reads: `README.md` covers capabilities, vocabulary, installation, first use, local data, development, checks, repository layout, releases, and contributions.
- Verified against `apps/desktop/electron-builder.yml`: the README distinguishes missing Developer ID signing and notarization from the ad hoc macOS signature; it explains Gatekeeper exceptions and a Gild-specific quarantine command, plus Windows and Linux installation.
- Verified by repository file search: no project `LICENSE` exists; the README explains this and points to the intended Apache 2.0 license in the architecture.
- Verified against Git hooks: `AGENTS.md` corrects the conditional commit-time typecheck and preserves protected-branch approval rules; it uses task-based document pointers and highlights three recent current handoffs.
- Verified by earlier checks: all 23 local links in each guide resolved before final installation and handoff additions; those additions still need the final link check.
- Verified by `git diff --check -- README.md`: whitespace validation passes after installation edits.
- Verified by `git status --short`: unrelated app, service, contracts, test, and product-documentation edits remain; exclude them from this documentation commit.
- Verified by `git log origin/main..HEAD` at preparation: no commits were ahead of the recorded remote; remote state was not fetched again.
- Publication is pending at writing; inspect Git history and the remote before claiming the documentation commit was pushed.
- No application tests or installer launches were run for these documentation-only edits.

## Decisions

Keep old handoffs as history in their folder; highlight only the three newest current handoffs in `AGENTS.md`.
Preserve the tagged-release instructions contributed concurrently by the packaging session.
The owner's explicit commit-and-push request authorizes publishing these documentation changes to `main`, including bypassing its pre-push guard for this push.
This work creates no license, signing certificate, notarization, installer, or release tag.

## Next

1. Verify that the documentation commit contains only `README.md`, `AGENTS.md`, and this handoff, and confirm publication on `origin/main`.
2. Recheck documentation claims against current scripts and capability specifications when changing them; consult the tagged-release handoff for hosted release verification.

## Open questions

The source-code license file and trusted installer signing remain unfinished; the owner decides when to complete them.
Installation instructions were checked against reference pages and configuration, not exercised on fresh target machines.

## Sources

- `README.md`
- `AGENTS.md`
- `.githooks/pre-commit`
- `.githooks/pre-push`
- `apps/desktop/electron-builder.yml`
- `apps/desktop/scripts/dev.ts`
- `packages/service/src/main.ts`
- `.github/workflows/package.yml`
- `documentation/architecture.md`
- `.agents/handoffs/2026-11-10-2209-tagged-releases.md`
- https://timon-ai.com/installation#macos
- https://support.apple.com/en-us/102445
