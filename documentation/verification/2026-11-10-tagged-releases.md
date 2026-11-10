# Tagged desktop releases, 2026-11-10

Starting revision: `45893948e884f6208b633e1a1155b7fcb5fcbf92`.
Authorization: after confirming the initial packaging works, the owner accepted the recommendation to run checks on main/PRs, package version tags into GitHub Releases with direct installers, and retain manual test packaging.

## Reproduce

- `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 -shellcheck= .github/workflows/package.yml` passes.
- `python3 documentation/verification/2026-11-10-release-workflow.py` passes seven offline shell scenarios and release dependency/permission assertions.
- `git diff --check` passes.

The offline proof reads the actual workflow with Bun's YAML parser, executes its build and release Bash steps in a temporary folder, and substitutes fake Bun and GitHub CLIs.
It checks stable and prerelease creation, draft resumption, refusal to alter a published release, refusal to publish without all four installers, tag-derived app versions, and manual builds without a version override.
No real GitHub mutation, native packaging, or product test suite runs during this proof.
The newly configured Linux test job, artifact transport, and release publication remain unverified on GitHub until the corresponding events run.
Unrelated budget implementation is in flight in the shared working tree and is excluded from this change.

## Review

Reviewed the workflow and README against the agreed behavior, starting at the revision above.
Only tag pushes publish releases; manual dispatch produces artifacts; normal main and PR runs skip packaging.
The check job installs Electron and prepares native dependencies before running the existing suite with four workers.
Build jobs keep read-only repository permissions, and only the release job has contents-write permission.
Release publication waits for the complete matrix, verifies four nonempty installer files, uploads to a draft, and publishes only after successful upload.
Failed draft uploads can be retried; rerunning publication of an already published release fails instead of replacing its assets.
There was no independent agent review.

## Sources

- [.github/workflows/package.yml](../../.github/workflows/package.yml).
- [Installer instructions](../../README.md#desktop-installers).
- [Upload artifact, including unarchived single files](https://github.com/actions/upload-artifact).
- [Download artifact v8, including raw v7 uploads](https://github.com/actions/download-artifact).
- [GitHub CLI release creation](https://cli.github.com/manual/gh_release_create) and [release editing](https://cli.github.com/manual/gh_release_edit).
