# Proof: breadcrumbs, quest screen layout, and quest panel

- **Verdict:** not proven
- **Work:** working tree on `e827fe2` (uncommitted CHG-0075 layout work and CHG-0076 on top)
- **Agreement:** the owner's requests of 2026-11-09 in conversation, recorded in CHG-0076
- **Environment:** macOS (Darwin 27.2.0), bun, Expo web export; the window was not started
- **Date:** 2026-11-09

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The top bar shows breadcrumbs that follow the rail: `Realms › Realm`, `Realms › Realm › Quest`, `Quests › Quest`, `Quests › ▤ Archives`; only the realm step of a quest's path is a link | Owner's requests | awaiting human judgment |
| C2 | The rail collapses and expands from an icon handle centered on its edge; no toggle in the top bar, no "Collapse" row | Owner's requests | awaiting human judgment |
| C3 | A quest has no header block: the tree (Quest, Side-quests) sits left of a full-height conversation | Owner's requests | awaiting human judgment |
| C4 | The quest panel (name, state, journal, budget, usage, ending) is a right column with a `✕ Quest` header level with the top bar, shown or hidden by the top bar's right icon; open by default from 1280px | Owner's requests | awaiting human judgment |
| C5 | The sidebar row and narrow dashboard heading read "Archives" | Owner's requests | awaiting human judgment |

## Evidence

No claim was observed in the running window: the application was not started, no screenshot was taken, and no check was shown able to fail. What was run is under Regressions. These show that the code compiles, passes the existing tests, and bundles; none observes C1 to C5.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bun run test` | not run | pass (415 passed, 10 skipped) |
| Typecheck | `bun run typecheck` | not run | pass |
| Lint | `bun run check` | not run | pass |
| Whitespace | `git diff --check` | not run | pass |
| Web bundle | `cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export` | not run | pass |

## Not proven

C1 to C5: appearance and layout need the owner's eye, and none was driven. To prove them: start the window on a throwaway database with the fake harness, open a quest in a realm, a quest outside one, and the Archives, and capture screenshots at 1400px and at under 820px; collapse and expand the rail, show and hide the quest panel, and rename a quest from the panel. The quest panel reaches the window's frame through `useQuestPanel` in `apps/app/src/sidebar.tsx`; that path is the one most worth watching.
Not done either: mutation checks, a run against the starting commit, and reproduction by a fresh-context agent.

## Reproduce

```sh
bun run test && bun run typecheck && bun run check && git diff --check
cd apps/app && bunx expo export --platform web --output-dir /tmp/gild-export
```

## New files

None.
