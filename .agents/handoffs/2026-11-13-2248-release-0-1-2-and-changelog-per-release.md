# Handoff: release 0.1.2-Prototype, the changelog per release, and the documentation refresh

Supersedes: `2026-11-13-2041-app-updates.md`
Workspace: ISKIOS (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The installed app updates itself from a real published release, and the owner has accepted the Updates section, the top-bar notice and the confirmation. 0.1.2-Prototype is the first release that carries the updater, so the loop is proven only when a release after it is published and an installed 0.1.2 updates to it.

## State

- Verified by `git ls-remote origin`: tag `0.1.2-Prototype` (annotated, no `v`) and `origin/main` both point at `90b79ef` ("Version 0.1.2-Prototype (CHG-0267)"). Verified by `gh release list` and `gh release view`: a prerelease with seven assets, the four installers (`.dmg` arm64 and x64, `.exe`, `.AppImage`), `latest.yml`, `latest-linux.yml` and `SHA512SUMS.txt`. The workflow run `43506315451` passed, including the first run of the new update-file upload steps.
- Verified by `shasum -a 512 -c` on the downloaded asset: the macOS arm64 DMG matches `SHA512SUMS.txt`. The other three installers were not downloaded or checked.
- Verified by the full suite before the version commit (`CI=1 bun run test --maxWorkers=4`: 134 files, 1,475 passed, 14 skipped), `bun run check`, `bun run typecheck` and the offline release-workflow script (8 scenarios). Not rerun after the documentation changes below; they touch no code.
- Verified on GitHub: the release notes of `0.1.1-Prototype` and `0.1.2-Prototype` were replaced with notes written from the changelog files; `0.1.0-Prototype` still has only the auto-generated "Full Changelog" link.
- What went wrong and was undone: a `0.1.3-Prototype` tag and commit `ce0ce49` were pushed first, because the owner's first request said 0.1.3; the owner then corrected it to 0.1.2. Both 0.1.3 workflow runs were cancelled, the remote and local tag deleted (`git push --no-verify origin :refs/tags/0.1.3-Prototype`, at the owner's request), the commit amended, and `main` force-pushed with `--force-with-lease` pinned to `ce0ce49`. No 0.1.3 tag, release or commit exists now (verified by `git ls-remote --tags`).
- In flight when this file was written, then committed together with it: `documentation/changelog.md` split into `documentation/changelog/0.1.0-Prototype.md` (214 entries), `0.1.1-Prototype.md` (37) and `0.1.2-Prototype.md` (16), the monolith removed; the 238 relative links in those files rewritten with a `../` prefix; every reference to the old path repointed (README, AGENTS.md, inspirations, work in progress, five verification records, two `leftovers.sh` scripts); and a documentation refresh (README, outline, architecture, glossary, requirements, backlog, the capability specifications that named the Charter or a stale status, work in progress, the recording kit's README). The owner asked for the commit and a push to `main` with `--no-verify`: read `git log -3` and `git ls-remote origin main` to learn whether that completed. The checkout was already the original repository on `main`, not a linked worktree, so there was no worktree branch to sync back.
- Verified by `git diff --check` (clean), `bun run check` (clean) and a script that follows every relative Markdown link in README, AGENTS.md, `documentation/*.md`, the capability specifications and the changelog files: one broken link remains, `../../apps/app/assets/compass.png` in the 0.1.0 changelog (already broken in the old file; the image is gone), after `inspirations.md`'s stale `crest-credits.md` path was fixed.
- Assumed: the README's statement that pairing another Iskios is built and under review rests on `documentation/work-in-progress.md` (batches 1 to 3a), not on a run of the app. The other documentation edits were checked against the code (the Workshop's sections in `apps/app/src/settings/settingsSections.ts`), the specifications, git history and the changelog.
- Not proven: an installed 0.1.2 finding and installing a later published release; the Windows and Linux updaters; the installers on any system beyond macOS packaging; the owner's look at the Updates section, notice and confirmation (only dark theme seen).

## Decisions

- The release is 0.1.2-Prototype; the next one is 0.1.3-Prototype. The owner's correction is recorded in CHG-0267 (`documentation/changelog/0.1.2-Prototype.md`), which also says the `0.1.2` builds made locally for the updater check were never published.
- The changelog is one file per release in `documentation/changelog/<version>.md`; a new entry goes in the file of the release it will ship in, and the next release's file is created with its first entry. The owner chose per-release files over per-day files. Entries were assigned by their position against the changelog as it stood at each tag, because CHG numbers are not strictly ordered (0147 and 0148 appear twice). Recorded in `AGENTS.md`.
- The README's "See it work" section and its recordings must not change: re-recording is a chore for the owner. Only the version they come from is stated (0.1.1-Prototype, commit `ae217e4`), also in `documentation/readme/recording/README.md`. The screenshot at the top of the README was covered by the same note; the owner has not confirmed that reading.
- GitHub release notes are written from the release's changelog file and list breaking changes (the requirement "Breaking changes are listed in the release notes", `documentation/requirements.md`). 0.1.1 has none; 0.1.2 has none known and adds one table, `own_account_labels` (migration 0045); opening data saved by 0.1.2 in an older version was not tried.
- In the documentation, "Charter" is now "Workshop" (CHG-0146), except in ADR 0014, the changelog, the verification records, the handoffs, the older work-in-progress sections and the mission-tracking specification's navigation table, which stay as written. "Guildmaster" was left in the capability specifications, which carry a note that it reads as Iskios.
- The pre-push hook's bypass (`--no-verify`) was used only for the actions the owner named: deleting the 0.1.3 tag and pushing `main`.

## Next

1. Confirm with the owner what they want first. Likely: they look at the Updates section, the notice and the confirmation in the installed app (a development run does not update), and decide when to publish the next release.
2. Prove the loop for real: install the 0.1.2 DMG by hand, then publish `0.1.3-Prototype` (bump `version` in `apps/app/package.json` and `apps/desktop/package.json` and the two version lines in `bun.lock`, add a CHG entry in a new `documentation/changelog/0.1.3-Prototype.md`, tag with no `v`, push) and use Check now in the installed 0.1.2 app. Watch the workflow run and the update itself; ask the owner before each outward step.
3. When the owner accepts, append a Delivery to the changelog (references CHG-0266), set the status line of `documentation/capabilities/app-updates/specifications.md` to accepted, and prune the "App updates" and "Release 0.1.2-Prototype" entries of `documentation/work-in-progress.md`.
4. Optional: write the release notes of `0.1.0-Prototype` from its changelog file, with `gh release edit 0.1.0-Prototype --notes-file <file>`.
5. Afterwards: smoke-test the Windows and Linux updaters on those systems; candidates for the next batch remain slow model lists and the Workshop's default Companion having no account (backlog).

## Open questions

- Owner: does the look of the Updates section, notice and confirmation suit them, and when should the next release be tagged?
- Owner: should the note about 0.1.1-Prototype also cover the screenshot at the top of the README, as written?
- Owner: should `0.1.0-Prototype`'s release notes be rewritten like the other two?
- Live: do the Windows and Linux updaters work, and does an installed app read GitHub's real release list as the stand-in did?
- Older questions of the superseded handoff stay open: signing, a data backup before updating, the owner's channel choice.

## Sources

- `documentation/changelog/` (CHG-0266, CHG-0267 in `0.1.2-Prototype.md`); `AGENTS.md` (changelog rule); `README.md`; `documentation/requirements.md` (Releases, Update check carries no owner data).
- `documentation/work-in-progress.md` (Release 0.1.2-Prototype, App updates); `documentation/capabilities/app-updates/specifications.md`; `documentation/verification/2026-11-13-app-updates.md`; `documentation/verification/2026-11-10-release-workflow.py`.
- `.github/workflows/package.yml`; workflow run https://github.com/Dyrits/ISKIOS/actions/runs/43506315451; releases https://github.com/Dyrits/ISKIOS/releases.
- Commits `3c40d85` (updater), `90b79ef` (version 0.1.2-Prototype); the documentation and changelog commit that carries this handoff.
- `.agents/handoffs/2026-11-13-2041-app-updates.md` for the updater's design and the superseded Next steps.
