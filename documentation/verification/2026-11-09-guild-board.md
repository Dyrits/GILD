# Guild-board verification · 2026-11-09

Agreement: CHG-0073 and the owner's request to apply the Guild direction and its naming with iterate.
Baseline: `63bc425d28bb4ee054e4d0e91c77bdc3c85551a8`.

## Checks

- `bun run typecheck`: all four workspaces pass.
- `bun run check`: passes after formatting.
- `bun run test`: initial sandbox run could not bind loopback; the authorized run passed 413 tests, skipped 10, and failed one old naming expectation.
- `ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run apps/app/test/labels.test.ts`: all 20 pass after correcting the expected vocabulary, including subsequent scope display changes.
- Desktop build and `git diff --check`: pass.
- Balanced review by `gpt-6.1-terra`: found contrast on wood, notification wording, and generated lore scope labels; fixes verified by the same reviewer.

## Desktop interaction

Run the existing Metro server at port 8081 and the built Electron app with `GILD_HARNESS=fake`, `GILD_DATA_DIR=/tmp/gild-guild-check`, `--user-data-dir=/tmp/gild-guild-profile2`, and `--remote-debugging-port=9365`.
The data directory must exist before starting the app.
Drive the window with Playwright's `chromium.connectOverCDP` using the loopback debugging endpoint.

Verified: Post a quest reveals the composer; sending Survey the northern realm creates a quest; the fake harness replies Echo: Survey the northern realm; a 1440px viewport shows the board beside its scroll and the rail's renamed navigation.
The [captured desktop](2026-11-09-guild-board/desktop-before-final-fixes.png) predates the title's full-width row, timber grain, final contrast corrections, and lore scope fixes.
The final screenshot and 390px run could not complete because the subsequent CDP connection timed out.
Aside was unavailable because its profile was disconnected.
No paid harness turn or live owner-data change was performed.

## Limits and acceptance

The owner has not accepted the appearance.
Phone-width layout, native builds, final screenshot, and actual desktop notification delivery remain unverified.
The mockup's subscription reserves and future Rituals, Waystones, Spoils, and Chronicle features are not implemented; the existing Resting column remains distinct.
Service-generated historical text and user-authored content retain their original vocabulary; current scope prefixes are translated only at display time.
