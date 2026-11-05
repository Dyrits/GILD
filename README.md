# OpenMission

An open-source, local-first workspace where every piece of work is a mission carried out in a tree of threads, each on whichever agent harness, model, and effort fits.

## Development

Requires Bun. From the repository root:

- `bun install`
- `bun run dev` opens the desktop app; the service keeps its data in the app's user-data folder. Set `OPENMISSION_DATA_DIR` to use another folder.
- `bun run test` runs the checks on Electron's Node; `bun run typecheck` and `bun run check` (Biome) check the code.

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
- [Changelog](documentation/changelog.md)
