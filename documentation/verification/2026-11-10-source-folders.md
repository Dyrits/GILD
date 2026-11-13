# Proof: source files grouped into folders (CHG-0125)

- **Verdict:** proven for C1 to C5 and C7; C6 (the app still looks and behaves as before in a running window) is not driven and stays unproven.
- **Work:** working tree on `d421b47`, uncommitted when proven (`git mv` renames plus import rewrites; the starting commit is the unmoved tree).
- **Agreement:** the owner's request of 2026-11-10 to apply the recommendations of `documentation/architecture-audit/architecture-audit-2026-11-10-2119.html` (candidates 1, 3, 4; candidate 2 not applied); recorded as CHG-0125 in `documentation/changelog/0.1.0-Prototype.md`; rules in `documentation/conventions.md` (Layout).
- **Environment:** macOS (Darwin 27.2.0), Bun 1.4.4, Node v26.13.0 for tooling, Electron as Node for the test runner, Vitest 5.1.0, Expo web export.
- **Date:** 2026-11-10

## Claims

| # | Claim | Source | Verdict |
| --- | --- | --- | --- |
| C1 | No service folder imports a later one: `core` imports no folder, `harness`, `lore`, and `policy` import only `core`, so nothing in them imports `work/` | candidate 1; conventions (Layout) | proven |
| C2 | Each service folder's `index.ts` exports exactly the names other folders' source files import, and they import the folder only through it | candidate 1; conventions (Layout) | proven |
| C3 | The app's folders form one downward chain (`foundation, attachments, terminal, ui, editors, crest, realms, rituals, quests, lore, conversation, settings, shell`) with no import running back up, and every relative import resolves | candidate 3 | proven |
| C4 | Tests mirror the folders: each test lives in its subject's folder, except four named cross-cutting ones | candidate 4 | proven |
| C5 | Behavior is unchanged, including the one added wiring: Claude Code's `--allowedTools` still lists the approval tool and then every unasked thread tool, now from `ThreadAccess.unaskedTools` | diff of `claudeArgs.ts`, `threads.ts`, `execution.ts` | proven |
| C6 | The app looks and behaves as before in a running window | the move changed paths only | unproven |
| C7 | Nothing regressed: tests, typecheck, lint, and the three bundles | project scripts | proven |

## Evidence

### C1 to C4: the import graph

- **Check:** `python3 -I documentation/verification/2026-11-10-source-folders/check-layout.py .` reads every relative import of `packages/service/src`, `apps/app/src`, and the test folders. C1 fails on any leaf folder importing outside its allowed set; C2 on an outside file importing a folder's internal file, an index name nobody outside imports, or a used name the index lacks; C3 on an import of a later folder in the chain or of a path that does not exist; C4 on a test outside its subject's folder.
- **Shown able to fail** (mutations on a copy of the working tree in `/tmp/mut`, restored and rechecked):
  - C1: appended an import of `../work/threadTools.ts` to `harness/claude.ts`; `FAIL C1 one-way: .../harness/claude.ts (harness) imports .../work/threadTools.ts (work)`.
  - C2: appended `export { kindOfTool } from "./loreFading.ts"` to `lore/index.ts`; `FAIL C2 interface: lore/index.ts exports kindOfTool, which no other folder's source file imports`. Appended an import of `../harness/runners.ts` to `work/threads.ts`; `FAIL C2 interface: .../work/threads.ts imports .../harness/runners.ts, not harness/index.ts`.
  - C3: appended an import of `../shell/shell` to `foundation/labels.ts`; `FAIL C3 app chain: ... (foundation) imports ... (shell), later in the chain`.
  - C4: moved `claude.test.ts` into `test/lore/`; `FAIL C4 tests mirror: .../test/lore/claude.test.ts tests claude, which lives in harness`.
  - The script found one real defect when first run for this proof: `documentation/architecture.md` and the audit's Outcome listed the app chain with `conversation` before `lore`, but `conversation` imports `lore`; both now read `quests, lore, conversation`.
- **Result:** `checked: 127 names in 4 service indexes; 94 service files; 88 app files` then `RESULT PASS`, exit code 0, on the end state and on the restored copy.
- **Reproduced:** by the author from a clean shell (see Reproduce); match.

### C5: Claude Code's allowed tools

- **Check:** `packages/service/test/harness/claude.test.ts`, the test "runs the thread's model and effort sandboxed…": a Claude thread runs against the stand-in, which logs its arguments; the new assertion requires `--allowedTools mcp__gild__request_approval ` followed by `unaskedToolNamesOf("gild")` joined by spaces.
- **Shown able to fail:** before and after: the same assertion added to the unmoved `claude.test.ts` in a worktree of `d421b47` passes there (25 passed, 5 skipped), so the behavior is the starting one. Mutation on the copy: `...unaskedTools` replaced by `...[]` in `claudeArgs.ts` fails it (1 failed, 24 passed); `unaskedTools: unaskedToolNamesOf(toolServerName)` replaced by `[]` in `work/threads.ts` fails it too (1 failed).
- **Result:** end state, 25 passed, 5 skipped (live).
- **Reproduced:** by the author; match.

### C7: regressions

See the table below.

## Regressions

| Check | Command | Starting commit | End state |
| --- | --- | --- | --- |
| Tests | `bun run test --maxWorkers=4` | pass (647 passed, 10 skipped) | pass (647 passed, 10 skipped) |
| Tests, default workers | `bun run test` | 5 timeouts (`harnesses.test.ts` x3, `loreOverTime.test.ts`, `loreProposals.test.ts`), twice | 4 to 5 timeouts in the same files, passing alone: pre-existing load flakiness |
| Typecheck | `bun run typecheck` | pass | pass |
| Lint and format | `bun run check` | pass | pass |
| Service bundle | `bun build ../../packages/service/src/main.ts --target=node --format=esm` in `apps/desktop` | not run | pass (0.96 MB) |
| Desktop main bundle | `bun build src/main.ts --target=node --format=esm --external electron --external node-pty` in `apps/desktop` | not run | pass (13.81 KB) |
| App web export | `bunx expo export --platform web` in `apps/app` | not run | pass (it failed once on three `require("../assets/…")` paths, fixed in `ui/banner.tsx`, `ui/sketches.tsx`, `quests/questPanel.tsx`) |

## Not proven

- **C6:** no running window was driven; the web export proves every module and asset resolves, not that the screens render. Prove it by starting `bun run dev` and opening the board, a quest, the Guildmaster, the Charter, and a Ritual.

## Reproduce

```sh
git status --short   # the working tree holding the move
python3 -I documentation/verification/2026-11-10-source-folders/check-layout.py .
bun run format && bun run check && bun run typecheck
bun run test --maxWorkers=4
(cd apps/desktop && bun build ../../packages/service/src/main.ts --target=node --format=esm --outfile /tmp/s.js && bun build src/main.ts --target=node --format=esm --external electron --external node-pty --outfile /tmp/m.js)
(cd apps/app && bunx expo export --platform web --output-dir /tmp/exp)
```

## New files

- `documentation/verification/2026-11-10-source-folders/check-layout.py`
- One added assertion and import in `packages/service/test/harness/claude.test.ts`.
