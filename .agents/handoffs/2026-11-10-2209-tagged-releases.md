# Handoff: Tagged desktop releases

Supersedes: `2026-11-10-2154-desktop-packaging.md`
Workspace: `/Users/dgerrits/Codelab/Dyrits/CANOPY`, branch `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Distribute Gild's macOS DMGs, Windows executable, and Linux AppImage through direct GitHub Release downloads when a version tag is pushed.
The configuration is delivered; the next session should inspect hosted checks and verify the first tagged release when the owner chooses a version.

## State

- Verified by git history and file reads: `dfefad3` implements initial native packaging, `4589394` records the first handoff and alpha package versions, and `12b77af` switches packaging to tags and adds direct release downloads.
- Verified by the prior push command output and the current empty `git log origin/main..HEAD`: `12b77af` was pushed to `main`; the remote has not been fetched again during handoff preparation.
- Verified from the conversation: the owner reported the original packaging works, accepted the tagged-release recommendation, and explicitly authorized committing and pushing this handoff.
- Verified by reading `.github/workflows/package.yml`: main pushes and PRs run lint, types, and tests; version tags build the four platform/architecture installers and publish a release; manual dispatch builds Actions artifacts without publishing a release.
- Verified by rerunning `python3 documentation/verification/2026-11-10-release-workflow.py`: all seven offline shell scenarios and dependency/permission assertions pass.
- Verified by reading the tagged-release proof: actionlint and whitespace validation passed for `12b77af`; hosted Linux checks and actual release transport remain unverified.
- Verified by `git status --short`: concurrent budget-related production, test, specification, and documentation changes remain uncommitted; preserve and exclude them from packaging commits.
- Verified by the earlier GitHub CLI command output: CLI authentication was unavailable, so no hosted run status was inspected through it.
- Assumed until checked on GitHub: the new main/PR test job and the first complete tagged-release path succeed.
- Assumed until target-system checks: Windows and Linux runtime compatibility beyond packaging.

## Decisions

The owner chose version-tag releases instead of packaging on each main push; the agreement and delivery are CHG-0128.
The tag without its `v` prefix sets the packaged version; hyphenated tags produce prereleases.
The workflow uploads raw installer artifacts retained for 14 days; GitHub Release assets provide persistent direct downloads until removed.
All four builds must finish before publication; files upload to a draft, which is published only after successful upload.
An interrupted draft upload can resume, while rerunning an already published release fails rather than replacing assets.
Trusted signing, notarization, runtime portability changes, and automatic updates remain separate work.
No new release tag was created in this session; the example `v0.1.0-alpha.1` in the conversation was an instruction, not a published version.

## Next

1. Inspect the latest main check at `https://github.com/Dyrits/GILD/actions/workflows/package.yml`, especially native terminal preparation and the Linux test job.
2. Confirm the intended release version with the owner, then create and push its version tag when authorized; the README describes the behavior.
3. Inspect the complete matrix and release job, then download both DMGs, the Windows executable, and the AppImage directly from `https://github.com/Dyrits/GILD/releases`.
4. Verify manual builds retain direct downloadable Actions artifacts without publishing releases, and use throwaway app data for target-system smoke checks.
5. Record hosted run links and results in the tagged-release proof and packaging section of work in progress, preserving concurrent budget changes.

## Open questions

- Which version should be the first tagged release?
- Have the new main checks completed successfully, and which systems are available for installer smoke checks?
- GitHub CLI access requires authentication if the next session uses it to inspect runs.

## Sources

- `.github/workflows/package.yml` and `README.md`, Desktop installers.
- `documentation/verification/2026-11-10-tagged-releases.md` and its offline proof script `2026-11-10-release-workflow.py` in the same folder.
- `documentation/verification/2026-11-10-desktop-packaging.md` for original macOS build evidence.
- `documentation/work-in-progress.md`, Desktop packaging automation.
- `documentation/changelog.md`, CHG-0127 and CHG-0128.
- Commits `dfefad3`, `4589394`, and `12b77af`.
- `.agents/handoffs/2026-11-10-2154-desktop-packaging.md` for superseded history only.
