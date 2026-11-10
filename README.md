# Gild

An open-source, local-first workspace where every piece of work is a mission carried out in a tree of threads, each on whichever agent harness, model, and effort fits.

## Development

Requires Bun. From the repository root:

- `bun install`
- `bun run dev` opens the desktop app; the service keeps its data in the app's user-data folder. Set `GILD_DATA_DIR` to use another folder.
- Threads run the installed Claude Code (`claude` on the PATH, or `GILD_CLAUDE_PATH`) in chat-only mode; `GILD_HARNESS=fake` uses the echo harness instead.
- `bun run test` runs the checks on Electron's Node; `GILD_LIVE_CLAUDE=1 bun run test` adds one live Claude Code check that uses a few tokens. `bun run typecheck` and `bun run check` (Biome) check the code.

## Desktop installers

`bun run package` builds an installer for the current platform in `apps/desktop/release`: a macOS DMG, Windows `.exe` (NSIS), or Linux AppImage.
Native build tools are required for `node-pty` (Xcode command-line tools on macOS, Visual Studio C++ tools on Windows, or Python, make, and a C++ compiler on Linux).
The packaged app includes its screens and local service; users install their chosen harness tools separately.

Pushes to `main` and pull requests targeting it run lint, typechecking, and tests through the [desktop workflow](.github/workflows/package.yml).
Push a version tag such as `v0.1.0-alpha.1` to build macOS arm64 and x64, Windows x64, and Linux x64 installers and publish them on [GitHub Releases](https://github.com/Dyrits/GILD/releases).
The tag without its `v` prefix sets the packaged app version; tags containing a hyphen produce prereleases.
The release is published only after all four builds and uploads succeed.
Installers download directly as `.dmg`, `.exe`, and `.AppImage` files without an extra ZIP wrapper.
The workflow also supports **Run workflow** manually for test builds, which upload direct installer files to the run's **Artifacts** section without publishing a release.
Actions artifacts expire after 14 days; release assets remain until removed.
To run a Linux AppImage after downloading it, grant executable permission with `chmod +x Gild-*.AppImage`.
Windows installers are unsigned, and macOS builds use an ad hoc signature without notarization, so operating-system trust checks may block installation.
Automatic updates are not configured.

## Documentation

- [Outline](documentation/outline.md)
- [Requirements](documentation/requirements.md)
- [Glossary](documentation/glossary.md)
- [Architecture](documentation/architecture.md)
- [Architecture decision records](documentation/architecture-decision-record/)
- [Capability specifications](documentation/capabilities/)
- [First slice design and capability blueprints](documentation/first-slice-design.md)
- [Backlog](documentation/backlog.md)
- [Work in progress](documentation/work-in-progress.md)
- [Conventions](documentation/conventions.md)
- [Changelog](documentation/changelog.md)
