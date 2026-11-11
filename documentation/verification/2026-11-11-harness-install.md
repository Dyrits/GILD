# Charter harness installation

Starting revision: `37e8c0a262dc4b721573a964adc400fb1ded566a`, with unrelated rebranding and sidebar changes already in the working tree.

Authorized by the owner's request of 2026-11-11: offer installation in Charter when a harness is missing.

Implemented: Install on unavailable harness rows; Installing… during the request; other install/update actions disabled until completion; refreshed status and accounts on success; visible errors and retry on failure. The local service runs the official npm package's global installation through the computer's npm, outside the command queue, and checks the configured harness executable afterward. Node.js/npm, a writable global prefix, and that prefix's bin folder on PATH are prerequisites. No sign-in is performed by installation.

## Checks

- Full suite: 739 passed, 10 skipped. Eight new tests cover the service request, refusing installation over an installed harness, each official package, Windows npm launcher arguments, missing npm/timeouts, and npm failure output.
- Workspace typecheck and Biome pass.
- Expo web export succeeds.
- Aside browser, exported web app, isolated SQLite data under `/tmp/iskios-harness-install-data`, fake harness tools: Codex and OpenCode start missing with Install; Claude has Update. Clicking Codex Install removes its button, shows Ready, and adds its accounts section. OpenCode retains Install and Claude retains Update. Screenshots: [before](2026-11-11-harness-install/before.png), [after](2026-11-11-harness-install/after.png).
- To reproduce the automated checks: `bun run test packages/service/test/harness/harnesses.test.ts packages/service/test/harness/harnessInstallation.test.ts`, `bun run typecheck`, `bun run check`.

Not verified: installing a real package (the owner's harness installations were preserved), real Windows/Linux execution, the packaged desktop app, visual progress during a slow real installation, or the owner's acceptance of the appearance. Windows command construction is checked with a fake process runner.

Temporary browser server and fake service were stopped after verification. The session commit contains the harness work separately from the pre-existing rebrand/sidebar changes; see the [handoff](../../.agents/handoffs/2026-11-11-1200-harness-installation.md).
