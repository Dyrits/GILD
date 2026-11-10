# Proof: Quest and Side-quests menu restyle

- **Verdict:** not proven (appearance awaits the owner)
- **Work:** working tree on `10bf154`
- **Agreement:** the owner's request of 2026-11-10 to make the Quest and Side-quests menu look better, with an illustrated mockup as inspiration (no specification covers it)
- **Environment:** macOS (Darwin 25.6.0), Bun workspace; the running window was not started
- **Date:** 2026-11-10

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | The menu shows bold Cinzel section headings with a gold rule, bold titles, a diamond and italic state name at the end of each row, L connectors for side-quests of level 2 and deeper, and a gold selected row | request, diff of `threadTree.tsx` and `styles.ts` | awaiting human judgment |
| C2 | Nothing else breaks: selection, folding, notes, and the other users of `StateBadge` | diff | unproven for the screen; the suite passes |

## Evidence

### C1: the look

- **Check:** none by screenshot; the window was not run for this change.
- **Shown able to fail:** not applicable.
- **Result:** typecheck and Biome pass on the changed files.
- **Reproduced:** no.

### C2: no regression

- **Check:** `bun run test`, `bun run typecheck`, `bun run check`.
- **Shown able to fail:** no check reaches the tree's styling; none was added.
- **Result:** 458 passed, 10 skipped; typecheck and check exit 0.
- **Reproduced:** no fresh-context rerun; run from the same shell.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bun run test` | not run | pass (458 passed, 10 skipped) |
| Typecheck | `bun run typecheck` | not run | pass |
| Lint and format | `bun run check` | not run | pass |

## Not proven

C1: appearance needs a human eye; a screenshot of a quest with side-quests at several depths and a selected row would show it. C2: the screen behaviors (selection, unfolding) were not exercised.

## Reproduce

```sh
bun run typecheck && bun run check && bun run test
```

## New files

None.
