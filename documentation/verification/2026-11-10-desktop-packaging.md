# Desktop packaging automation, 2026-11-10

Starting revision: `51d4ceb44a8fad62fbea27acb233856d6cb1c777`.
Authorization: the owner requested GitHub Actions packaging on pushes to `main`, producing a DMG, Windows executable, and a Linux package.

## Checks

- `bun run check` passed (322 files).
- `bun run typecheck` passed in all four workspaces.
- `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 -shellcheck= .github/workflows/package.yml` passed, including action inputs, runner labels, expressions, and matrix references; shellcheck was disabled because it is not installed.
- `bun run package --arm64` passed on macOS arm64, including the desktop/service bundles, Expo web export, native dependency rebuilding for Electron 45.2.3, ad hoc signing, and DMG generation.
- `codesign --verify --deep --strict apps/desktop/release/mac-arm64/Gild.app` passed.
- `hdiutil verify apps/desktop/release/Gild-0.1.0-mac-arm64.dmg` passed with a valid checksum.

Output: `apps/desktop/release/Gild-0.1.0-mac-arm64.dmg`, approximately 123 MiB.
The packaged app was not launched, and no existing user data or running Gild instance was accessed.
Windows, Linux, Intel macOS, fresh-runner dependency installation, uploads, and trigger behavior remain unverified until the workflow runs on GitHub.
No full test suite was run for this packaging configuration change.

## Behavior and limits

The workflow checks lint and types before four native packaging jobs, cancels superseded runs for the same branch, and retains installer artifacts for 14 days.
Manual dispatch is available after publication.
`--publish never` prevents Electron Builder from publishing a release implicitly on CI.
Artifact names include platform, architecture, and commit; installer filenames include platform, architecture, and app version.
The runner architecture matches the locally installed Electron distribution.
Native dependency rebuilding is enabled because node-pty 1.1.0 ships macOS and Windows prebuilds, but no Linux prebuild.
Windows installers are unsigned, and macOS builds are ad hoc signed without notarization.
Successful packaging does not establish runtime compatibility on Windows or Linux; cross-platform runtime fixes, trusted signing, notarization, and auto-updates remain separate work.

## Sources

- [GitHub-hosted runner labels and architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
- [Electron Builder v26 configuration](https://www.electron.build/v26/docs/api/app-builder-lib.interface.configuration/).
- [Electron native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules/).
- [Checkout action](https://github.com/actions/checkout), [Bun setup action](https://github.com/oven-sh/setup-bun), and [artifact upload action](https://github.com/actions/upload-artifact).
