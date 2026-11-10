# The installed app is apart from development

The owner works in an installed Gild (a `.app` in a `.dmg`, built by `bun run package` with electron-builder); `bun run dev`, checks, and verification run as "Gild Dev".
Before this, a development run and the owner's running app shared one name, one user-data folder, and one Electron binary, so an agent that stopped or opened instances while developing also stopped the owner's window, and two services could open one database.

- **Identity**: only a packaged app without `GILD_DATA_DIR` is "Gild", on the default `Gild` profile and data folder. Every other run is "Gild Dev": its profile is `Gild Dev` beside it, or inside `GILD_DATA_DIR` when one is given. An explicit `--user-data-dir` wins.
- **Lock**: each profile takes Electron's single-instance lock, so a second launch on the same data focuses the running window instead of starting another service.
- **Screens**: the installed window loads the Expo web export from its own `gild-app://app/` scheme (a stable origin, so local storage survives launches); development loads the Metro server as before.
- **Data**: the installed app owns the existing `Gild` data folder. `bun run dev` starts with an empty `Gild Dev` folder; the former-name migration runs only in the installed app.
- **Processes**: the installed app's binary is `Gild`, not `Electron`, and lives in `Applications`, so a stop by process name aimed at development never matches it. Whoever starts an instance stops it by its own process id, never by name.
- **Packaging**: electron-builder, reusing the repository's Electron, with node-pty unpacked from the archive. The build is ad hoc signed, so it runs on the computer that built it; signing and notarizing for other computers is not done.

Rejected: only renaming the development profile (the shared binary name still lets a name-based stop reach the owner's window), and hand-assembling the `.app` (it would re-implement unpacking, icons, and the disk image that electron-builder already does).
