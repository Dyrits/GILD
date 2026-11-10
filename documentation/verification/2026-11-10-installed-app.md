# Installed app (.dmg), 2026-11-10

Claim: `bun run package` builds a `.dmg` whose app runs apart from development (CHG-0122, ADR 0013).
Not checked: the owner's own `Gild` data (never opened), notarization, a live harness turn.

## Reproduce

1. `env -u CLAUDE_CONFIG_DIR bun run package` writes `apps/desktop/release/Gild-0.1.0-arm64.dmg` (about 1 minute; downloads `dmgbuild` once into `~/Library/Caches/electron-builder`).
2. `hdiutil verify` on the image: checksum valid. `codesign --verify --deep --strict` on the `.app`: valid, `flags=0x2(adhoc)`, identifier `app.gild.desktop`.
3. Mount it read-only (`hdiutil attach -nobrowse -readonly -mountpoint /tmp/gild-dmg-mount`) and start the app with a Finder-like environment and a throwaway data folder: `env -i HOME=$HOME USER=$USER PATH=/usr/bin:/bin:/usr/sbin:/sbin GILD_DATA_DIR=/tmp/gild-pkg-check /tmp/gild-dmg-mount/Gild.app/Contents/MacOS/Gild --remote-debugging-port=9333`. Stop it by its process id only.

## Observed

- The page is `gild-app://app/` titled "Gild"; the Guildmaster screen renders with the bundled Cinzel and Alegreya fonts, so the window reaches its service.
- The service process's `PATH` held `~/.local/bin`, `~/.opencode/bin`, `~/.bun/bin`, and Homebrew although the launch path was only the system folders.
- `window.gild.terminalOpen` returned a running shell in the home folder and echoed written input (before the fix it failed with `ENOTDIR … app.asar/…/spawn-helper`).
- Tests: `apps/desktop/test/shellPath.test.ts` and `terminals.test.ts` (`unpackedPathOf`) were written red first.
