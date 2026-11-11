# Gild

A local-first desktop workspace for working with AI agents across Claude Code, Codex, and OpenCode.

Keep a piece of work in one quest, delegate parts of it into side-quests, and choose the harness, model, account, and effort for each thread.
Follow their conversations, answer approval requests, and hand a thread over to another harness with its history intact.

Gild is in **alpha** and serves one user on one computer.
Phone pairing, multiplayer, and Craft workflow automation remain planned work.
See the [work in progress](documentation/work-in-progress.md) for current verification and unfinished acceptance checks.

[Download installers](https://github.com/Dyrits/GILD/releases) · [Report an issue](https://github.com/Dyrits/GILD/issues) · [Documentation](#documentation)

## What you can do

- Work with Claude Code, Codex, and OpenCode in the same application, using your own subscriptions or API keys through their command-line tools.
- Start or continue quests through the Guildmaster, a permanent conversation that coordinates your work.
- Open side-quests beneath a thread, give them different models, and exchange messages along the tree.
- Change a thread's harness, account, model, or effort between turns without discarding its conversation.
- Attach a local folder or repository, or give a thread its own Git worktree.
- Keep a shared briefing and journal for each quest, and save lore at thread, workspace, or global scope.
- Paste, drop, or choose images for a message, and use `!` to open a shell in the desktop composer and send its output as context.
- Configure MCP servers and use skills from existing skill folders.
- Set quest and global budgets, review action approvals, and grant removable standing permissions.
- Schedule recurring instructions as Rituals, with fallback models and a manual Run now option.

The interface uses guild names for familiar concepts:

| In Gild | Meaning |
| --- | --- |
| Quest | A piece of work and its tree of threads |
| Side-quest | A thread opened beneath another thread |
| Companion | The model selected for a thread |
| Realm | A workspace folder or repository |
| Guildmaster | The conversation that opens and coordinates quests |
| Ritual | A recurring instruction on a schedule |
| Charter | Settings |
| Summons | A thread needs your attention |

The [glossary](documentation/glossary.md) explains the full vocabulary and the technical names used in the code.

## Install and start

Download an installer from [GitHub Releases](https://github.com/Dyrits/GILD/releases) when a release is available.
Manual builds are also available from the **Artifacts** section of the [desktop workflow](https://github.com/Dyrits/GILD/actions/workflows/package.yml); these expire after 14 days.

| Platform | Build | Installer |
| --- | --- | --- |
| macOS | Apple Silicon (arm64) or Intel (x64) | `.dmg` |
| Windows | x64 | `.exe` (NSIS) |
| Linux | x64 | `.AppImage` |

Automatic updates are not configured.

Before uploading a macOS installer, the workflow verifies and mounts its DMG, copies the app to a fresh location, and checks the rendered Guildmaster screen, service bridge, and native terminal on temporary data.
Run that same application check locally with `bun apps/desktop/scripts/check-package.ts /Applications/Gild.app`.
This check proves packaged startup; Apple trust checks on other computers still require Developer ID signing and notarization.

If the Dock icon keeps bouncing without a window, a stale macOS launch-block decision can survive Open Anyway and re-signing.
Gild's observed case was resolved with a fresh byte-identical copy, preserving its new file identity when moving it into Applications; see the [diagnosis and verified recovery procedure](documentation/verification/2026-11-10-dmg-launch.md).
Cross-platform builds still need smoke-testing on their target systems.

### macOS

Gild does not yet have an Apple Developer ID signing certificate or Apple notarization.
The macOS build has an ad hoc signature, which does not identify a trusted developer to Gatekeeper, so macOS may block the first launch.
This is separate from the source-code [license](#license).

1. Download the `.dmg` for your Mac: `arm64` for Apple Silicon or `x64` for Intel.
2. Open the DMG and drag Gild into Applications.
3. In Finder, open Applications, Control-click Gild, and choose **Open**; confirm if offered.
4. If macOS blocks it, open **System Settings → Privacy & Security**, find the message about Gild, and click **Open Anyway**.
5. Confirm **Open** in the next dialog, authenticating if asked.

If the app remains blocked and you trust the copy downloaded from this repository's releases or workflow artifacts, open Terminal and remove its quarantine attribute:

```sh
xattr -dr com.apple.quarantine /Applications/Gild.app
```

Then open Gild from Applications again.
This command removes the download quarantine flag from Gild only; it does not sign, notarize, or verify the app.
If macOS reports damage, download a fresh copy first; a damaged-app warning can also indicate a corrupted or modified download.
See [Apple's Gatekeeper guidance](https://support.apple.com/en-us/102445) for details.

### Windows

Run the `.exe` installer.
Windows builds are unsigned, so SmartScreen may show **Windows protected your PC**.
If you trust the downloaded installer, choose **More info → Run anyway**.
If the file remains blocked, right-click it, open **Properties**, select **Unblock** if available, apply the change, and try again.

### Linux

From the folder containing the downloaded AppImage, make it executable and launch it:

```sh
chmod +x Gild-*.AppImage
./Gild-*.AppImage
```

### First launch

The installer includes the interface and local service. In Charter, choose Install beside a missing harness, then sign in to it. Installing through Charter requires Node.js and npm with a writable global installation folder; you can also install harnesses yourself.
Gild looks for `claude`, `codex`, and `opencode` on your `PATH`.
You only need the harnesses you intend to use.

1. Open Gild and visit the Charter to check harness availability and accounts.
2. Add a realm if you want agents to work in a local folder or repository.
3. Tell the Guildmaster what you want to do, then open the quest it creates or continues.
4. Choose a Companion, send a message, and open side-quests as needed.

Rituals run through the local service, so leave Gild running for scheduled work.
Runs missed while the app is closed or the computer is asleep are skipped.

## Data and provider use

Gild stores its application data locally, with a `gild.sqlite` database in Electron's user-data folder and supporting files alongside it.
Workspaces remain in their chosen locations.
The desktop interface communicates with the local service over an authenticated loopback connection.

Agent requests still send the context needed for the work to your chosen harness, provider, and connected tools.
You use your own provider accounts and pay for their use directly; Gild does not resell model access.
Each harness handles its own sign-in, including accounts added through Gild.

## Develop locally

Use Bun **1.4.4**, the version pinned in CI, and Git.
Building the native terminal dependency (`node-pty`) requires Xcode command-line tools on macOS, Visual Studio C++ tools on Windows, or Python, make, and a C++ compiler on Linux.

```sh
git clone https://github.com/Dyrits/GILD.git
cd GILD
bun install
bun run dev
```

The development command starts the Expo web server on port 8081 and opens Electron as **Gild Dev**, with its own profile and data separate from the installed app.
The interface hot-reloads; changes to the service, contracts, or desktop process rebuild and restart Electron, stopping running turns.

To try the interface without a provider account or model spending, use the echo harness:

```sh
GILD_HARNESS=fake bun run dev
```

These environment-variable examples use a POSIX shell.
In PowerShell, set a variable with `$env:GILD_HARNESS = "fake"` before running the command.

| Variable | Purpose |
| --- | --- |
| `GILD_DATA_DIR` | Override the application data folder; use an absolute path for an isolated development session. |
| `GILD_CLAUDE_PATH` | Override the `claude` executable. |
| `GILD_CODEX_PATH` | Override the `codex` executable. |
| `GILD_OPENCODE_PATH` | Override the `opencode` executable. |
| `GILD_HARNESS=fake` | Replace real harnesses with the echo harness. |

### Checks

```sh
bun run check
bun run typecheck
bun run test
```

Biome checks formatting and lint rules; TypeScript checks all workspaces.
Tests run on Electron's bundled Node runtime and use fakes and stand-in executables by default.
Live checks are opt-in, require installed and signed-in harnesses, and consume model usage:

```sh
GILD_LIVE_CLAUDE=1 bun run test
GILD_LIVE_HARNESSES=1 bun run test
```

Set `GILD_LIVE_OPENCODE_MODEL` if the live OpenCode checks need a specific model identifier.
Use `bun run format` to apply Biome fixes.
Commits run Biome on staged files and then the workspace typecheck.

### Repository layout

| Path | Contents |
| --- | --- |
| [`apps/desktop`](apps/desktop/) | Electron shell, development launcher, and installer packaging |
| [`apps/app`](apps/app/) | Expo / React Native interface, rendered on the web inside Electron |
| [`packages/service`](packages/service/) | Local Node service, SQLite storage, harness adapters, scheduling, and MCP thread tools, built with Effect |
| [`packages/contracts`](packages/contracts/) | Shared records and requests defined with Effect Schema |
| [`documentation`](documentation/) | Product specifications, architecture, decisions, and verification evidence |

## Build and release

```sh
bun run package
```

This builds an installer for the current platform in `apps/desktop/release`.
It bundles the interface and service, so the installed app needs no development server.

Pushes to `main` and pull requests targeting it run lint, typechecking, and tests through the [desktop workflow](.github/workflows/package.yml).
Push a version tag such as `v0.1.0-alpha.1` to build macOS arm64 and x64, Windows x64, and Linux x64 installers and publish them on [GitHub Releases](https://github.com/Dyrits/GILD/releases).
The tag without its `v` prefix sets the packaged app version; tags containing a hyphen produce prereleases.
The release is published only after all four builds and uploads succeed.
Installers download directly as `.dmg`, `.exe`, and `.AppImage` files without an extra ZIP wrapper.
The workflow also supports **Run workflow** manually for test builds, which upload direct installer files to the run's **Artifacts** section without publishing a release.
Actions artifacts expire after 14 days; release assets remain until removed.

## License

The repository does not yet include a `LICENSE` file, so Gild does not yet have a formal source-code license in place.
The [architecture](documentation/architecture.md#stack) records Apache 2.0 as the intended license; the license file still needs to be added.
Source-code licensing is separate from the signing certificates used to distribute desktop installers.

## Contribute

Report bugs and propose changes through [GitHub Issues](https://github.com/Dyrits/GILD/issues).
For a bug, include your operating system, Gild version, harness, steps to reproduce, and relevant logs with private information removed.

Before changing code, read the [conventions](documentation/conventions.md), the relevant [capability specification](documentation/capabilities/), and any directory-specific `AGENTS.md` instructions.
Check the [work in progress](documentation/work-in-progress.md) for ongoing work and run the checks above before opening a pull request.

## Documentation

- [Outline](documentation/outline.md): purpose, actors, and capabilities.
- [Requirements](documentation/requirements.md): privacy, access, licensing, and other system-wide obligations.
- [Glossary](documentation/glossary.md): domain terms and interface names.
- [Architecture](documentation/architecture.md) and [decision records](documentation/architecture-decision-record/): system structure and the reasons behind it.
- [Capability specifications](documentation/capabilities/): agreed behavior and acceptance criteria.
- [First slice design and capability blueprints](documentation/first-slice-design.md): implementation designs.
- [Backlog](documentation/backlog.md) and [work in progress](documentation/work-in-progress.md): deferred work and current batches.
- [Conventions](documentation/conventions.md): code and test conventions.
- [Changelog](documentation/changelog.md): agreements and deliveries.
- [Verification](documentation/verification/): reproducible checks and screenshots.
