# Compact navigation

Starting revision: `d421b47aaca8c0a8bfef78eb8d9a7fdda33ce554`.
Agreements: CHG-0123 and CHG-0124.

## Changes

The main left menu defaults to 220px, allows resizing down to 200px, and collapses to 60px.
Labels are 15px; crests, icons, padding, and section spacing are smaller.
Previously saved custom widths remain respected.
The conversation's tree column renders only if the quest contains a side-quest, regardless of whether it is folded or finished.
The narrow-screen Back to quests link remains in the conversation when the tree is absent.

## Checks run

- `bun run check`: passes.
- `bun run typecheck`: all four workspaces pass.
- `bun run test apps/app/test`: 132 tests pass in 15 files; these existing tests do not prove the new visual layout.
- From `apps/app`, `bunx expo export --platform web --output-dir /private/tmp/gild-compact-navigation-web`: passes; this export precedes the final small reduction to category, Ritual, and archive icons.
- `git diff --check`: passes.
- `bun run test`: 216 pass, 431 fail, 10 skip in the restricted sandbox; the service fixtures fail to listen on localhost with `EPERM`.

The full suite needs a rerun with local networking; permission was requested before proceeding with that tooling problem.
Aside cannot connect because its selected browser profile is not running; Playwright is the planned fallback once local networking is permitted.
No browser observation or screenshot is claimed.

## Remaining acceptance

1. Open a quest without side-quests and confirm that no tree column or empty space remains.
2. Create its first side-quest and confirm that the tree appears on the left, then select the side-quest and return to its quest.
3. Fold agent-created children and finish a child; confirm that the tree remains accessible.
4. Delete the last child and confirm that the tree column disappears.
5. At a width below 820px, open a quest without children and use Back to quests.
6. Collapse, expand, and resize the main left menu; reload to confirm that its width is remembered.
7. Ask the owner to judge the smaller menu's proportions and label readability in the running app.

Changes remain uncommitted while verification is pending, alongside the pre-existing staged repository reorganization.
