# Conversation terminal verification

Work begins at `e770774` on branch `bang-terminal`.
The owner authorized the default shell, home and realm starting folders, terminal output in context, and inline draft and message presentation.
See the [specification](../capabilities/conversation-terminal/specifications.md).

## Evidence

- The original Electron probe failed with `posix_spawnp failed` because node-pty's prebuilt spawn-helper lacked execute permission.
- Correcting that permission made the exact probe print its requested working folder; the terminal manager performs that correction when needed.
- Four real-shell tests pass, covering home and realm folders, session isolation, reopening without losing state, final output, and a new shell after exit.
- Snapshot and progress regression checks pass alongside those shell checks.
- The first isolated Electron drive opened the owner's Fish shell in `/Users/dgerrits`, ran `printf`, hid and reopened the terminal, and sent a snapshot without typed text.
- The normal fake harness replied with the snapshot, proving it passed through the service and into harness input.
- Desktop build, Expo web export, and workspace typecheck pass.
- The standalone browser path has no desktop preload and therefore no terminal shortcut.

The original process failure is locked down at the real terminal manager seam.
The side-quest reproduced the stale work label with a completed install approval; its regression passes with the neutral Working label.
That display fix does not add live tool-by-tool progress.

## Reproduce

From the repository root:

```sh
bun run typecheck
bun run check
bun run test apps/desktop/test/terminals.test.ts apps/app/test/terminalSnapshot.test.ts apps/app/test/entries.test.ts
bun run --filter desktop build
```

Export the app, then run the isolated drive:

```sh
cd apps/app
bunx expo export --platform web --output-dir /private/tmp/gild-terminal-web
cd ../..
python3 documentation/verification/2026-11-10-bang-terminal/drive.py "$PWD" /private/tmp/gild-terminal-web /private/tmp/gild-terminal-artifacts
```

The drive starts one Electron window without a development watcher, uses the fake harness and disposable data, and closes that window in its cleanup.
Its assertions cover ordinary exclamation marks, opening on an empty line, home and realm roots, hiding and showing, context capture, and shell restart.
The user's running instance and live quests are not the test environment.
Live tests require loopback socket access outside a restricted sandbox.

Owner review of the final appearance remains pending.

## Final checks

The full suite outside the socket-restricted sandbox passed 53 files and 617 tests, with one file and 10 tests skipped.
Command: `env -u CLAUDE_CONFIG_DIR bun run test --maxWorkers=3`.
The 24 focused shell, snapshot, and progress checks pass; typecheck, Biome, desktop build, and Expo web export pass.
The inline layout was checked by exporting the app after the owner's screenshot feedback.

The owner's final clarification moved the live shell into an interactive owner-message bubble in the feed.
Opening it does not send a message or start the Companion; sending captures its output, and `!` reopens that same shell afterwards.
See [the live bubble](2026-11-10-bang-terminal/01-live-bubble.png) and [the sent snapshot and fake-harness echo](2026-11-10-bang-terminal/02-sent-context.png).

The final isolated drive passed ordinary `!`, empty-line opening, no agent response on opening, home execution, hide/show, sent context, realm-root execution, steered snapshot delivery, reopening the same shell, and New shell after exit.
No renderer errors were observed.
The test reads the fake harness's persisted reply so a steered snapshot is checked even when it shares the turn with the quest's starting request.
